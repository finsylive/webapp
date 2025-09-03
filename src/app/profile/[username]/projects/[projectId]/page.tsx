"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Pencil, Rocket, Calendar, ExternalLink, Trash2, BadgeCheck } from 'lucide-react';
import { getProject, deleteProject as apiDeleteProject } from '@/api/projects';

export default function ProjectViewPage({ params }: { params: Promise<{ username: string; projectId: string }> }) {
  const { username, projectId } = use(params);

  type ProjectItem = {
    id: string;
    title?: string | null;
    name?: string | null;
    tagline?: string | null;
    description?: string | null;
    category?: string | null;
    status?: string | null;
    url?: string | null;
    created_at?: string | null;
    visibility?: string | null;
  };

  const [item, setItem] = useState<ProjectItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState<{ user: { avatar_url?: string | null; full_name?: string | null; username: string; is_verified?: boolean | null } } | null>(null);

  const ensureProtocol = (url?: string | null) => {
    if (!url) return null;
    const t = url.trim();
    if (!t) return null;
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const [projResp, resProfile] = await Promise.all([
          getProject(username, projectId),
          fetch(`/api/users/${encodeURIComponent(username)}/profile`),
        ]);
        const pjson = await resProfile.json().catch(() => null);
        if (!cancelled) {
          setItem((projResp as any)?.data ?? null);
          if (pjson && pjson.data) setProfile(pjson.data);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load project');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (username && projectId) run();
    return () => {
      cancelled = true;
    };
  }, [username, projectId]);

  const dateStr = useMemo(() => {
    if (!item?.created_at) return '';
    const d = new Date(item.created_at);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }, [item?.created_at]);

  const imageUrl = useMemo(() => {
    if (!item) return null as string | null;
    const anyItem = item as any;
    return (
      anyItem.image_url ||
      anyItem.thumbnail ||
      anyItem.thumbnail_url ||
      anyItem.logo_url ||
      anyItem.cover_url ||
      null
    );
  }, [item]);

  const onDelete = async () => {
    if (!item || deleting) return;
    const ok = window.confirm('Delete this project? This cannot be undone.');
    if (!ok) return;
    try {
      setDeleting(true);
      await apiDeleteProject(username, projectId);
      window.location.href = `/profile/${encodeURIComponent(username)}/projects`;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 w-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto w-full">
          {/* Top controls */}
          <div className="flex items-center justify-between mb-6">
            <Link href={`/profile/${encodeURIComponent(username)}/projects`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5 mr-1" /> Back
            </Link>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Link href={`/profile/${encodeURIComponent(username)}/projects`} className="p-2 rounded-lg hover:bg-white/5" title="Edit Project">
                <Pencil className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : error ? (
            <div className="text-sm text-red-400">{error}</div>
          ) : !item ? (
            <div className="text-sm text-muted-foreground">Project not found.</div>
          ) : (
            <div className="space-y-6">
              {/* Hero image or icon */}
              <div className="h-40 rounded-2xl bg-gradient-to-b from-emerald-900/30 to-transparent border border-emerald-500/20 flex items-center justify-center overflow-hidden">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={(item.title || item.name || 'project').toString()} className="h-full object-contain" />
                ) : (
                  <Rocket className="h-16 w-16 text-emerald-400/80" />
                )}
              </div>

              {/* Title label */}
              <div>
                <span className="inline-flex px-3 py-1 rounded-xl bg-black/50 border border-emerald-500/30 text-emerald-200 text-sm">{(item.title || item.name || 'Untitled').toString().slice(0, 24)}</span>
              </div>

              {/* Title and description */}
              <div>
                <div className="flex items-center gap-3">
                  {imageUrl && (
                    <div className="h-10 w-10 rounded-xl overflow-hidden border border-emerald-500/30 bg-black/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt={(item.title || item.name || 'project').toString()} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <h1 className="text-2xl font-semibold">{item.title || item.name || 'Untitled'}</h1>
                </div>
                {item.tagline || item.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">{item.tagline || item.description}</p>
                ) : null}
                {item.category && (
                  <div className="mt-2 text-emerald-400 text-sm">{item.category}</div>
                )}
                {item.url && (
                  <a href={ensureProtocol(item.url) || '#'} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    Visit <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>

              {/* Owner card */}
              <div className="rounded-2xl bg-card/60 border border-emerald-500/20 p-4">
                <div className="flex items-center gap-3">
                  {profile?.user?.avatar_url ? (
                    <div className="h-10 w-10 rounded-full overflow-hidden border border-emerald-500/30 bg-black/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={profile.user.avatar_url} alt={profile.user.full_name || profile.user.username} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-semibold">
                      {username?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1">
                      <Link href={`/profile/${encodeURIComponent(username)}`} className="text-emerald-300 hover:text-emerald-200 underline text-sm">
                        {profile?.user?.full_name || username}
                      </Link>
                      {profile?.user?.is_verified ? <BadgeCheck className="h-4 w-4 text-emerald-400" /> : null}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>Created</span>
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{dateStr}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Owner actions */}
              <div className="rounded-2xl bg-card/60 border border-border p-4">
                <div className="text-sm font-medium mb-3">Owner Actions</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Link href={`/profile/${encodeURIComponent(username)}/projects`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 px-4 py-2 text-sm">
                    <Pencil className="h-4 w-4" /> Edit Project
                  </Link>
                  <button onClick={onDelete} disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 px-4 py-2 text-sm disabled:opacity-60">
                    <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : 'Delete Project'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
