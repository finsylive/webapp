"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Pencil, Trash2, Share2 } from 'lucide-react';
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
  github: <SiGithub size={24} className="text-emerald-300" />,
  figma: <SiFigma size={24} className="text-emerald-300" />,
  dribbble: <SiDribbble size={24} className="text-emerald-300" />,
  behance: <SiBehance size={24} className="text-emerald-300" />,
  linkedin: <SiLinkedin size={24} className="text-emerald-300" />,
  youtube: <SiYoutube size={24} className="text-emerald-300" />,
  notion: <SiNotion size={24} className="text-emerald-300" />,
  substack: <SiSubstack size={24} className="text-emerald-300" />,
  custom: <SiGithub size={24} className="text-emerald-300" />,
};

export default function UserPortfoliosPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);

  type PlatformLinkRow = { platform: PlatformKey; link?: string | null };
  type PortfolioItem = {
    id: string;
    title?: string | null;
    description?: string | null;
    platforms?: PlatformKey[];
    platforms_links?: PlatformLinkRow[];
  };

  const handleDelete = async () => {
    if (deleting || loading) return;
    if (!latest) return;
    const ok = window.confirm('Delete your latest portfolio? This cannot be undone.');
    if (!ok) return;
    try {
      setDeleting(true);
      const url = `/api/users/${encodeURIComponent(username)}/portfolios?id=${encodeURIComponent(latest.id)}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete portfolio');
      // reload list
      setLoading(true);
      const r2 = await fetch(`/api/users/${encodeURIComponent(username)}/portfolios`);
      const j2 = await r2.json().catch(() => ({ data: [] }));
      setItems(Array.isArray(j2?.data) ? j2.data : []);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
      setLoading(false);
    }
  };

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/users/${encodeURIComponent(username)}/portfolios`);
        if (!res.ok) throw new Error('Failed to load portfolios');
        const json = await res.json();
        if (!cancelled) setItems(Array.isArray(json?.data) ? json.data : []);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load portfolios';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (username) run();
    return () => { cancelled = true; };
  }, [username]);

  const latest = useMemo(() => items[0] || null, [items]);
  const firstPlatformKey: PlatformKey | null = useMemo(() => {
    const k = (latest?.platforms?.[0] || null) as PlatformKey | null;
    return k || null;
  }, [latest]);
  const firstPlatformLink = useMemo(() => {
    if (!firstPlatformKey) return null;
    const match = latest?.platforms_links?.find((p) => (p.platform as string) === firstPlatformKey);
    return match?.link || null;
  }, [latest, firstPlatformKey]);

  const platformCount = latest?.platforms?.length || 0;

  // Ensure URL has protocol to avoid browser privacy/mixed-content issues
  const ensureProtocol = (url?: string | null) => {
    if (!url) return null;
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    // Add https by default
    return `https://${trimmed}`;
  };

  return (
    <DashboardLayout>
      <div className="flex-1 w-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href={`/profile/${encodeURIComponent(username)}`} className="p-2 rounded-lg hover:bg-white/5">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-2xl font-semibold">{latest?.title || 'Portfolio'}</h1>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Link href={`/profile/${encodeURIComponent(username)}/portfolios/edit`} className="p-2 rounded-lg hover:bg-white/5" title="Edit">
                <Pencil className="h-5 w-5" />
              </Link>
              <button
                className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-60"
                title={deleting ? 'Deleting…' : 'Delete'}
                onClick={handleDelete}
                disabled={deleting || loading || !latest}
              >
                <Trash2 className="h-5 w-5" />
              </button>
              <button className="p-2 rounded-lg hover:bg-white/5" title="Share" onClick={() => navigator.share?.({ title: 'Portfolio', url: location.href }).catch(() => {})}>
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="text-sm text-red-400">{error}</div>
          ) : !latest ? (
            <div className="text-sm text-muted-foreground">No portfolios yet.</div>
          ) : (
            <div className="space-y-8">
              {/* Summary */}
              {latest?.description && (
                <p className="text-muted-foreground">{latest.description}</p>
              )}

              {/* Count pill */}
              <div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-900/20 text-emerald-400 border border-emerald-700/30">
                  {platformCount} {platformCount === 1 ? 'Platform' : 'Platforms'}
                </span>
              </div>

              {/* Platform Links */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Platform Links</h2>
                {!firstPlatformKey ? (
                  <div className="text-sm text-muted-foreground">No platform added.</div>
                ) : (
                  <div className="max-w-sm">
                    <div className="rounded-2xl border border-border bg-card/60 p-5">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center">
                          {PLATFORM_ICONS[firstPlatformKey]}
                        </div>
                        <div className="text-base font-medium">{PLATFORM_LABELS[firstPlatformKey]}</div>
                      </div>
                      {firstPlatformLink && (
                        <div className="text-xs text-muted-foreground mb-3 truncate">{firstPlatformLink}</div>
                      )}
                      {firstPlatformLink ? (
                        <a
                          href={ensureProtocol(firstPlatformLink) || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs bg-white/5 hover:bg-white/10 border border-border"
                        >
                          Tap to view
                        </a>
                      ) : (
                        <Link
                          href={`/profile/${encodeURIComponent(username)}/portfolios/edit`}
                          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs bg-white/5 hover:bg-white/10 border border-border"
                        >
                          Add link
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
