"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCcw, Calendar, Rocket, BadgeCheck } from 'lucide-react';
import { listProjects } from '@/api/projects';

export default function UserProjectsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  type ProjectItem = {
    id: string;
    title?: string | null;
    name?: string | null;
    tagline?: string | null;
    description?: string | null;
    status?: string | null;
    url?: string | null;
    created_at?: string | null;
    visibility?: string | null;
  };
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<{ user: { avatar_url?: string | null; full_name?: string | null; username: string; is_verified?: boolean | null }; counts?: { projects?: number } } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const [projectsResp, resProfile] = await Promise.all([
          listProjects(username),
          fetch(`/api/users/${encodeURIComponent(username)}/profile`),
        ]);
        const pjson = await resProfile.json().catch(() => null);
        if (!cancelled) {
          setItems((projectsResp as any)?.data ?? []);
          if (pjson && pjson.data) setProfile(pjson.data);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load projects';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (username) run();
    return () => { cancelled = true; };
  }, [username]);

  const countLabel = useMemo(() => {
    const c = profile?.counts?.projects ?? items.length;
    return `${c} Project${c === 1 ? '' : 's'}`;
  }, [profile?.counts?.projects, items.length]);

  const ensureProtocol = (url?: string | null) => {
    if (!url) return null;
    const t = url.trim();
    if (!t) return null;
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  };

  const refetch = async () => {
    if (refreshing) return;
    try {
      setRefreshing(true);
      setError(null);
      const resp = await listProjects(username);
      setItems((resp as any)?.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 w-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto w-full">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href={`/profile/${encodeURIComponent(username)}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5 mr-1" /> Back
              </Link>
              <h1 className="text-2xl font-semibold">Projects</h1>
            </div>
            <button onClick={refetch} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground" title="Refresh" aria-label="Refresh projects">
              <RefreshCcw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Profile Row */}
          <div className="flex items-center gap-4 mb-6">
            {profile?.user?.avatar_url ? (
              <div className="h-12 w-12 rounded-full overflow-hidden border border-emerald-500/30 bg-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={profile.user.avatar_url} alt={profile.user.full_name || profile.user.username} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-semibold">
                {username?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{profile?.user?.full_name || username}</span>
                {profile?.user?.is_verified ? <BadgeCheck className="h-4 w-4 text-emerald-400" /> : null}
              </div>
              <div className="text-sm text-muted-foreground">{countLabel}</div>
            </div>
          </div>

          {/* Showcase */}
          <div className="mb-3">
            <h2 className="text-emerald-400 text-lg font-semibold">Showcase</h2>
            <p className="text-sm text-muted-foreground">Explore {username}&apos;s creative projects</p>
          </div>

          {/* Content */}
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="text-sm text-red-400">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No projects yet.</div>
          ) : (
            <ul className="grid grid-cols-1 gap-5">
              {items.map((p) => {
                const href = ensureProtocol(p.url);
                const date = p.created_at ? new Date(p.created_at) : null;
                const dateStr = date ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
                const visibility = (p.visibility || 'public').toLowerCase();
                const viewHref = `/profile/${encodeURIComponent(username)}/projects/${encodeURIComponent(p.id)}`;
                const imgUrl = (p as any).image_url || (p as any).thumbnail || (p as any).thumbnail_url || (p as any).logo_url || (p as any).cover_url || null;
                const category = (p as any).category as string | undefined;
                return (
                  <li key={p.id} className="relative rounded-2xl border border-emerald-500/20 bg-card/60 overflow-hidden">
                    <Link href={viewHref} className="absolute inset-0" aria-label="Open project" />
                    <div className="p-5">
                      <div className="flex items-start justify-between">
                        {/* Image or icon tile */}
                        {imgUrl ? (
                          <div className="h-20 w-20 rounded-xl overflow-hidden border border-emerald-500/30 mr-4 bg-white/5 p-1 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imgUrl as string} alt={(p.title || p.name || 'project').toString()} className="h-full w-full object-contain" />
                          </div>
                        ) : (
                          <div className="h-20 w-20 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center text-emerald-400 mr-4">
                            <Rocket className="h-8 w-8" />
                          </div>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          {category && (
                            <span className="text-xs rounded-full border border-emerald-500/40 text-emerald-300 px-2 py-0.5">{category}</span>
                          )}
                          {p.status && (
                            <span className="text-xs rounded-full border border-emerald-500/40 text-emerald-300 px-2 py-0.5">{p.status}</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-xl font-semibold">{p.title || p.name || 'Untitled'}</div>
                        {(p.tagline || p.description) && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.tagline || p.description}</p>
                        )}
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{dateStr}</span>
                        </div>
                        <span className={`text-xs rounded-full px-2 py-0.5 border ${visibility === 'public' ? 'border-emerald-500/40 text-emerald-300' : 'border-yellow-500/40 text-yellow-300'}`}>
                          {visibility}
                        </span>
                      </div>
                      {href && (
                        <a href={href} target="_blank" rel="noreferrer" className="relative mt-3 inline-block text-sm text-primary hover:underline">Visit</a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
