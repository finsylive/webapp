"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Eye, Plus, Trash2 } from 'lucide-react';
import {
  SiGithub,
  SiFigma,
  SiDribbble,
  SiBehance,
  SiLinkedin,
  SiYoutube,
  SiNotion,
  SiSubstack,
} from 'react-icons/si';

export default function CreatePortfolioPage() {
  const params = useParams() as { username?: string };
  const username = (params?.username || '').toString();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Array<{ id: string; title?: string | null; name?: string | null }>>([]);
  const [loadingPills, setLoadingPills] = useState(false);

  type PlatformKey =
    | 'github'
    | 'figma'
    | 'dribbble'
    | 'behance'
    | 'linkedin'
    | 'youtube'
    | 'notion'
    | 'substack'
    | 'custom';

  const PLATFORM_LABELS: Record<PlatformKey, string> = {
    github: 'GitHub',
    figma: 'Figma',
    dribbble: 'Dribbble',
    behance: 'Behance',
    linkedin: 'LinkedIn',
    youtube: 'YouTube',
    notion: 'Notion',
    substack: 'Substack',
    custom: 'Custom',
  };

  // Ensure URLs are absolute with protocol to avoid privacy/mixed-content issues
  const ensureProtocol = (url?: string | null) => {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const PLATFORM_ICONS: Record<PlatformKey, ReactNode> = {
    github: <SiGithub size={20} className="text-emerald-400" />,
    figma: <SiFigma size={20} className="text-emerald-400" />,
    dribbble: <SiDribbble size={20} className="text-emerald-400" />,
    behance: <SiBehance size={20} className="text-emerald-400" />,
    linkedin: <SiLinkedin size={20} className="text-emerald-400" />,
    youtube: <SiYoutube size={20} className="text-emerald-400" />,
    notion: <SiNotion size={20} className="text-emerald-400" />,
    substack: <SiSubstack size={20} className="text-emerald-400" />,
    custom: <Plus className="h-5 w-5 text-emerald-400" />,
  };

  const availablePlatforms = useMemo<PlatformKey[]>(
    () => Object.keys(PLATFORM_LABELS) as PlatformKey[],
    []
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKey[]>([]);
  const [platformLinks, setPlatformLinks] = useState<Record<PlatformKey, string>>({} as any);
  const addedCount = selectedPlatforms.length;

  const togglePlatform = (key: PlatformKey) => {
    setSelectedPlatforms((prev) => {
      if (prev[0] === key) {
        setPlatformLinks((pl) => {
          const { [key]: _, ...rest } = pl;
          return rest as Record<PlatformKey, string>;
        });
        return [];
      }
      return [key];
    });
  };

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title?.trim() || null,
        description: description?.trim() || null,
        platforms: selectedPlatforms.map((k) => ({
          platform: k,
          link: ensureProtocol(platformLinks[k]) || null,
        })),
        forceNew: true,
      };
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/portfolios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create portfolio');
      router.push(`/profile/${encodeURIComponent(username)}/portfolios`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    // focus title input on mount for faster creation
    const el = document.getElementById('portfolio-title-input') as HTMLInputElement | null;
    el?.focus();
    // load existing portfolio titles for pills
    let cancelled = false;
    const run = async () => {
      try {
        setLoadingPills(true);
        const res = await fetch(`/api/users/${encodeURIComponent(username)}/portfolios`);
        const json = await res.json().catch(() => ({ data: [] }));
        if (!cancelled) setItems(Array.isArray(json?.data) ? json.data : []);
      } catch {
        // ignore pills load errors on create page
      } finally {
        if (!cancelled) setLoadingPills(false);
      }
    };
    if (username) run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="flex-1 w-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto w-full">
          <div className="bg-card/60 border border-border rounded-2xl shadow-sm p-8 sm:p-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Link
                  href={`/profile/${encodeURIComponent(username)}`}
                  className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-5 w-5 mr-1" /> Back
                </Link>
                <h1 className="text-2xl font-semibold">Create Portfolio</h1>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <button
                  type="button"
                  onClick={() => router.push(`/profile/${encodeURIComponent(username)}/portfolios`)}
                  className="p-2 rounded-lg hover:bg-white/5"
                  title="Preview"
                >
                  <Eye className="h-5 w-5" />
                </button>
                <button type="button" className="p-2 rounded-lg hover:bg-white/5" title="Delete" disabled>
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Pills: show existing portfolio titles and an active New pill */}
            <div className="flex items-center gap-3 mb-8 flex-wrap">
              {loadingPills ? (
                <span className="text-xs text-muted-foreground">Loading…</span>
              ) : (
                items.map((it) => (
                  <Link
                    key={it.id}
                    href={`/profile/${encodeURIComponent(username)}/portfolios/edit`}
                    className="px-4 py-2 rounded-full text-sm inline-flex items-center gap-2 border text-emerald-300 border-emerald-500/40 hover:bg-white/5"
                  >
                    {(it.title || it.name || 'Untitled').toString()}
                  </Link>
                ))
              )}
              <span className="px-4 py-2 rounded-full border text-black bg-emerald-500 border-emerald-500 text-sm inline-flex items-center gap-2">
                <Plus className="h-4 w-4" /> New
              </span>
            </div>

            {/* Form */}
            {error && <div className="text-sm text-red-400 mb-3">{error}</div>}
            <div className="space-y-7">
              <div>
                <label className="block text-sm mb-2 text-emerald-400">Portfolio Title</label>
                <input
                  id="portfolio-title-input"
                  type="text"
                  placeholder="Enter portfolio title"
                  className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-2 text-emerald-400">Description (Optional)</label>
                <textarea
                  placeholder="Enter portfolio description"
                  rows={8}
                  className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-base"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-base disabled:opacity-60"
              >
                {saving ? 'Creating…' : 'Create Portfolio'}
              </button>
            </div>

            {/* Platforms Section */}
            <div className="mt-10">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-lg font-semibold">Platforms</h2>
                <span className="text-sm text-emerald-400">{addedCount || 0} Added</span>
              </div>

              {/* Add Platform Grid */}
              <div>
                <div className="text-sm text-muted-foreground mb-3">Add Platform</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {availablePlatforms.map((key) => {
                    const active = selectedPlatforms.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePlatform(key)}
                        className={`relative rounded-2xl border border-border bg-card/60 px-4 py-6 text-center hover:bg-card/80 transition ${active ? 'ring-1 ring-emerald-500/50' : ''}`}
                      >
                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
                          {PLATFORM_ICONS[key]}
                        </div>
                        <div className="text-sm font-medium">{PLATFORM_LABELS[key]}</div>
                        {active && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-emerald-500 text-black inline-flex items-center justify-center">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Current Platforms with links */}
              {selectedPlatforms.length > 0 && (
                <div className="mt-6">
                  <div className="text-sm text-muted-foreground mb-2">Selected Platforms</div>
                  <div className="flex flex-col gap-3">
                    {selectedPlatforms.map((key) => (
                      <div key={key} className="flex items-center gap-3 rounded-xl bg-card/70 border border-border px-3 py-2">
                        <span className="inline-flex items-center justify-center h-7 w-7 rounded bg-white/5">
                          {PLATFORM_ICONS[key]}
                        </span>
                        <span className="text-sm min-w-24">{PLATFORM_LABELS[key]}</span>
                        <input
                          type="url"
                          placeholder={`Enter ${PLATFORM_LABELS[key]} link`}
                          className="flex-1 px-3 py-2 rounded-lg bg-background/50 border border-border focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          value={platformLinks[key] || ''}
                          onChange={(e) => setPlatformLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
