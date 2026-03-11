"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

type CropMode = 'avatar' | 'cover';

type ImageCropModalProps = {
  file: File;
  mode: CropMode;
  onDone: (croppedFile: File) => void;
  onCancel: () => void;
};

const OUTPUT = {
  avatar: { w: 512, h: 512 },
  cover: { w: 1600, h: 900 },
} as const;

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export function ImageCropModal({ file, mode, onDone, onCancel }: ImageCropModalProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [loaded, setLoaded] = useState(false);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);
  const zoomRef = useRef(zoom);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Load image from file
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setLoaded(true);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Compute display size once loaded
  useEffect(() => {
    if (!loaded) return;
    const maxW = Math.min(window.innerWidth - 64, 560);
    if (mode === 'avatar') {
      const s = Math.min(maxW, 360);
      setDisplaySize({ w: s, h: s });
    } else {
      const w = maxW;
      const h = Math.round(w / (16 / 9));
      setDisplaySize({ w, h });
    }
  }, [loaded, mode]);

  // Set up canvas dimensions (HiDPI)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || displaySize.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = displaySize.w * dpr;
    canvas.height = displaySize.h * dpr;
    canvas.style.width = `${displaySize.w}px`;
    canvas.style.height = `${displaySize.h}px`;
  }, [displaySize]);

  const clampZoom = useCallback((z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)), []);

  const clampOffset = useCallback((o: { x: number; y: number }) => {
    if (!imgSize.w || !displaySize.w) return o;
    const baseScale = Math.max(displaySize.w / imgSize.w, displaySize.h / imgSize.h);
    const scale = baseScale * zoomRef.current;
    const drawW = imgSize.w * scale;
    const drawH = imgSize.h * scale;
    const maxX = Math.max(0, (drawW - displaySize.w) / 2);
    const maxY = Math.max(0, (drawH - displaySize.h) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, o.x)),
      y: Math.min(maxY, Math.max(-maxY, o.y)),
    };
  }, [imgSize, displaySize]);

  // Re-clamp offset when zoom changes
  useEffect(() => {
    setOffset(prev => clampOffset(prev));
  }, [zoom, clampOffset]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !loaded || !displaySize.w) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const dw = displaySize.w;
    const dh = displaySize.h;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, dw, dh);

    // Draw image
    const baseScale = Math.max(dw / imgSize.w, dh / imgSize.h);
    const scale = baseScale * zoom;
    const drawW = imgSize.w * scale;
    const drawH = imgSize.h * scale;
    const drawX = (dw - drawW) / 2 + offset.x;
    const drawY = (dh - drawH) / 2 + offset.y;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Avatar: overlay with circular cutout
    if (mode === 'avatar') {
      const cx = dw / 2;
      const cy = dh / 2;
      const radius = Math.min(dw, dh) / 2 - 2;

      // Dark overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, dw, dh);

      // Punch circle hole
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Circle border
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }, [offset, zoom, loaded, imgSize, displaySize, mode]);

  // Pointer handlers for drag
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setOffset(prev => clampOffset({ x: prev.x + dx, y: prev.y + dy }));
  }, [clampOffset]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  // Wheel zoom
  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setZoom(prev => clampZoom(prev + delta));
  }, [clampZoom]);

  // Touch pinch zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastPinchDist.current !== null) {
          const delta = (dist - lastPinchDist.current) * 0.005;
          setZoom(prev => clampZoom(prev + delta));
        }
        lastPinchDist.current = dist;
      }
    };

    const handleTouchEnd = () => {
      lastPinchDist.current = null;
    };

    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    return () => {
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [clampZoom]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Extract crop
  const handleDone = useCallback(async () => {
    const img = imgRef.current;
    if (!img || !displaySize.w) return;

    const out = OUTPUT[mode];
    const outCanvas = document.createElement('canvas');
    outCanvas.width = out.w;
    outCanvas.height = out.h;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';

    // Replicate transform at output resolution
    const baseScale = Math.max(out.w / imgSize.w, out.h / imgSize.h);
    const scale = baseScale * zoom;
    const drawW = imgSize.w * scale;
    const drawH = imgSize.h * scale;

    // Map offset from display-space to output-space
    const ratio = out.w / displaySize.w;
    const drawX = (out.w - drawW) / 2 + offset.x * ratio;
    const drawY = (out.h - drawH) / 2 + offset.y * ratio;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    const blob: Blob = await new Promise(resolve =>
      outCanvas.toBlob(b => resolve(b!), 'image/png', 0.95)
    );
    const croppedFile = new File([blob], `cropped-${mode}.png`, { type: 'image/png' });
    onDone(croppedFile);
  }, [imgSize, displaySize, offset, zoom, mode, onDone]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">
            {mode === 'avatar' ? 'Position Photo' : 'Position Cover'}
          </h3>
          <button onClick={onCancel} className="h-8 w-8 rounded-full hover:bg-accent flex items-center justify-center transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Canvas area */}
        <div ref={containerRef} className="relative flex items-center justify-center bg-black p-4">
          {!loaded && (
            <div className="flex items-center justify-center h-48">
              <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            className={`touch-none select-none cursor-grab active:cursor-grabbing ${mode === 'cover' ? 'border border-white/20 rounded-lg' : ''}`}
            style={{ display: loaded ? 'block' : 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onWheel={onWheel}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-border">
          <ZoomOut className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            type="range"
            min={100}
            max={300}
            value={Math.round(zoom * 100)}
            onChange={(e) => setZoom(clampZoom(Number(e.target.value) / 100))}
            className="flex-1 h-1.5 appearance-none bg-gray-700 rounded-full accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDone}
            disabled={!loaded}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Check className="h-4 w-4" />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
