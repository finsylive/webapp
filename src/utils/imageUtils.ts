import { supabase } from './supabase';

/**
 * Converts S3 URLs to proxy URLs with optimization parameters
 * Matches mobile app functionality for consistent media handling
 */
export function toProxyUrl(
  rawUrl: string | null | undefined,
  options?: {
    width?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'auto';
  }
): string {
  if (!rawUrl) return '';

  // If already a proxy URL, return as-is
  if (rawUrl.includes('/functions/v1/get-image')) {
    return rawUrl;
  }

  // If it is a local relative URL, return as-is
  if (rawUrl.startsWith('/')) {
    return rawUrl;
  }

  // Supabase Storage public URLs — serve directly without proxy
  // Matches both https://<project>.supabase.co/storage/... and custom domains like api.ments.app/storage/...
  if (rawUrl.includes('/storage/v1/object/public/')) {
    return rawUrl;
  }

  // External CDN URLs that don't need proxying — return directly
  try {
    const url = new URL(rawUrl);
    const directHosts = [
      'lh3.googleusercontent.com',  // Google profile pictures
      'platform-lookaside.fbsbx.com', // Facebook profile pictures
      'avatars.githubusercontent.com', // GitHub avatars
      'images.unsplash.com',          // Unsplash images
    ];
    if (directHosts.includes(url.hostname)) {
      return rawUrl;
    }
  } catch {
    // Invalid URL — fall through to proxy
  }

  // Build query parameters with optimization settings
  const params = new URLSearchParams({
    url: rawUrl,
  });

  // Add optimization parameters to match mobile app
  if (options?.width) {
    params.append('w', options.width.toString());
  }
  if (options?.quality) {
    params.append('q', options.quality.toString());
  } else {
    params.append('q', '82'); // Default to 82% quality (matches mobile)
  }
  if (options?.format) {
    params.append('f', options.format);
  }

  return `https://lrgwsbslfqiwoazmitre.supabase.co/functions/v1/get-image?${params.toString()}`;
}

/**
 * Fetches a signed URL for an image from Supabase Storage
 * @param imagePath The path to the image in the storage bucket
 * @returns A signed URL for the image or null if there was an error
 */
export async function getImageUrl(imagePath: string | null): Promise<string | null> {
  if (!imagePath) return null;

  try {
    // If the path is already a full URL, return it as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }

    // If it's a storage path, get a signed URL
    const { data, error } = await supabase.storage
      .from('media') // Updated to match actual bucket
      .createSignedUrl(imagePath, 3600); // URL expires in 1 hour

    if (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error in getImageUrl:', error);
    return null;
  }
}

/**
 * Gets a processed image URL from the Supabase function
 * @param imagePath The path to the image
 * @returns Processed image URL or null if there was an error
 */
export async function getProcessedImageUrl(imagePath: string | null): Promise<string | null> {
  if (!imagePath) return null;

  // Use the optimized proxy URL function
  return toProxyUrl(imagePath, { quality: 82, format: 'webp' });
}
