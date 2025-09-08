"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import Image from 'next/image';
import { use, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCcw, BadgeCheck } from 'lucide-react';
import { listProjects } from '@/api/projects';
import { ProjectCard, ProjectCardSkeleton } from '@/components/projects/ProjectCard';
import { toProxyUrl } from '@/utils/imageUtils';

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
    image_url?: string | null;
    thumbnail?: string | null;
    thumbnail_url?: string | null;
    logo_url?: string | null;
    cover_url?: string | null;
    category?: string | null;
  };

  type ProjectsResponse = {
    data: ProjectItem[];
  };
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<{ user: { avatar_url?: string | null; full_name?: string | null; username: string; is_verified?: boolean | null }; counts?: { projects?: number } } | null>(null);
  const [environments, setEnvironments] = useState<Array<{ id: string; name: string }>>([]);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const [projectsResp, resProfile, envRes] = await Promise.all([
          listProjects(username),
          fetch(`/api/users/${encodeURIComponent(username)}/profile`),
          fetch('/api/environments').then(r=>r.ok?r.json():[]).catch(()=>[]),
        ]);
        const pjson = await resProfile.json().catch(() => null);
        if (!cancelled) {
          setItems((projectsResp as ProjectsResponse)?.data ?? []);
          if (pjson && pjson.data) setProfile(pjson.data);
          try {
            const envList = Array.isArray(envRes) ? envRes : [];
            setEnvironments(envList.map((e:any)=>({ id: e.id, name: e.name })));
          } catch {}
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

  // kept here if needed elsewhere in the page later
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
      setItems((resp as ProjectsResponse)?.data ?? []);
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
            {profile?.user?.avatar_url && !avatarError ? (
              <div className="relative h-12 w-12 rounded-full overflow-hidden border border-emerald-500/30 bg-black/20">
                <Image src={toProxyUrl(profile.user.avatar_url)} alt={profile.user.full_name || profile.user.username} fill className="object-cover" sizes="48px" onError={() => setAvatarError(true)} />
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
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </ul>
          ) : error ? (
            <div className="text-sm text-red-400">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No projects yet.</div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {items.map((p) => {
                const envName = environments.find(e=> e.id === (p.category || ''))?.name;
                return (
                  <ProjectCard key={p.id} item={p} username={username} categoryName={envName} />
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
