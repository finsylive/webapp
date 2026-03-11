"use client";

import { use, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { toProxyUrl } from "@/utils/imageUtils";
import { compressImage } from "@/utils/imageCompression";
import { uploadMediaFile } from "@/utils/fileUpload";
import { PROJECT_CATEGORIES } from "@/lib/projectCategories";
import {
  getProject,
  updateProject,
  listProjectSlides,
  addProjectSlide,
  deleteProjectSlide,
  updateProjectSlide,
  listProjectLinks,
  addProjectLink,
  deleteProjectLink,
  listProjectTextSections,
  addProjectTextSection,
  updateProjectTextSection,
  deleteProjectTextSection,
  type Project,
  type ProjectSlide,
  type ProjectLink,
  type ProjectTextSection,
} from "@/api/projects";
import {
  ArrowLeft,
  Save,
  Pencil,
  Images,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Type,
  MoreVertical,
} from "lucide-react";

export default function EditProjectPage({ params }: { params: Promise<{ username: string; projectId: string }> }) {
  const { username, projectId } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState<Project["visibility"]>("public");
  const [projectUrl, setProjectUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  // Related resources
  const [slides, setSlides] = useState<ProjectSlide[]>([]);
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [sections, setSections] = useState<ProjectTextSection[]>([]);
  // UI helpers
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Modals state
  const [linkModal, setLinkModal] = useState<{ open: boolean; id?: string; title: string; url: string }>({ open: false, title: '', url: '' });
  const [sectionModal, setSectionModal] = useState<{ open: boolean; id?: string; heading: string; content: string }>({ open: false, heading: '', content: '' });
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; message: string; onConfirm?: () => void }>({ open: false, message: '' });
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [sectionMenuId, setSectionMenuId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const isUploading = uploadingCount > 0;

  // Warn on page unload if there are unsaved changes or ongoing uploads
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const hasChanges = (() => {
        if (!project) return false;
        const sameTitle = (title || '') === (project.title || '');
        const sameTagline = (tagline || '') === (project.tagline || '');
        const sameUrl = (projectUrl || '') === (project.url || '');
        const sameCategory = (category || '') === (project.category || '');
        const sameVisibility = visibility === project.visibility;
        const sameCover = (coverUrl || null) === (project.cover_url || null);
        return !(sameTitle && sameTagline && sameUrl && sameCategory && sameVisibility && sameCover);
      })();
      if (isUploading || hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isUploading, project, title, tagline, projectUrl, category, visibility, coverUrl]);

  // In-app navigation guard: intercept anchor clicks and back/forward
  useEffect(() => {
    const shouldBlock = () => {
      if (!project) return isUploading;
      const sameTitle = (title || '') === (project.title || '');
      const sameTagline = (tagline || '') === (project.tagline || '');
      const sameUrl = (projectUrl || '') === (project.url || '');
      const sameCategory = (category || '') === (project.category || '');
      const sameVisibility = visibility === project.visibility;
      const sameCover = (coverUrl || null) === (project.cover_url || null);
      const hasChanges = !(sameTitle && sameTagline && sameUrl && sameCategory && sameVisibility && sameCover);
      return isUploading || hasChanges;
    };

    const clickHandler = (e: MouseEvent) => {
      // capture clicks on anchor tags
      let el = e.target as HTMLElement | null;
      while (el && el !== document.body) {
        if (el instanceof HTMLAnchorElement && el.href) {
          const href = el.getAttribute('href') || '';
          // only intercept client-side routes
          const isExternal = /^https?:\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:');
          if (!isExternal && shouldBlock()) {
            const ok = window.confirm('You have unsaved changes or uploads in progress. Leave this page?');
            if (!ok) {
              e.preventDefault();
              e.stopPropagation();
            }
          }
          break;
        }
        el = el.parentElement;
      }
    };

    const popHandler = () => {
      if (shouldBlock()) {
        const ok = window.confirm('You have unsaved changes or uploads in progress. Leave this page?');
        if (!ok) {
          // push current state back to cancel navigation
          history.pushState(null, '', location.href);
        }
      }
    };

    document.addEventListener('click', clickHandler, true);
    window.addEventListener('popstate', popHandler);
    return () => {
      document.removeEventListener('click', clickHandler, true);
      window.removeEventListener('popstate', popHandler);
    };
  }, [project, title, tagline, projectUrl, category, visibility, coverUrl, isUploading, router]);

  // Removed scroll button updater and lightbox handlers for a simpler UI

  // Helpers similar to EditProfileForm
  const pickFile = (accept: string, cb: (file: File) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) cb(f);
    };
    input.click();
  };
  const blobToFile = (blob: Blob, filename: string): File => new File([blob], filename, { type: blob.type || 'image/jpeg' });
  const normalizeMediaUrl = (u: string): string => u.replace(/^https?:\/\/s3:\/\//i, 's3://');

  // Simple center-crop to desired aspect ratio, scaled down to maxW/maxH
  const cropFileToAspect = async (file: File, aspectW: number, aspectH: number, maxW: number, maxH: number): Promise<File> => {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const im = document.createElement('img');
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('Failed to load image'));
      im.src = dataUrl;
    });
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const targetAspect = aspectW / aspectH;
    // const srcAspect = srcW / srcH; // not used
    // compute crop rect
    let cropW = srcW;
    let cropH = Math.round(srcW / targetAspect);
    if (cropH > srcH) {
      cropH = srcH;
      cropW = Math.round(srcH * targetAspect);
    }
    const cropX = Math.floor((srcW - cropW) / 2);
    const cropY = Math.floor((srcH - cropH) / 2);

    // output size respecting max bounds
    let outW = cropW;
    let outH = cropH;
    const scale = Math.min(maxW / outW, maxH / outH, 1);
    outW = Math.round(outW * scale);
    outH = Math.round(outH * scale);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
    const blob: Blob = await new Promise((resolve) => canvas.toBlob(b => resolve(b as Blob), 'image/jpeg', 0.95));
    return blobToFile(blob, file.name.replace(/\.[^.]+$/, '') + '_cropped.jpg');
  };

  // Load initial
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [projRes, slidesRes, linksRes, sectionsRes] = await Promise.all([
          getProject(username, projectId),
          listProjectSlides(username, projectId).catch(() => ({ data: [] as ProjectSlide[] })),
          listProjectLinks(username, projectId).catch(() => ({ data: [] as ProjectLink[] })),
          listProjectTextSections(username, projectId).catch(() => ({ data: [] as ProjectTextSection[] })),
        ]);
        if (cancelled) return;
        const p = (projRes as { data: Project }).data;
        setProject(p);
        setTitle(p?.title || "");
        setTagline(p?.tagline ?? "");
        setProjectUrl(p?.url ?? "");
        setCategory(p?.category ?? "");
        setVisibility(p?.visibility || "public");
        setCoverUrl(p?.cover_url ?? null);
        setSlides((slidesRes as { data: ProjectSlide[] }).data || []);
        setLinks((linksRes as { data: ProjectLink[] }).data || []);
        setSections((sectionsRes as { data: ProjectTextSection[] }).data || []);
      } catch {
        // keep silent for now; optional to surface a toast
      } finally {
        // no-op
      }
    };
    if (username && projectId) run();
    return () => {
      cancelled = true;
    };
  }, [username, projectId]);

  const coverPreview = useMemo(() => coverUrl ? toProxyUrl(coverUrl) : "", [coverUrl]);

  const isDirty = useMemo(() => {
    if (!project) return false;
    const orig = project;
    const sameTitle = (title || "") === (orig.title || "");
    const sameTagline = (tagline || "") === (orig.tagline || "");
    const sameUrl = (projectUrl || "") === (orig.url || "");
    const sameCategory = (category || "") === (orig.category || "");
    const sameVisibility = visibility === orig.visibility;
    const sameCover = (coverUrl || null) === (orig.cover_url || null);
    return !(sameTitle && sameTagline && sameUrl && sameCategory && sameVisibility && sameCover);
  }, [project, title, tagline, projectUrl, category, visibility, coverUrl]);
  const isTitleValid = useMemo(() => (title || "").trim().length > 0, [title]);

  // Removed auto-save helper; updates occur on explicit Save only.

  const handleSave = async () => {
    if (!project) return;
    const prev = project;
    const optimistic: Project = {
      ...project,
      title,
      tagline: tagline || null,
      url: projectUrl || null,
      category: (category && category.trim()) ? category : project.category,
      visibility,
      cover_url: coverUrl || null,
    };
    setProject(optimistic);
    try {
      setSaving(true);
      const patch: Partial<Project> = {
        title,
        tagline,
        url: projectUrl || null,
        visibility,
        cover_url: coverUrl || null,
      };
      if (category && category.trim()) {
        patch.category = category;
      }
      const res = await updateProject(username, projectId, patch);
      const updated = (res as { data?: Project }).data;
      if (updated) {
        setProject(updated);
      }
      setLastSavedAt(Date.now());
      showToast('success', 'Project saved');
    } catch (e: unknown) {
      setProject(prev);
      showToast('error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Slides actions (URL-based for now)
  const onAddSlide = () => {
    pickFile('image/*', async (file) => {
      try {
        setUploadingCount((c)=>c+1);
        const cropped = await cropFileToAspect(file, 16, 9, 1600, 900);
        const compressed = await compressImage(cropped, { maxWidth: 1600, maxHeight: 900, quality: 0.82 });
        const uploaded = await uploadMediaFile(blobToFile(compressed, `slide_${Date.now()}.jpg`));
        if (!uploaded.url) throw new Error(uploaded.error || 'Upload failed');
        const cleanUrl = normalizeMediaUrl(uploaded.url);
        const nextNumber = (slides?.length || 0) + 1;
        const res = await addProjectSlide(username, projectId, { slide_url: cleanUrl, slide_number: nextNumber });
        setSlides((prev) => [...prev, res.data]);
        showToast('success', 'Slide added');
      } catch (e: unknown) {
        showToast('error', e instanceof Error ? e.message : 'Failed to add slide');
      } finally {
        setUploadingCount((c)=>Math.max(0,c-1));
      }
    });
  };
  const onDeleteSlide = async (id: string) => {
    setConfirmModal({
      open: true,
      message: 'Delete this slide? This cannot be undone.',
      onConfirm: async () => {
        try {
          await deleteProjectSlide(username, projectId, id);
          setSlides((prev) => prev.filter((s) => s.id !== id));
          setConfirmModal({ open: false, message: '' });
          showToast('success', 'Slide deleted');
        } catch (e: unknown) {
          showToast('error', e instanceof Error ? e.message : 'Failed to delete slide');
        }
      }
    });
  };

  // Links actions
  const onAddLink = () => setLinkModal({ open: true, title: '', url: '' });
  const submitLink = async () => {
    if (!linkModal.url) return;
    try {
      const res = await addProjectLink(username, projectId, { title: linkModal.title || 'Link', url: linkModal.url });
      setLinks((prev) => [...prev, res.data]);
      setLinkModal({ open: false, title: '', url: '' });
      showToast('success', 'Link added');
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Failed to add link');
    }
  };
  const onDeleteLink = async (id: string) => {
    setConfirmModal({
      open: true,
      message: 'Delete this link?',
      onConfirm: async () => {
        try {
          await deleteProjectLink(username, projectId, id);
          setLinks((prev) => prev.filter((l) => l.id !== id));
          setConfirmModal({ open: false, message: '' });
          showToast('success', 'Link deleted');
        } catch (e: unknown) {
          showToast('error', e instanceof Error ? e.message : 'Failed to delete link');
        }
      }
    });
  };

  // Sections actions
  const onAddSection = () => setSectionModal({ open: true, heading: '', content: '' });
  const onEditSection = (section: ProjectTextSection) => setSectionModal({ open: true, id: section.id, heading: section.heading, content: section.content });
  const submitSection = async () => {
    try {
      if (sectionModal.id) {
        const res = await updateProjectTextSection(username, projectId, sectionModal.id, { heading: sectionModal.heading, content: sectionModal.content });
        setSections((prev) => prev.map((s) => (s.id === sectionModal.id ? res.data : s)));
        showToast('success', 'Section updated');
      } else {
        const display_order = (sections?.length || 0) + 1;
        const res = await addProjectTextSection(username, projectId, { heading: sectionModal.heading || 'Untitled', content: sectionModal.content || '', display_order });
        setSections((prev) => [...prev, res.data]);
        showToast('success', 'Section added');
      }
      setSectionModal({ open: false, heading: '', content: '' });
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Failed to save section');
    }
  };
  const onDeleteSection = async (id: string) => {
    setConfirmModal({
      open: true,
      message: 'Delete this section?',
      onConfirm: async () => {
        try {
          await deleteProjectTextSection(username, projectId, id);
          setSections((prev) => prev.filter((s) => s.id !== id));
          setConfirmModal({ open: false, message: '' });
          showToast('success', 'Section deleted');
        } catch (e: unknown) {
          showToast('error', e instanceof Error ? e.message : 'Failed to delete section');
        }
      }
    });
  };
  const moveSection = async (index: number, dir: -1 | 1) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= sections.length) return;
    const copy = [...sections];
    const [item] = copy.splice(index, 1);
    copy.splice(newIndex, 0, item);
    // reassign orders
    const reordered = copy.map((s, i) => ({ ...s, display_order: i + 1 }));
    setSections(reordered);
    // Persist new order
    try {
      await Promise.all(
        reordered.map((s) => updateProjectTextSection(username, projectId, s.id, { display_order: s.display_order }))
      );
    } catch {
      // ignore for now, UI already updated
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 w-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto w-full space-y-8">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <div className="flex items-center gap-3">
              <Link href={`/profile/${encodeURIComponent(username)}/projects`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5 mr-1" /> Back
              </Link>
              <h1 className="text-2xl font-semibold">Edit Project</h1>
            </div>
            <div className="flex items-center gap-3">
              {lastSavedAt && (
                <span className="text-xs text-muted-foreground">Saved {new Date(lastSavedAt).toLocaleTimeString()}</span>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !isTitleValid || !isDirty || isUploading}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  saving || !isTitleValid || !isDirty || isUploading
                    ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white'
                }`}
                aria-disabled={saving || !isTitleValid || !isDirty || isUploading}
                title={!isTitleValid ? 'Enter a title to save' : isUploading ? 'Please wait for uploads to finish' : isDirty ? 'Save changes' : 'No changes to save'}
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Cover with overlay + change buttons */}
          <div className="relative h-56 sm:h-64 rounded-2xl overflow-hidden border border-emerald-500/20 mb-8 md:mb-10">
            {coverPreview ? (
              <NextImage src={coverPreview} alt="Cover" fill className="object-cover" sizes="(max-width: 768px) 100vw, 1024px" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-emerald-400">No cover</div>
            )}
            <div className="absolute right-3 bottom-3 flex gap-2">
              <button
                onClick={() => {
                  pickFile('image/*', async (file) => {
                    try {
                      setUploadingCount((c)=>c+1);
                      const cropped = await cropFileToAspect(file, 16, 9, 1920, 1080);
                      const compressed = await compressImage(cropped, { maxWidth: 1920, maxHeight: 1080, quality: 0.82 });
                      const uploaded = await uploadMediaFile(blobToFile(compressed, `cover_${Date.now()}.jpg`));
                      if (!uploaded.url) throw new Error(uploaded.error || 'Upload failed');
                      setCoverUrl(normalizeMediaUrl(uploaded.url));
                      showToast('success', 'Cover updated');
                    } catch (e: unknown) {
                      showToast('error', e instanceof Error ? e.message : 'Failed to upload cover');
                    } finally {
                      setUploadingCount((c)=>Math.max(0,c-1));
                    }
                  });
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/60 border border-white/10 text-white"
              >
                <Pencil className="h-4 w-4" /> Cover
              </button>
            </div>
          </div>

          {/* Basic Info */}
          <div className="rounded-2xl bg-card/60 border border-emerald-500/20 p-5 space-y-5 mt-10 md:mt-12">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Project Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-invalid={!isTitleValid}
                className={`w-full rounded-lg bg-black/30 border px-3 py-2 outline-none ${isTitleValid ? 'border-emerald-500/20' : 'border-red-500/50'}`}
                placeholder="Title"
              />
              {!isTitleValid && (
                <p className="mt-1 text-xs text-red-400">Title is required.</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Tagline (Short Description)</label>
              <textarea
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none min-h-20"
                placeholder="Describe your project..."
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Project URL (Proof Link)</label>
              <input
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
                className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none"
                placeholder="https://your-project.com"
                type="url"
              />
              <p className="mt-1 text-xs text-muted-foreground">Link to the live project, demo, or proof of work</p>
              {/* Additional links */}
              {links.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {links.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-1.5">
                      <span className="text-sm font-medium truncate flex-1">{l.title}</span>
                      <a href={l.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate max-w-[160px]">{l.url}</a>
                      <button onClick={() => onDeleteLink(l.id)} className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={onAddLink} className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add another link
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none"
                >
                  <option value="">Select category</option>
                  {PROJECT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Visibility</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as Project['visibility'])}
                  className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                </select>
              </div>
            </div>
          </div>

          {/* Slides Manager */}
          <div className="rounded-2xl bg-card/60 border border-emerald-500/20 p-5 mt-10 md:mt-12">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><Images className="h-5 w-5 text-emerald-500" /><h2 className="text-lg font-semibold">Project Showcase</h2></div>
            </div>
            <div className="relative">
              {/* Scroll buttons */}
              {/* Removed scroll arrow buttons for a cleaner, simpler UI */}

              <div className="flex gap-3 overflow-x-auto pb-2 px-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {/* Add tile */}
              <button type="button" onClick={onAddSlide} className="relative flex-shrink-0 w-64 h-40 rounded-xl border-2 border-dashed border-emerald-500/30 bg-black/20 hover:bg-black/25 transition-colors">
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                  <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center mb-2">
                    <Images className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div className="text-sm">Select an image</div>
                </div>
                <div className="absolute right-2 top-2 h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Plus className="h-4 w-4"/></div>
                <div className="absolute left-2 bottom-2 text-xs bg-black/40 text-white px-2 py-0.5 rounded-full border border-white/10">Slide {Math.max(1, (slides?.length||0)+1)}</div>
              </button>

              {/* Existing slides */}
              {slides
                .slice()
                .sort((a,b)=>(a.slide_number||0)-(b.slide_number||0))
                .map((s,i)=>(
                  <div
                    key={s.id || i}
                    className={`relative flex-shrink-0 w-64 h-40 rounded-xl overflow-hidden border ${dragIndex===i ? 'border-emerald-400' : 'border-emerald-500/20'} bg-black/20`}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e)=>{e.preventDefault();}}
                    onDrop={async ()=>{
                      if (dragIndex===null || dragIndex===i) return;
                      const ordered = slides.slice().sort((a,b)=>(a.slide_number||0)-(b.slide_number||0));
                      const [moved] = ordered.splice(dragIndex,1);
                      ordered.splice(i,0,moved);
                      // re-number
                      const reNumbered = ordered.map((it, idx) => ({ ...it, slide_number: idx+1 }));
                      setSlides(reNumbered);
                      setDragIndex(null);
                      try {
                        await Promise.all(reNumbered.map(sl => updateProjectSlide(username, projectId, sl.id, { slide_number: sl.slide_number })));
                        showToast('success','Order updated');
                      } catch {
                        showToast('error','Failed to persist order');
                      }
                    }}
                    
                  >
                    <NextImage src={toProxyUrl(s.slide_url)} alt={s.caption || `Slide ${i+1}`} fill className="object-cover" sizes="256px" />
                    <div className="absolute left-2 bottom-2 text-xs bg-black/50 text-white px-2 py-0.5 rounded-full border border-white/10">Slide {s.slide_number || i+1}</div>
                    <div className="absolute right-2 bottom-2 flex gap-2">
                      <button
                        onClick={(e)=>{ e.stopPropagation();
                          
                          pickFile('image/*', async (file) => {
                            try {
                              setUploadingCount((c)=>c+1);
                              const cropped = await cropFileToAspect(file, 16, 9, 1600, 900);
                              const compressed = await compressImage(cropped, { maxWidth: 1600, maxHeight: 900, quality: 0.82 });
                              const uploaded = await uploadMediaFile(blobToFile(compressed, `slide_${Date.now()}.jpg`));
                              if (!uploaded.url) throw new Error(uploaded.error || 'Upload failed');
                              const cleanUrl = normalizeMediaUrl(uploaded.url);
                              // Replace content by deleting then adding with same number
                              await deleteProjectSlide(username, projectId, s.id);
                              const res = await addProjectSlide(username, projectId, { slide_url: cleanUrl, slide_number: s.slide_number || (i+1) });
                              setSlides((prev) => prev.map(sl => sl.id === s.id ? res.data : sl));
                              showToast('success', 'Slide replaced');
                            } catch (e: unknown) {
                              showToast('error', e instanceof Error ? e.message : 'Failed to replace slide');
                            } finally {
                              setUploadingCount((c)=>Math.max(0,c-1));
                            }
                          });
                        }}
                        className="h-10 w-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center"
                        title="Replace"
                      >
                        <Images className="h-4 w-4"/>
                      </button>
                      <button onClick={(e)=>{ e.stopPropagation(); onDeleteSlide(s.id); }} className="h-10 w-10 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 flex items-center justify-center" title="Delete">
                        <Trash2 className="h-4 w-4"/>
                      </button>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </div>

          {/* Details Manager */}
          <div className="rounded-2xl bg-card/60 border border-emerald-500/20 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><Type className="h-5 w-5 text-emerald-500" /><h2 className="text-lg font-semibold">Details</h2></div>
              <button onClick={onAddSection} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"><Plus className="h-4 w-4" /> Add Section</button>
            </div>
            {sections.length === 0 ? (
              <div className="text-sm text-muted-foreground">No sections added yet.</div>
            ) : (
              <div className="space-y-3">
                {sections.sort((a,b)=>(a.display_order||0)-(b.display_order||0)).map((sec, idx) => (
                  <div key={sec.id} className="rounded-xl border border-border bg-card/40">
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="font-medium">{sec.heading}</div>
                      <div className="relative">
                        <button onClick={() => setSectionMenuId(sectionMenuId === sec.id ? null : sec.id)} className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {sectionMenuId === sec.id && (
                          <div className="absolute right-0 top-full mt-1 w-36 bg-card border border-border rounded-xl shadow-lg z-20 py-1">
                            <button onClick={() => { setSectionMenuId(null); moveSection(idx, -1); }} className="flex items-center gap-2 px-3 py-2 text-sm w-full hover:bg-muted/60"><ChevronUp className="h-4 w-4" /> Move up</button>
                            <button onClick={() => { setSectionMenuId(null); moveSection(idx, 1); }} className="flex items-center gap-2 px-3 py-2 text-sm w-full hover:bg-muted/60"><ChevronDown className="h-4 w-4" /> Move down</button>
                            <button onClick={() => { setSectionMenuId(null); onEditSection(sec); }} className="flex items-center gap-2 px-3 py-2 text-sm w-full hover:bg-muted/60"><Pencil className="h-4 w-4" /> Edit</button>
                            <button onClick={() => { setSectionMenuId(null); onDeleteSection(sec.id); }} className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 w-full hover:bg-red-500/10"><Trash2 className="h-4 w-4" /> Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="px-3 pb-3 text-sm text-muted-foreground">{sec.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg border ${toast.type==='success' ? 'bg-emerald-600/90 border-emerald-500 text-white' : 'bg-red-600/90 border-red-500 text-white'}`}>{toast.message}</div>
      )}

      {/* Confirm Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center" role="dialog" aria-modal="true" onClick={()=>setConfirmModal({ open:false, message:'' })}>
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/20 bg-card/90 backdrop-blur p-5 m-3" onClick={(e)=>e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Confirm</h3>
            <p className="text-sm text-muted-foreground mb-4">{confirmModal.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setConfirmModal({ open:false, message:'' })} className="px-3 py-2 rounded-lg border border-white/10">Cancel</button>
              <button onClick={()=>{confirmModal.onConfirm?.();}} className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white">Confirm</button>
            </div>
          </div>
        </div>
      )}


      {/* Link Modal */}
      {linkModal.open && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center" role="dialog" aria-modal="true" onClick={()=>setLinkModal({ open:false, title:'', url:'' })}>
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/20 bg-card/90 backdrop-blur p-5 m-3" onClick={(e)=>e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Add Link</h3>
            <label className="block text-sm text-muted-foreground mb-1">Title</label>
            <input value={linkModal.title} onChange={(e)=>setLinkModal(v=>({ ...v, title: e.target.value }))} placeholder="Link title" className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none mb-3" />
            <label className="block text-sm text-muted-foreground mb-1">URL</label>
            <input value={linkModal.url} onChange={(e)=>setLinkModal(v=>({ ...v, url: e.target.value }))} placeholder="https://..." className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={()=>setLinkModal({ open:false, title:'', url:'' })} className="px-3 py-2 rounded-lg border border-white/10">Cancel</button>
              <button onClick={submitLink} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Section Modal */}
      {sectionModal.open && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center" role="dialog" aria-modal="true" onClick={()=>setSectionModal({ open:false, heading:'', content:'' })}>
          <div className="w-full max-w-lg rounded-2xl border border-emerald-500/20 bg-card/90 backdrop-blur p-5 m-3" onClick={(e)=>e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">{sectionModal.id ? 'Edit Section' : 'Add Section'}</h3>
            <label className="block text-sm text-muted-foreground mb-1">Section Title</label>
            <input value={sectionModal.heading} onChange={(e)=>setSectionModal(v=>({ ...v, heading: e.target.value }))} placeholder="Title" className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none mb-3" />
            <label className="block text-sm text-muted-foreground mb-1">Content</label>
            <textarea value={sectionModal.content} onChange={(e)=>setSectionModal(v=>({ ...v, content: e.target.value }))} placeholder="Write your content here..." className="w-full min-h-40 rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={()=>setSectionModal({ open:false, heading:'', content:'' })} className="px-3 py-2 rounded-lg border border-white/10">Cancel</button>
              <button onClick={submitSection} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox removed for simplicity */}
    </DashboardLayout>
  );
}
