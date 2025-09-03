"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { ArrowLeft, Plus, Trash2, Eye, Check, Pencil } from 'lucide-react';
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
import Link from 'next/link';

export default function EditPortfolioPage() {
  const params = useParams() as { username?: string };
  const username = (params?.username || '').toString();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [nameSelected, setNameSelected] = useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type PortfolioItem = {
    id: string;
    title?: string | null;
    name?: string | null;
    summary?: string | null;
    description?: string | null;
    platforms?: string[] | null;
    platforms_links?: { platform: string; link?: string | null }[] | null;
  };

  const handleDelete = async () => {
    if (deleting) return;
    const confirm = window.confirm('Delete your latest portfolio? This cannot be undone.');
    if (!confirm) return;
    try {
      setDeleting(true);
      const latestId = items?.[0]?.id;
      const url = latestId
        ? `/api/users/${encodeURIComponent(username)}/portfolios?id=${encodeURIComponent(latestId)}`
        : `/api/users/${encodeURIComponent(username)}/portfolios`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      // Refresh local state and go to preview
      await loadPortfolios();
      router.push(`/profile/${encodeURIComponent(username)}/portfolios`);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };
  const [items, setItems] = useState<PortfolioItem[]>([]);

  type PlatformKey = 'github' | 'figma' | 'dribbble' | 'behance' | 'linkedin' | 'youtube' | 'notion' | 'substack' | 'custom';
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
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKey[]>([]);
  const [platformLinks, setPlatformLinks] = useState<Record<PlatformKey, string>>({} as any);
  const addedCount = selectedPlatforms.length;
  const availablePlatforms = useMemo<PlatformKey[]>(() => Object.keys(PLATFORM_LABELS) as PlatformKey[], []);

  // Ensure URLs are absolute with protocol to avoid privacy/mixed-content issues
  const ensureProtocol = (url?: string | null) => {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: title?.trim() || null,
        description: description?.trim() || null,
        platforms: selectedPlatforms.map((k) => ({ platform: k, link: ensureProtocol(platformLinks[k]) || null })),
      };
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/portfolios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save portfolio');
      await loadPortfolios();
      router.push(`/profile/${encodeURIComponent(username)}/portfolios`);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // shared loader that we can call on mount and on-demand
  const applyFromItem = (first: PortfolioItem) => {
    setTitle((first.title || first.name || '').toString());
    setDescription((first.summary || first.description || '').toString());
    // prefill platforms if provided by API (expects array of strings)
    if (Array.isArray(first.platforms)) {
      const normalized = first.platforms
        .map((p) => (typeof p === 'string' ? p.toLowerCase().trim() : ''))
        .filter(Boolean) as string[];
      const keys = normalized
        .map((p) => {
          if (p.includes('github')) return 'github';
          if (p.includes('figma')) return 'figma';
          if (p.includes('dribb')) return 'dribbble';
          if (p.includes('behance')) return 'behance';
          if (p.includes('linkedin') || p === 'linkedIn'.toLowerCase()) return 'linkedin';
          if (p.includes('youtube')) return 'youtube';
          if (p.includes('notion')) return 'notion';
          if (p.includes('substack')) return 'substack';
          return 'custom';
        }) as PlatformKey[];
      const uniq = Array.from(new Set(keys)) as PlatformKey[];
      setSelectedPlatforms(uniq.length > 0 ? [uniq[0]] : []);
      const links: Partial<Record<PlatformKey, string>> = {};
      if (Array.isArray(first.platforms_links)) {
        for (const r of first.platforms_links) {
          const k = (r.platform || '').toLowerCase() as PlatformKey;
          if ((availablePlatforms as string[]).includes(k)) {
            links[k] = (r.link || '').toString();
          }
        }
      }
      setPlatformLinks((prev) => ({ ...prev, ...links } as any));
    }
  };

  const loadPortfolios = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/portfolios`);
      if (!res.ok) throw new Error('Failed to load portfolios');
      const json = await res.json();
      const list: PortfolioItem[] = json?.data ?? [];
      setItems(list);
      const first = list[0];
      if (first) {
        setSelectedPortfolioId(first.id);
        applyFromItem(first);
      }
      return list;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load portfolios');
      return [] as PortfolioItem[];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled || !username) return;
      await loadPortfolios();
    };
    run();
    return () => { cancelled = true; };
  }, [username]);

  const handleSelectName = async () => {
    setTitle(username || '');
    setNameSelected(true);
    // On click, refetch all portfolios and reapply latest data
    await loadPortfolios();
  };

  const togglePlatform = (key: PlatformKey) => {
    setSelectedPlatforms((prev) => {
      if (prev[0] === key) {
        // deselect and clear link
        setPlatformLinks((pl) => {
          const { [key]: _, ...rest } = pl;
          return rest as Record<PlatformKey, string>;
        });
        return [];
      }
      // single select: replace with only this key
      return [key];
    });
  };

  return (
    <DashboardLayout>
      <div className="flex-1 w-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto w-full">
          <div className="bg-card/60 border border-border rounded-2xl shadow-sm p-8 sm:p-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
              <Link href={`/profile/${encodeURIComponent(username)}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5 mr-1" /> Back
              </Link>
              <h1 className="text-2xl font-semibold">Edit Portfolio</h1>
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
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-60"
                  title={deleting ? 'Deleting…' : 'Delete'}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Pills: show portfolio titles and New */}
            <div className="flex items-center gap-3 mb-8 flex-wrap">
              {items.map((it) => {
                const label = (it.title || it.name || 'Untitled').toString();
                const active = selectedPortfolioId === it.id;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      setSelectedPortfolioId(it.id);
                      applyFromItem(it);
                      setNameSelected(false);
                    }}
                    className={`px-4 py-2 rounded-full text-sm inline-flex items-center gap-2 border ${
                      active ? 'bg-emerald-500 text-black border-emerald-500' : 'text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => router.push(`/profile/${encodeURIComponent(username)}/portfolios/create`)}
                className="px-4 py-2 rounded-full border border-emerald-500/40 text-emerald-300 text-sm inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> New
              </button>
            </div>

            {/* Form */}
            <div className="space-y-7">
              {loading && (
                <div className="text-sm text-muted-foreground">Loading portfolio…</div>
              )}
              {error && (
                <div className="text-sm text-red-400">{error}</div>
              )}
              <div>
                <label className="block text-sm mb-2 text-emerald-400">Portfolio Title</label>
                <input
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
                onClick={handleSave}
                disabled={saving}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-base disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Portfolio'}
              </button>
            </div>

            {/* Platforms Section */}
            <div className="mt-10">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-lg font-semibold">Platforms</h2>
                <span className="text-sm text-emerald-400">{addedCount || 0} Added</span>
              </div>

              {/* Current Platforms */}
              <div className="mb-5">
                <div className="text-sm text-muted-foreground mb-2">Current Platforms</div>
                {selectedPlatforms.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No platforms added.</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {selectedPlatforms.map((key) => (
                      <div key={key} className="flex items-center gap-3 rounded-xl bg-card/70 border border-border px-3 py-2">
                        <span className="inline-flex items-center justify-center h-7 w-7 rounded bg-white/5">{PLATFORM_ICONS[key]}</span>
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
                )}
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
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
