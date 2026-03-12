"use client";

import { useState } from 'react';
import { Trash2, ChevronUp, ChevronDown, Plus, ImagePlus, Loader2, X, FileText } from 'lucide-react';
import { SHOWCASE_LIMITS, uploadSlideImage } from '@/api/startups';

type TextSection = { heading: string; content: string; display_order: number };
type LinkItem = { title: string; url: string; display_order: number };
type SlideItem = { slide_url: string; caption?: string; slide_number: number };

type StepShowcaseProps = {
  textSections: TextSection[];
  links: LinkItem[];
  slides?: SlideItem[];
  onTextSectionsChange: (sections: TextSection[]) => void;
  onLinksChange: (links: LinkItem[]) => void;
  onSlidesChange?: (slides: SlideItem[]) => void;
};

const inputClass = "w-full px-4 py-2.5 bg-background border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-colors";
const labelClass = "block text-sm font-medium text-foreground mb-1.5";

function reorder<T extends { display_order: number }>(items: T[], from: number, direction: 'up' | 'down'): T[] {
  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= items.length) return items;
  const arr = [...items];
  [arr[from], arr[to]] = [arr[to], arr[from]];
  return arr.map((item, i) => ({ ...item, display_order: i }));
}

function reorderSlides(items: SlideItem[], from: number, direction: 'up' | 'down'): SlideItem[] {
  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= items.length) return items;
  const arr = [...items];
  [arr[from], arr[to]] = [arr[to], arr[from]];
  return arr.map((item, i) => ({ ...item, slide_number: i }));
}

export function StepShowcase({ textSections, links, slides, onTextSectionsChange, onLinksChange, onSlidesChange }: StepShowcaseProps) {
  const [uploadingSlides, setUploadingSlides] = useState(false);

  // --- Text Sections ---
  const addSection = () => {
    if (textSections.length >= SHOWCASE_LIMITS.sections) return;
    onTextSectionsChange([...textSections, { heading: '', content: '', display_order: textSections.length }]);
  };

  const updateSection = (index: number, field: 'heading' | 'content', value: string) => {
    const updated = [...textSections];
    updated[index] = { ...updated[index], [field]: value };
    onTextSectionsChange(updated);
  };

  const removeSection = (index: number) => {
    onTextSectionsChange(textSections.filter((_, i) => i !== index).map((s, i) => ({ ...s, display_order: i })));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    onTextSectionsChange(reorder(textSections, index, direction));
  };

  // --- Links ---
  const addLink = () => {
    if (links.length >= SHOWCASE_LIMITS.links) return;
    onLinksChange([...links, { title: '', url: '', display_order: links.length }]);
  };

  const updateLink = (index: number, field: 'title' | 'url', value: string) => {
    const updated = [...links];
    updated[index] = { ...updated[index], [field]: value };
    onLinksChange(updated);
  };

  const removeLink = (index: number) => {
    onLinksChange(links.filter((_, i) => i !== index).map((l, i) => ({ ...l, display_order: i })));
  };

  const moveLink = (index: number, direction: 'up' | 'down') => {
    onLinksChange(reorder(links, index, direction));
  };

  // --- Slides ---
  const handleSlideUpload = async (files: FileList) => {
    if (!onSlidesChange || !slides) return;
    const remaining = SHOWCASE_LIMITS.slides - slides.length;
    if (remaining <= 0) return;

    const toUpload = Array.from(files).slice(0, remaining);
    setUploadingSlides(true);

    const newSlides: SlideItem[] = [];
    for (const file of toUpload) {
      const { url, error } = await uploadSlideImage(file);
      if (!error && url) {
        newSlides.push({ slide_url: url, caption: '', slide_number: slides.length + newSlides.length });
      }
    }

    onSlidesChange([...slides, ...newSlides]);
    setUploadingSlides(false);
  };

  const updateSlideCaption = (index: number, caption: string) => {
    if (!onSlidesChange || !slides) return;
    const updated = [...slides];
    updated[index] = { ...updated[index], caption };
    onSlidesChange(updated);
  };

  const removeSlide = (index: number) => {
    if (!onSlidesChange || !slides) return;
    onSlidesChange(slides.filter((_, i) => i !== index).map((s, i) => ({ ...s, slide_number: i })));
  };

  const moveSlide = (index: number, direction: 'up' | 'down') => {
    if (!onSlidesChange || !slides) return;
    onSlidesChange(reorderSlides(slides, index, direction));
  };

  const hasSlides = slides !== undefined && onSlidesChange !== undefined;
  const sectionsAtLimit = textSections.length >= SHOWCASE_LIMITS.sections;
  const linksAtLimit = links.length >= SHOWCASE_LIMITS.links;
  const slidesAtLimit = hasSlides && slides!.length >= SHOWCASE_LIMITS.slides;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground">Showcase</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add custom sections, slides, and links to tell your story
        </p>
      </div>

      {/* Text Sections */}
      <div className="space-y-4">
        <label className={`${labelClass} flex items-center gap-2`}>
          <FileText className="h-4 w-4 text-primary" />
          <span>Custom Sections</span>
          <span className="text-muted-foreground/60 font-normal text-xs ml-auto">
            {textSections.length} / {SHOWCASE_LIMITS.sections}
          </span>
        </label>
        {textSections.map((section, i) => (
          <div key={i} className="p-4 bg-accent/10 border border-border/30 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Section {i + 1}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(i, 'up')}
                  disabled={i === 0}
                  className="p-1 rounded text-muted-foreground/50 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(i, 'down')}
                  disabled={i === textSections.length - 1}
                  className="p-1 rounded text-muted-foreground/50 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move down"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeSection(i)}
                  className="p-1 rounded text-red-400 hover:text-red-500 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <input
              type="text"
              value={section.heading}
              onChange={(e) => updateSection(i, 'heading', e.target.value)}
              placeholder="Section heading (e.g. Our Mission)"
              className={inputClass}
            />
            <textarea
              value={section.content}
              onChange={(e) => updateSection(i, 'content', e.target.value)}
              placeholder="Section content..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={addSection}
          disabled={sectionsAtLimit}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border/60 disabled:hover:text-muted-foreground"
        >
          <Plus className="h-3.5 w-3.5 inline mr-1" />
          Add Section
        </button>
      </div>

      {/* Slides */}
      {hasSlides && (
        <div className="space-y-4">
          <label className={labelClass}>
            Slides{' '}
            <span className="text-muted-foreground/60 font-normal text-xs">
              {slides!.length} / {SHOWCASE_LIMITS.slides}
            </span>
          </label>

          {slides!.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {slides!.map((slide, i) => (
                <div key={i} className="relative flex-shrink-0 w-36 group">
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-accent/20 border border-border/30">
                    <img src={slide.slide_url} alt={slide.caption || `Slide ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => moveSlide(i, 'up')}
                        disabled={i === 0}
                        className="p-1 rounded bg-black/50 text-white disabled:opacity-30"
                        title="Move left"
                      >
                        <ChevronUp className="h-3 w-3 -rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSlide(i, 'down')}
                        disabled={i === slides!.length - 1}
                        className="p-1 rounded bg-black/50 text-white disabled:opacity-30"
                        title="Move right"
                      >
                        <ChevronDown className="h-3 w-3 -rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSlide(i)}
                        className="p-1 rounded bg-red-500/80 text-white"
                        title="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={slide.caption || ''}
                    onChange={(e) => updateSlideCaption(i, e.target.value)}
                    placeholder="Caption"
                    className="mt-1.5 w-full px-2 py-1 bg-transparent border-b border-border/30 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                  />
                </div>
              ))}
            </div>
          )}

          <label
            className={`w-full py-2.5 rounded-xl border-2 border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center justify-center gap-1.5 ${
              slidesAtLimit || uploadingSlides ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
            }`}
          >
            {uploadingSlides ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <ImagePlus className="h-4 w-4" />
                Add Slides
              </>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={slidesAtLimit || uploadingSlides}
              onChange={(e) => {
                if (e.target.files?.length) handleSlideUpload(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}

      {/* Links */}
      <div className="space-y-4">
        <label className={labelClass}>
          Links{' '}
          <span className="text-muted-foreground/60 font-normal text-xs">
            {links.length} / {SHOWCASE_LIMITS.links}
          </span>
        </label>
        {links.map((link, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex flex-col gap-1 mt-2.5">
              <button
                type="button"
                onClick={() => moveLink(i, 'up')}
                disabled={i === 0}
                className="p-0.5 rounded text-muted-foreground/50 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Move up"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => moveLink(i, 'down')}
                disabled={i === links.length - 1}
                className="p-0.5 rounded text-muted-foreground/50 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Move down"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={link.title}
                onChange={(e) => updateLink(i, 'title', e.target.value)}
                placeholder="Link title"
                className={inputClass}
              />
              <input
                type="url"
                value={link.url}
                onChange={(e) => updateLink(i, 'url', e.target.value)}
                placeholder="https://..."
                className={inputClass}
              />
            </div>
            <button
              type="button"
              onClick={() => removeLink(i)}
              className="mt-2.5 text-red-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addLink}
          disabled={linksAtLimit}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border/60 disabled:hover:text-muted-foreground"
        >
          <Plus className="h-3.5 w-3.5 inline mr-1" />
          Add Link
        </button>
      </div>
    </div>
  );
}
