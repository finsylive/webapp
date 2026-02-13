"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import Image from 'next/image';
import { use, useEffect, useMemo, useState, useCallback } from 'react';
import { ArrowLeft, Pencil, Rocket, Calendar, ExternalLink, Trash2, BadgeCheck, Images, ZoomIn } from 'lucide-react';
import { getProject, deleteProject as apiDeleteProject, listProjectSlides, listProjectTextSections, type ProjectSlide, type ProjectTextSection } from '@/api/projects';
import { toProxyUrl } from '@/utils/imageUtils';
import { useUserData } from '@/hooks/useUserData';

export default function ProjectViewPage({ params }: { params: Promise<{ username: string; projectId: string }> }) {
  const { username, projectId } = use(params);

  type ProjectItem = {
    id: string;
    title?: string | null;
    name?: string | null;
    tagline?: string | null;
    description?: string | null;
    category?: string | null;
    category_id?: string | null;
    status?: string | null;
    url?: string | null;
    created_at?: string | null;
    visibility?: string | null;
    image_url?: string | null;
    thumbnail?: string | null;
    thumbnail_url?: string | null;
    logo_url?: string | null;
    cover_url?: string | null;
  };

  

  type ProjectResponse = {
    data: ProjectItem | null;
  };

  const [item, setItem] = useState<ProjectItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState<{ user: { avatar_url?: string | null; full_name?: string | null; username: string; is_verified?: boolean | null } } | null>(null);
  const [slides, setSlides] = useState<ProjectSlide[]>([]);
  const [sections, setSections] = useState<ProjectTextSection[]>([]);
  const [environments, setEnvironments] = useState<Array<{ id: string; name: string }>>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const { userData } = useUserData();
  const isOwner = userData?.username?.toLowerCase() === username?.toLowerCase();

  // Lightbox controls (defined after slides state)
  const openLightbox = useCallback((idx: number) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);
  const prevLightbox = useCallback(() => {
    setLightboxIndex((i) => (slides.length ? (i - 1 + slides.length) % slides.length : 0));
  }, [slides.length]);
  const nextLightbox = useCallback(() => {
    setLightboxIndex((i) => (slides.length ? (i + 1) % slides.length : 0));
  }, [slides.length]);

  // Keybindings for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevLightbox();
      if (e.key === 'ArrowRight') nextLightbox();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, closeLightbox, prevLightbox, nextLightbox]);

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
        const [projResp, resProfile, slidesResp, sectionsResp, envRes] = await Promise.all([
          getProject(username, projectId),
          fetch(`/api/users/${encodeURIComponent(username)}/profile`),
          listProjectSlides(username, projectId).catch(() => ({ data: [] } as { data: ProjectSlide[] })),
          listProjectTextSections(username, projectId).catch(() => ({ data: [] } as { data: ProjectTextSection[] })),
          fetch('/api/environments').then(r=>r.ok?r.json():[]).catch(()=>[]),
        ]);
        const pjson = await resProfile.json().catch(() => null);
        if (!cancelled) {
          setItem((projResp as ProjectResponse)?.data ?? null);
          if (pjson && pjson.data) setProfile(pjson.data);
          setSlides((slidesResp as { data: ProjectSlide[] })?.data || []);
          setSections((sectionsResp as { data: ProjectTextSection[] })?.data || []);
          try {
            const envList = Array.isArray(envRes) ? envRes : [];
            setEnvironments(
              envList
                .filter((e: unknown): e is { id: string; name: string } => {
                  if (typeof e !== 'object' || e === null) return false;
                  const maybe = e as { id?: unknown; name?: unknown };
                  return typeof maybe.id === 'string' && typeof maybe.name === 'string';
                })
                .map((e) => ({ id: e.id, name: e.name }))
            );
          } catch {}
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
    return (
      item.cover_url ||
      item.image_url ||
      item.thumbnail ||
      item.thumbnail_url ||
      item.logo_url ||
      null
    );
  }, [item]);

  const logoUrl = useMemo(() => {
    if (!item) return null as string | null;
    return item.logo_url || item.thumbnail || item.thumbnail_url || item.image_url || null;
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
            {isOwner && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Link href={`/profile/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/edit`} className="p-2 rounded-lg hover:bg-white/5" title="Edit Project">
                  <Pencil className="h-5 w-5" />
                </Link>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : error ? (
            <div className="text-sm text-red-400">{error}</div>
          ) : !item ? (
            <div className="text-sm text-muted-foreground">Project not found.</div>
          ) : (
            <div className="space-y-6">
              {/* Hero - cover with overlay actions and title chip */}
              <div className="relative h-60 sm:h-72 rounded-2xl bg-gradient-to-b from-emerald-900/30 to-transparent border border-emerald-500/20 overflow-hidden">
                {imageUrl ? (
                  <Image
                    src={toProxyUrl(imageUrl)}
                    alt={(item.title || item.name || 'project').toString()}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 1024px"
                    priority={false}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Rocket className="h-16 w-16 text-emerald-400/80" />
                  </div>
                )}

                {/* Floating actions */}
                <div className="absolute top-3 left-3 flex gap-2">
                  <Link href={`/profile/${encodeURIComponent(username)}/projects`} className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-black/50 hover:bg-black/60 border border-white/10 text-white/90">
                    <ArrowLeft className="h-5 w-5" />
                  </Link>
                </div>
                {isOwner && (
                  <div className="absolute top-3 right-3 flex gap-2">
                    <Link href={`/profile/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/edit`} className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-black/50 hover:bg-black/60 border border-white/10 text-white/90" title="Edit">
                      <Pencil className="h-5 w-5" />
                    </Link>
                  </div>
                )}

                {/* Title chip */}
                <div className="absolute left-3 bottom-3">
                  <span className="inline-flex px-3 py-1 rounded-xl bg-black/60 border border-white/15 text-white text-base font-semibold shadow-md">
                    {(item.title || item.name || 'Untitled').toString().slice(0, 36)}
                  </span>
                </div>
              </div>

              {/* Summary below hero */}
              <div className="">
                <div className="flex items-start gap-3">
                  {/* Logo on white tile */}
                  <div className="relative h-12 w-12 rounded-xl border border-emerald-500/30 bg-white/90 p-1 overflow-hidden">
                    {logoUrl ? (
                      <Image src={toProxyUrl(logoUrl)} alt={(item.title || item.name || 'project').toString()} fill className="object-contain" sizes="48px" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Rocket className="h-6 w-6 text-emerald-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl font-semibold">{item.title || item.name || 'Untitled'}</h1>
                    {item.tagline || item.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.tagline || item.description}
                      </p>
                    ) : null}
                    {(item.category || item.category_id) && (
                      <div className="mt-1 text-emerald-400 text-sm">
                        {environments.find(e=> e.id === (item.category || item.category_id || ''))?.name || item.category}
                      </div>
                    )}
                    {item.url && (
                      <a href={ensureProtocol(item.url) || '#'} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        Visit <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Owner card */}
              <div className="rounded-2xl bg-card/60 border border-emerald-500/20 p-4">
                <div className="flex items-center gap-3">
                  {profile?.user?.avatar_url ? (
                    <div className="relative h-10 w-10 rounded-full overflow-hidden border border-emerald-500/30 bg-black/20">
                      <Image src={toProxyUrl(profile.user.avatar_url)} alt={profile.user.full_name || profile.user.username} fill className="object-cover" sizes="40px" />
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

              {/* Slides section */}
              <div className="rounded-2xl bg-card/60 border border-emerald-500/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Images className="h-5 w-5 text-emerald-500" />
                    <h2 className="text-lg font-semibold">Slides</h2>
                  </div>
                  <Link href="#" className="inline-flex items-center gap-2 text-sm text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg">
                    View All
                  </Link>
                </div>
                {slides && slides.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {slides.sort((a,b)=> (a.slide_number||0) - (b.slide_number||0)).map((s, i) => (
                      <button
                        key={s.id || i}
                        type="button"
                        className="relative flex-shrink-0 w-64 h-40 rounded-xl overflow-hidden border border-emerald-500/20 bg-black/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        onClick={() => openLightbox(i)}
                        aria-label={`Open slide ${i+1}`}
                      >
                        <Image src={toProxyUrl(s.slide_url)} alt={s.caption || `Slide ${i+1}`} fill className="object-cover" sizes="256px" />
                        <div className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-white/90">
                          <ZoomIn className="h-4 w-4" />
                        </div>
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs border border-white/10">{i+1}/{slides.length}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No slides yet.</div>
                )}
              </div>

              {/* Lightbox */}
              {lightboxOpen && slides.length > 0 && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center" role="dialog" aria-modal="true" onClick={closeLightbox}>
                  <div className="relative w-full h-full max-w-6xl max-h-[90vh] m-4" onClick={(e) => e.stopPropagation()}>
                    <div className="relative w-full h-full">
                      <Image
                        src={toProxyUrl(slides[lightboxIndex].slide_url)}
                        alt={slides[lightboxIndex].caption || `Slide ${lightboxIndex+1}`}
                        fill
                        className="object-contain select-none"
                        sizes="100vw"
                        priority
                      />
                    </div>
                    <button className="absolute top-4 right-4 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center" onClick={closeLightbox} aria-label="Close">✕</button>
                    {slides.length > 1 && (
                      <>
                        <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-12 h-12 flex items-center justify-center border border-white/10" onClick={prevLightbox} aria-label="Previous">‹</button>
                        <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-12 h-12 flex items-center justify-center border border-white/10" onClick={nextLightbox} aria-label="Next">›</button>
                      </>
                    )}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/30 px-3 py-1 rounded-full border border-white/10">
                      {lightboxIndex+1} / {slides.length}
                    </div>
                  </div>
                </div>
              )}

              {/* About / Text sections */}
              <div className="rounded-2xl bg-card/60 border border-emerald-500/20 p-4">
                <h2 className="text-lg font-semibold mb-3">About This Project</h2>
                <div className="space-y-3">
                  {sections && sections.length > 0 ? (
                    sections
                      .sort((a,b)=> (a.display_order||0) - (b.display_order||0))
                      .map((sec) => (
                        <details key={sec.id} className="group rounded-xl border border-emerald-500/20 bg-black/20 open:bg-black/30">
                          <summary className="cursor-pointer list-none select-none px-4 py-3 flex items-center gap-3">
                            <span className="h-5 w-1 rounded bg-emerald-500/70" />
                            <span className="font-medium">{sec.heading || 'Section'}</span>
                          </summary>
                          <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground">
                            {sec.content}
                          </div>
                        </details>
                      ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No details added yet.</div>
                  )}
                </div>
              </div>

              {/* Owner actions */}
              {isOwner && (
                <div className="rounded-2xl bg-card/60 border border-border p-4">
                  <div className="text-sm font-medium mb-3">Owner Actions</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Link href={`/profile/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/edit`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 px-4 py-2 text-sm">
                      <Pencil className="h-4 w-4" /> Edit Project
                    </Link>
                    <button onClick={onDelete} disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 px-4 py-2 text-sm disabled:opacity-60">
                      <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : 'Delete Project'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
