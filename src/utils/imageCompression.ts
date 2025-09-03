export type CompressOptions = {
  maxWidth?: number; // default 1024
  maxHeight?: number; // default 1024
  quality?: number; // 0..1 default 0.82
  mimeType?: 'image/avif' | 'image/webp' | 'image/jpeg';
};

function supportType(type: string) {
  const c = document.createElement('canvas');
  if (!c.toDataURL) return false;
  try {
    return c.toDataURL(type).startsWith(`data:${type}`);
  } catch {
    return false;
  }
}

function pickBestFormat(): 'image/avif' | 'image/webp' | 'image/jpeg' {
  if (supportType('image/avif')) return 'image/avif';
  if (supportType('image/webp')) return 'image/webp';
  return 'image/jpeg';
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<Blob> {
  const { maxWidth = 1024, maxHeight = 1024, quality = 0.82 } = opts;
  const mimeType = opts.mimeType || pickBestFormat();

  const bitmap = await createImageBitmap(file, { premultiplyAlpha: 'default', colorSpaceConversion: 'default' });

  let targetW = bitmap.width;
  let targetH = bitmap.height;
  const ratio = Math.min(maxWidth / targetW, maxHeight / targetH, 1);
  targetW = Math.round(targetW * ratio);
  targetH = Math.round(targetH * ratio);

  const useOffscreen = typeof OffscreenCanvas !== 'undefined';
  const canvas: HTMLCanvasElement | OffscreenCanvas = useOffscreen
    ? new OffscreenCanvas(targetW, targetH)
    : (document.createElement('canvas'));
  if (!useOffscreen) {
    (canvas as HTMLCanvasElement).width = targetW;
    (canvas as HTMLCanvasElement).height = targetH;
  }
  const ctx = (canvas as any).getContext('2d', { alpha: true, desynchronized: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  // Avoid blocking main thread too long by yielding
  await new Promise(requestAnimationFrame);

  const blob: Blob = await (canvas as any).convertToBlob
    ? (canvas as any).convertToBlob({ type: mimeType, quality })
    : new Promise<Blob>((resolve) => (canvas as HTMLCanvasElement).toBlob((b) => resolve(b as Blob), mimeType, quality));

  bitmap.close?.();
  return blob;
}
