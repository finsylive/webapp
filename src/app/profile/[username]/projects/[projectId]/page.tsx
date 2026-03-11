"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import Image from 'next/image';
import { use, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { ArrowLeft, Pencil, Rocket, ExternalLink, Trash2, Images, ZoomIn, MoreVertical } from 'lucide-react';
import { getProject, deleteProject as apiDeleteProject, listProjectSlides, listProjectTextSections, listProjectLinks, type ProjectSlide, type ProjectTextSection, type ProjectLink } from '@/api/projects';
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
    url?: string | null;
    created_at?: string | null;
    visibility?: string | null;
    cover_url?: string | null;
    image_url?: string | null;
    thumbnail?: string | null;
    thumbnail_url?: string | null;
    logo_url?: string | null;
  };

  const [item, setItem] = useState<ProjectItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [slides, setSlides] = useState<ProjectSlide[]>([]);
  const [sections, setSections] = useState<ProjectTextSection[]>([]);
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { userData } = useUserData();
  const isOwner = userData?.username?.toLowerCase() === username?.toLowerCase();

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

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
        const [projResp, slidesResp, sectionsResp, linksResp] = await Promise.all([
          getProject(username, projectId),
          listProjectSlides(username, projectId).catch(() => ({ data: [] as ProjectSlide[] })),
          listProjectTextSections(username, projectId).catch(() => ({ data: [] as ProjectTextSection[] })),
          listProjectLinks(username, projectId).catch(() => ({ data: [] as ProjectLink[] })),
        ]);
        if (!cancelled) {
          setItem((projResp as { data: ProjectItem | null })?.data ?? null);
          setSlides((slidesResp as { data: ProjectSlide[] })?.data || []);
          setSections((sectionsResp as { data: ProjectTextSection[] })?.data || []);
          setLinks((linksResp as { data: ProjectLink[] })?.data || []);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load project');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (username && projectId) run();
    return () => { cancelled = true; };
  }, [username, projectId]);

  const dateStr = useMemo(() => {
    if (!item?.created_at) return '';
    const d = new Date(item.created_at);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
  }, [item?.created_at]);

  const imageUrl = useMemo(() => {
    if (!item) return null;
    return item.cover_url || item.image_url || item.thumbnail || item.thumbnail_url || null;
  }, [item]);

  const onDelete = async () => {
    if (!item || deleting) return;
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
          {/* Top controls — single location for Back + owner actions */}
          <div className="flex items-center justify-between mb-6">
            <Link href={`/profile/${encodeURIComponent(username)}/projects`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5 mr-1" /> Back
            </Link>
            {isOwner && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
                  aria-label="Project actions"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-card border border-border rounded-xl shadow-lg z-20 py-1">
                    <Link
                      href={`/profile/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/edit`}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </Link>
                    <button
                      onClick={() => { setMenuOpen(false); setShowDeleteModal(true); }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 w-full transition-colors"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {loading ? (
            /* Skeleton loading state */
            <div className="space-y-6 animate-pulse">
              <div className="h-60 sm:h-72 rounded-2xl bg-muted/10" />
              <div className="space-y-3">
                <div className="h-7 w-2/3 bg-muted/10 rounded" />
                <div className="h-4 w-full bg-muted/10 rounded" />
                <div className="h-4 w-1/3 bg-muted/10 rounded" />
              </div>
              <div className="h-40 rounded-2xl bg-muted/10" />
            </div>
          ) : error ? (
            <div className="text-sm text-red-400">{error}</div>
          ) : !item ? (
            <div className="text-sm text-muted-foreground">Project not found.</div>
          ) : (
            <div className="space-y-6">
              {/* Hero cover — clean, no overlays */}
              <div className="relative h-60 sm:h-72 rounded-2xl bg-muted/10 border border-border overflow-hidden">
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
                    <Rocket className="h-16 w-16 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              {/* Title + tagline + metadata */}
              <div>
                <h1 className="text-2xl font-semibold">{item.title || item.name || 'Untitled'}</h1>
                {(item.tagline || item.description) && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.tagline || item.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                  {item.category && <span>{item.category}</span>}
                  {item.category && dateStr && <span>·</span>}
                  {dateStr && <span>{dateStr}</span>}
                </div>
                {item.url && (
                  <a href={ensureProtocol(item.url) || '#'} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    Visit project <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              {/* Project Links — now actually displayed */}
              {links.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {links.map((l) => (
                    <a
                      key={l.id}
                      href={ensureProtocol(l.url) || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/40 transition-colors"
                    >
                      {l.title} <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              )}

              {/* Slides — only shown when slides exist */}
              {slides.length > 0 && (
                <div className="rounded-2xl bg-card/60 border border-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Images className="h-5 w-5 text-emerald-500" />
                    <h2 className="text-lg font-semibold">Slides</h2>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {slides.sort((a, b) => (a.slide_number || 0) - (b.slide_number || 0)).map((s, i) => (
                      <button
                        key={s.id || i}
                        type="button"
                        className="relative flex-shrink-0 w-64 h-40 rounded-xl overflow-hidden border border-border bg-muted/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        onClick={() => openLightbox(i)}
                        aria-label={`Open slide ${i + 1}`}
                      >
                        <Image src={toProxyUrl(s.slide_url)} alt={s.caption || `Slide ${i + 1}`} fill className="object-cover" sizes="256px" />
                        <div className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-white/90">
                          <ZoomIn className="h-4 w-4" />
                        </div>
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs border border-white/10">{i + 1}/{slides.length}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lightbox */}
              {lightboxOpen && slides.length > 0 && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center" role="dialog" aria-modal="true" onClick={closeLightbox}>
                  <div className="relative w-full h-full max-w-6xl max-h-[90vh] m-4" onClick={(e) => e.stopPropagation()}>
                    <div className="relative w-full h-full">
                      <Image
                        src={toProxyUrl(slides[lightboxIndex].slide_url)}
                        alt={slides[lightboxIndex].caption || `Slide ${lightboxIndex + 1}`}
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
                      {lightboxIndex + 1} / {slides.length}
                    </div>
                  </div>
                </div>
              )}

              {/* Text sections — shown open by default, hidden when empty for non-owners */}
              {sections.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">About</h2>
                  {sections
                    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                    .map((sec) => (
                      <div key={sec.id} className="rounded-xl border border-border bg-card/40 px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="h-4 w-1 rounded bg-emerald-500/70" />
                          <h3 className="font-medium">{sec.heading || 'Section'}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sec.content}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Delete project?</h3>
            <p className="text-sm text-muted-foreground mb-1">
              This will permanently delete <strong>{item?.title || 'this project'}</strong>.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {slides.length > 0 && `${slides.length} slide${slides.length > 1 ? 's' : ''}, `}
              {sections.length > 0 && `${sections.length} section${sections.length > 1 ? 's' : ''}, `}
              {links.length > 0 && `${links.length} link${links.length > 1 ? 's' : ''}`}
              {(slides.length > 0 || sections.length > 0 || links.length > 0) ? ' will be lost.' : 'This cannot be undone.'}
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm hover:bg-muted/60 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white disabled:opacity-60 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
