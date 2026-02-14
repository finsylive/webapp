"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';
import { ArrowLeft, Share2, Trophy, Users, Clock, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { toProxyUrl } from '@/utils/imageUtils';
import { supabase } from '@/utils/supabase';

type Competition = {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  created_by: string;
  is_external: boolean;
  external_url: string | null;
  created_at: string;
  has_leaderboard: boolean;
  prize_pool: string | null;
  banner_image_url: string | null;
};

type CompetitionEntry = {
  competition_id: string;
  project_id: string | null;
  submitted_by: string;
  created_at: string;
  external_entry_url: string | null;
};

type ProjectLite = {
  id: string;
  title: string;
  tagline: string | null;
  logo_url: string | null;
  cover_url: string | null;
};

function isEnded(c?: { deadline?: string | null }) {
  if (!c?.deadline) return false;
  const t = Date.parse(c.deadline);
  return isFinite(t) && t < Date.now();
}

function resolveBannerUrl(raw?: string | null): string | null {
  if (!raw) return null;
  // Handle s3://bucket/key form
  if (raw.startsWith('s3://')) {
    const withoutScheme = raw.slice('s3://'.length);
    const slashIdx = withoutScheme.indexOf('/');
    if (slashIdx > 0) {
      const bucket = withoutScheme.slice(0, slashIdx);
      const key = withoutScheme.slice(slashIdx + 1);
      return toProxyUrl(`https://${bucket}.s3.amazonaws.com/${key}`);
    }
  }
  if (/^https?:\/\//i.test(raw)) return toProxyUrl(raw);

  // Try as-is in common buckets
  const buckets = ['media', 'public', 'banners', 'images'];
  for (const bucket of buckets) {
    try {
      // If the path includes the bucket prefix (e.g. "public/xyz.jpg"), strip it
      const path = raw.startsWith(bucket + '/') ? raw.slice(bucket.length + 1) : raw;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (data?.publicUrl) return toProxyUrl(data.publicUrl);
    } catch {}
  }

  // If it's a full path like "/storage/v1/object/public/<bucket>/path.jpg"
  if (raw.startsWith('/storage/v1/object/public/')) {
    const full = `${location.origin}${raw}`;
    return toProxyUrl(full);
  }

  return null;
}

export default function CompetitionDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [comp, setComp] = useState<Competition | null>(null);
  const [participants, setParticipants] = useState(0);
  const [entries, setEntries] = useState<(CompetitionEntry & { project?: ProjectLite | null; username?: string | null })[]>([]);
  const [aboutOpen, setAboutOpen] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [compRes, entriesRes] = await Promise.all([
          fetch(`/api/competitions/${encodeURIComponent(id)}`, { cache: 'no-store' }),
          fetch(`/api/competitions/${encodeURIComponent(id)}/entries`, { cache: 'no-store' }),
        ]);
        const compJson = await compRes.json();
        const entriesJson = await entriesRes.json();
        if (cancelled) return;
        setComp(compJson.data || null);
        setParticipants(compJson.participants || 0);

        const baseEntries: CompetitionEntry[] = Array.isArray(entriesJson.data) ? entriesJson.data : [];
        // Fetch project details for entries using the username-based API
        const usernameCache = new Map<string, string | null>(); // submitted_by -> username
        const projectCache = new Map<string, ProjectLite | null>(); // project_id -> project lite

        async function getUsernameById(userId: string): Promise<string | null> {
          if (usernameCache.has(userId)) return usernameCache.get(userId)!;
          try {
            const res = await fetch(`/api/users/by-id/${encodeURIComponent(userId)}`, { cache: 'no-store' });
            const json = await res.json();
            const uname = json?.data?.username ? String(json.data.username) : null;
            usernameCache.set(userId, uname);
            return uname;
          } catch {
            usernameCache.set(userId, null);
            return null;
          }
        }

        async function getProjectByUsername(uname: string, projectId: string): Promise<ProjectLite | null> {
          const cacheKey = `${uname}:${projectId}`;
          if (projectCache.has(cacheKey)) return projectCache.get(cacheKey)!;
          try {
            const r = await fetch(`/api/users/${encodeURIComponent(uname)}/projects/${encodeURIComponent(projectId)}`, { cache: 'no-store' });
            const j = await r.json();
            const p = j?.data as ProjectLite | undefined;
            const out = p ? {
              id: p.id,
              title: p.title,
              tagline: p.tagline ?? null,
              logo_url: p.logo_url ?? null,
              cover_url: p.cover_url ?? null,
            } : null;
            projectCache.set(cacheKey, out);
            return out;
          } catch {
            projectCache.set(cacheKey, null);
            return null;
          }
        }

        const hydrated = await Promise.all(baseEntries.map(async (e) => {
          if (!e.project_id) return { ...e, project: null, username: await getUsernameById(e.submitted_by) };
          const uname = await getUsernameById(e.submitted_by);
          if (!uname) return { ...e, project: null, username: null };
          const proj = await getProjectByUsername(uname, e.project_id);
          return { ...e, project: proj, username: uname };
        }));
        setEntries(hydrated);
      } catch (e) {
        console.error('Failed to load competition details', e);
        if (!cancelled) {
          setComp(null);
          setParticipants(0);
          setEntries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const bannerUrl = useMemo(() => resolveBannerUrl(comp?.banner_image_url), [comp?.banner_image_url]);
  const ended = comp ? isEnded(comp) : false;

  const share = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      navigator.share({ title: comp?.title || 'Competition', url }).catch(() => {});
    } else if (url) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col flex-1 w-full h-full min-h-[calc(100vh-4rem)] py-4 md:py-6 px-4 sm:px-6 lg:px-8">
        {/* Header actions */}
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" className="rounded-xl bg-accent/30 hover:bg-accent/60 border border-border/50" onClick={() => router.back()} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="rounded-xl bg-accent/30 hover:bg-accent/60 border border-border/50" onClick={share} aria-label="Share">
            <Share2 className="h-5 w-5" />
          </Button>
        </div>

        {/* Banner */}
        <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-[160px] md:min-h-[220px]">
          {bannerUrl && (
            <Image src={bannerUrl} alt={comp?.title || 'Cover'} fill className="object-cover" priority sizes="(max-width: 768px) 100vw, 1024px" />
          )}
          <div className="absolute inset-0 bg-black/35" />
          <div className="relative p-5 md:p-8">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white drop-shadow max-w-3xl">{comp?.title || (loading ? 'Loading…' : 'Competition')}</h1>
          </div>
        </div>

        {/* Stats & CTA */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full border ${ended ? 'text-amber-600 dark:text-amber-300 bg-amber-400/10 border-amber-500/30 dark:border-amber-400/30' : 'text-emerald-700 dark:text-emerald-600 dark:text-emerald-300 bg-emerald-400/10 border-emerald-500/30 dark:border-emerald-400/30'}`}>
              {ended ? 'Ended' : 'Open'}
            </span>
            {comp?.prize_pool && (
              <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-card/70 border border-border/60">
                <Trophy className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                <span className="text-emerald-600 dark:text-emerald-300 font-bold">{comp.prize_pool}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-card/70 border border-border/60">
              <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              <span>Participants: {participants}</span>
            </span>
            <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-card/70 border border-border/60">
              <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              <span>{comp?.deadline ? format(new Date(comp.deadline), 'dd MMM, yyyy') : 'No deadline'}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {comp?.is_external && comp.external_url ? (
              <a
                href={comp.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500/90 dark:hover:bg-emerald-500 text-white font-semibold px-5 py-3 transition active:scale-95 border border-emerald-400/40"
              >
                Join Competition
              </a>
            ) : (
              <button
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500/90 dark:hover:bg-emerald-500 text-white font-semibold px-5 py-3 transition active:scale-95 border border-emerald-400/40"
                disabled
                title="Joining via internal projects coming soon"
              >
                Join Competition
              </button>
            )}
          </div>
        </div>

        {/* About */}
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/70 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold"
            onClick={() => setAboutOpen(o => !o)}
          >
            <span>About this competition</span>
            <ChevronDown className={`h-5 w-5 transition-transform ${aboutOpen ? 'rotate-180' : ''}`} />
          </button>
          {aboutOpen && (
            <div className="px-5 pb-5 text-muted-foreground whitespace-pre-wrap">
              {comp?.description || 'No description provided.'}
            </div>
          )}
        </div>

        {/* Entries */}
        <div className="mt-6">
          <h3 className="text-lg md:text-xl font-bold">Entries ({participants})</h3>
          <div className="mt-4 grid gap-3">
            {loading ? (
              <>
                <div className="h-20 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                <div className="h-20 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
              </>
            ) : entries.length === 0 ? (
              <div className="text-sm text-muted-foreground">No entries yet.</div>
            ) : (
              entries.map((e) => {
                const p = e.project;
                return (
                  <div key={`${e.competition_id}-${e.submitted_by}-${e.created_at}`} className="rounded-2xl bg-card/70 border border-border/60 p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Project avatar */}
                      {p?.logo_url ? (
                        <Image src={toProxyUrl(p.logo_url)} alt={p.title} width={44} height={44} className="h-11 w-11 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-11 w-11 rounded-xl bg-muted/40 flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">{p ? p.title.charAt(0) : '•'}</div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{p ? p.title : (e.project_id ? 'Project Submission' : 'External Entry')}</div>
                        <div className="text-sm text-muted-foreground truncate">{p?.tagline || (e.external_entry_url ?? `Project ID: ${e.project_id}`)}</div>
                      </div>
                    </div>
                    {e.external_entry_url ? (
                      <a href={e.external_entry_url} target="_blank" rel="noopener noreferrer" className="rounded-xl px-3 py-2 text-sm font-semibold border border-border/60 hover:bg-accent/60">View</a>
                    ) : p ? (
                      e.username ? (
                        <a href={`/profile/${encodeURIComponent(e.username)}/projects/${encodeURIComponent(p.id)}`} className="rounded-xl px-3 py-2 text-sm font-semibold border border-border/60 hover:bg-accent/60">View</a>
                      ) : (
                        <a href={`/projects/${encodeURIComponent(p.id)}`} className="rounded-xl px-3 py-2 text-sm font-semibold border border-border/60 hover:bg-accent/60">View</a>
                      )
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
