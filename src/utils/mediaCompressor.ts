// Lightweight client-side media compression utilities
// - Images: compress via canvas to target max size and JPEG/WebP quality
// - Videos: try to transcode with ffmpeg.wasm when available (lazy-loaded), otherwise fallback to original

export type CompressedResult = {
  file: File;
  previewUrl: string; // object URL for UI preview
  width?: number;
  height?: number;
  wasCompressed: boolean;
  reason?: string; // if not compressed, why
};

const DEFAULT_IMAGE_MAX = 1080; // Match mobile app: max 1080x1080px
const DEFAULT_IMAGE_QUALITY = 0.82; // Match mobile app: 82% quality

function isHeicOrHeif(type: string, name: string) {
  const lower = `${type}|${name}`.toLowerCase();
  return lower.includes('heic') || lower.includes('heif');
}

export async function compressImage(
  file: File,
  options?: { maxSide?: number; quality?: number; mimeType?: 'image/jpeg' | 'image/webp' }
): Promise<CompressedResult> {
  const maxSide = options?.maxSide ?? DEFAULT_IMAGE_MAX;
  const quality = Math.min(1, Math.max(0.4, options?.quality ?? DEFAULT_IMAGE_QUALITY));
  const outputType = options?.mimeType ?? (file.type === 'image/webp' ? 'image/webp' : 'image/jpeg');

  // Skip GIFs and HEIC for now; browsers can't draw animated GIFs or HEIC reliably on canvas without converters
  if (file.type === 'image/gif' || isHeicOrHeif(file.type, file.name)) {
    const url = URL.createObjectURL(file);
    return { file, previewUrl: url, wasCompressed: false, reason: 'gif/heic not handled' };
  }

  const imgUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(imgUrl);
    const { canvas, width, height, scaled } = drawToCanvas(img, maxSide);

    // If not scaled and file already small (< 1.5MB), skip re-encode to avoid quality loss
    const shouldSkip = !scaled && file.size < 1_500_000;
    if (shouldSkip && (outputType === file.type || file.type === 'image/png')) {
      const sizeKB = (file.size / 1024).toFixed(2);
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      console.log(`[Image Skip] ${file.name}:`);
      console.log(`  File size: ${sizeKB} KB (${sizeMB} MB)`);
      console.log(`  Reason: Already small, no compression needed`);
      return { file, previewUrl: imgUrl, width, height, wasCompressed: false, reason: 'already small' };
    }

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))), outputType, quality)
    );

    // If blob somehow larger, keep original
    if (blob.size >= file.size) {
      const originalKB = (file.size / 1024).toFixed(2);
      const originalMB = (file.size / (1024 * 1024)).toFixed(2);
      const compressedKB = (blob.size / 1024).toFixed(2);
      const compressedMB = (blob.size / (1024 * 1024)).toFixed(2);
      console.log(`[Image Skip] ${file.name}:`);
      console.log(`  Original size: ${originalKB} KB (${originalMB} MB)`);
      console.log(`  Compressed would be: ${compressedKB} KB (${compressedMB} MB)`);
      console.log(`  Reason: No size reduction, keeping original`);
      return { file, previewUrl: imgUrl, width, height, wasCompressed: false, reason: 'no size win' };
    }

    const newName = renameWithSuffix(file.name, outputType === 'image/webp' ? 'webp' : 'jpg', 'compressed');
    const compressedFile = new File([blob], newName, { type: blob.type, lastModified: Date.now() });
    
    // Log compression results
    const originalKB = (file.size / 1024).toFixed(2);
    const compressedKB = (compressedFile.size / 1024).toFixed(2);
    const originalMB = (file.size / (1024 * 1024)).toFixed(2);
    const compressedMB = (compressedFile.size / (1024 * 1024)).toFixed(2);
    const reduction = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
    console.log(`[Image Compressed] ${file.name}:`);
    console.log(`  Original size: ${originalKB} KB (${originalMB} MB)`);
    console.log(`  Compressed size: ${compressedKB} KB (${compressedMB} MB)`);
    console.log(`  Size reduction: ${reduction}%`);
    
    URL.revokeObjectURL(imgUrl);
    return { file: compressedFile, previewUrl: URL.createObjectURL(compressedFile), width, height, wasCompressed: true };
  } catch {
    // Fallback to original
    return { file, previewUrl: imgUrl, wasCompressed: false, reason: 'compress failed' };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.src = src;
  });
}

function drawToCanvas(img: HTMLImageElement, maxSide: number) {
  const { naturalWidth: w, naturalHeight: h } = img;
  let width = w;
  let height = h;
  const larger = Math.max(w, h);
  const scale = larger > maxSide ? maxSide / larger : 1;
  const scaled = scale < 1;
  if (scaled) {
    width = Math.round(w * scale);
    height = Math.round(h * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not available');
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height, scaled };
}

function renameWithSuffix(name: string, ext: string, suffix: string) {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.${suffix}.${ext}`;
}

export async function compressVideo(
  file: File,
  options?: { maxSizeMB?: number; quality?: number }
): Promise<CompressedResult> {
  const maxSizeMB = options?.maxSizeMB ?? 15; // Match mobile app: 15MB threshold
  const quality = options?.quality ?? 0.6; // Default 0.6 quality for better compression
  
  // Match mobile app: only compress videos > 15MB
  if (file.size < (maxSizeMB * 1024 * 1024)) {
    const videoKB = (file.size / 1024).toFixed(2);
    const videoMB = (file.size / (1024 * 1024)).toFixed(2);
    console.log(`[Video Skip] ${file.name}:`);
    console.log(`  File size: ${videoKB} KB (${videoMB} MB)`);
    console.log(`  Reason: Below ${maxSizeMB}MB threshold, no compression needed`);
    return { file, previewUrl: URL.createObjectURL(file), wasCompressed: false, reason: 'already small' };
  }
  
  try {
    // Create video element to load and process the video
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = reject;
      video.src = videoUrl;
    });
    
    // Check if we can use MediaRecorder for compression
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx || !window.MediaRecorder || !MediaRecorder.isTypeSupported('video/webm')) {
      // Fallback: Can't compress in browser, return original
      const videoKB = (file.size / 1024).toFixed(2);
      const videoMB = (file.size / (1024 * 1024)).toFixed(2);
      console.log(`[Video Skip] ${file.name}:`);
      console.log(`  File size: ${videoKB} KB (${videoMB} MB)`);
      console.log(`  Reason: Browser doesn't support video compression`);
      URL.revokeObjectURL(videoUrl);
      return { file, previewUrl: URL.createObjectURL(file), wasCompressed: false, reason: 'browser not supported' };
    }
    
    // Set canvas dimensions based on video, with max width/height of 960px for better compression
    const maxDimension = 960;
    let { videoWidth: width, videoHeight: height } = video;
    
    // Always scale down if larger than 960px, or scale to 75% if smaller (for compression)
    if (width > maxDimension || height > maxDimension) {
      const scale = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    } else if (file.size > 1_000_000) {
      // For videos between 500KB-1MB that are not too large in dimensions, 
      // reduce dimensions by 25% to help with compression
      width = Math.round(width * 0.75);
      height = Math.round(height * 0.75);
    }
    
    canvas.width = width;
    canvas.height = height;
    
    // Calculate bitrate based on target size and duration
    const duration = video.duration;
    const targetSizeBytes = maxSizeMB * 1024 * 1024;
    const targetBitrate = Math.floor((targetSizeBytes * 8) / duration * quality);
    
    // Setup MediaRecorder
    const stream = canvas.captureStream(30); // 30 fps
    const chunks: Blob[] = [];
    
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm',
      videoBitsPerSecond: Math.min(targetBitrate, 1500000) // Max 1.5 Mbps for better compression
    });
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    const recordingComplete = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };
    });
    
    // Start recording and play video to canvas
    recorder.start();
    video.currentTime = 0;
    video.playbackRate = 1.0; // Keep normal playback speed
    
    // Set up frame drawing with proper timing
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS; // ~33ms per frame
    let lastFrameTime = 0;
    
    const drawFrame = (currentTime: number) => {
      if (!video.paused && !video.ended) {
        // Only draw frame if enough time has passed (maintain consistent FPS)
        if (currentTime - lastFrameTime >= frameInterval) {
          ctx.drawImage(video, 0, 0, width, height);
          lastFrameTime = currentTime;
        }
        requestAnimationFrame(drawFrame);
      } else {
        recorder.stop();
      }
    };
    
    // Start the video and drawing
    await video.play();
    requestAnimationFrame(drawFrame);
    
    // Wait for video to finish naturally
    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });
    
    const compressedBlob = await recordingComplete;
    
    // Clean up
    URL.revokeObjectURL(videoUrl);
    
    // Check if compression actually reduced size
    if (compressedBlob.size >= file.size) {
      const originalKB = (file.size / 1024).toFixed(2);
      const originalMB = (file.size / (1024 * 1024)).toFixed(2);
      const compressedKB = (compressedBlob.size / 1024).toFixed(2);
      const compressedMB = (compressedBlob.size / (1024 * 1024)).toFixed(2);
      console.log(`[Video Skip] ${file.name}:`);
      console.log(`  Original size: ${originalKB} KB (${originalMB} MB)`);
      console.log(`  Compressed would be: ${compressedKB} KB (${compressedMB} MB)`);
      console.log(`  Reason: No size reduction, keeping original`);
      return { file, previewUrl: URL.createObjectURL(file), wasCompressed: false, reason: 'no size win' };
    }
    
    // Create compressed file
    const newName = renameWithSuffix(file.name, 'webm', 'compressed');
    const compressedFile = new File([compressedBlob], newName, { 
      type: 'video/webm', 
      lastModified: Date.now() 
    });
    
    // Log compression results
    const originalKB = (file.size / 1024).toFixed(2);
    const originalMB = (file.size / (1024 * 1024)).toFixed(2);
    const compressedKB = (compressedFile.size / 1024).toFixed(2);
    const compressedMB = (compressedFile.size / (1024 * 1024)).toFixed(2);
    const reduction = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
    console.log(`[Video Compressed] ${file.name}:`);
    console.log(`  Original size: ${originalKB} KB (${originalMB} MB)`);
    console.log(`  Compressed size: ${compressedKB} KB (${compressedMB} MB)`);
    console.log(`  Size reduction: ${reduction}%`);
    console.log(`  New dimensions: ${width}x${height}`);
    
    return { 
      file: compressedFile, 
      previewUrl: URL.createObjectURL(compressedFile), 
      width, 
      height, 
      wasCompressed: true 
    };
    
  } catch (error) {
    // Fallback to original on any error
    const videoKB = (file.size / 1024).toFixed(2);
    const videoMB = (file.size / (1024 * 1024)).toFixed(2);
    console.log(`[Video Error] ${file.name}:`);
    console.log(`  File size: ${videoKB} KB (${videoMB} MB)`);
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.log(`  Reason: Compression failed, using original`);
    return { file, previewUrl: URL.createObjectURL(file), wasCompressed: false, reason: 'compress failed' };
  }
}

export async function compressMediaFile(file: File): Promise<CompressedResult> {
  if (file.type.startsWith('image/')) {
    return await compressImage(file);
  }
  if (file.type.startsWith('video/')) {
    return await compressVideo(file);
  }
  const url = URL.createObjectURL(file);
  return { file, previewUrl: url, wasCompressed: false, reason: 'unsupported type' };
}

export async function compressMediaBatch(files: FileList | File[]): Promise<CompressedResult[]> {
  const arr = Array.from(files);
  const results: CompressedResult[] = [];
  for (const f of arr) {
    // Only accept images/videos
    if (!(f.type.startsWith('image/') || f.type.startsWith('video/'))) continue;
    const r = await compressMediaFile(f);
    results.push(r);
  }
  return results;
}
