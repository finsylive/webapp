import { supabase } from './supabase';

type UploadResponse = {
  url: string;
  path: string;
  error?: string;
};

// Convert file to base64 data URL
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

export async function uploadMediaFile(file: File, isVideo: boolean = false): Promise<UploadResponse> {
  try {
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const userId = (await supabase.auth.getUser()).data.user?.id;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Convert file to base64 for edge function (matches mobile app)
    const base64Data = await fileToBase64(file);
    
    // Call edge function to upload to S3 (matching mobile app)
    const { data: uploadResult, error: uploadError } = await supabase.functions.invoke('upload-post-media', {
      body: {
        imageData: base64Data,
        fileName: fileName,
        userId: userId,
        fileType: file.type,
        isVideo: isVideo,
        // Add video dimensions if it's a video
        ...(isVideo && {
          videoWidth: 1920, // Default, should be extracted from video
          videoHeight: 1080
        })
      }
    });

    if (uploadError || !uploadResult?.imageUrl) {
      // Fallback to direct Supabase storage for large files
      console.warn('Edge function upload failed, using fallback:', uploadError);
      
      const filePath = `media/${userId}/${fileName}`;
      const { data, error: storageError } = await supabase.storage
        .from('media')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: true
        });

      if (storageError) {
        throw storageError;
      }

      const { data: publicUrlData } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      return {
        url: publicUrlData.publicUrl,
        path: filePath,
      };
    }

    return {
      url: uploadResult.imageUrl,
      path: `media/${userId}/${fileName}`,
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    return {
      url: '',
      path: '',
      error: error instanceof Error ? error.message : 'Failed to upload file',
    };
  }
}

export async function uploadPostMedia(files: File[]): Promise<{ urls: string[]; error?: string }> {
  try {
    const uploadPromises = files.map(file => {
      const isVideo = file.type.startsWith('video/');
      return uploadMediaFile(file, isVideo);
    });
    const results = await Promise.all(uploadPromises);
    
    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      console.error('Some files failed to upload:', errors);
      return {
        urls: results.filter(r => r.url).map(r => r.url),
        error: `Failed to upload ${errors.length} file(s)`
      };
    }

    return {
      urls: results.map(r => r.url)
    };
  } catch (error) {
    console.error('Error in uploadPostMedia:', error);
    return {
      urls: [],
      error: error instanceof Error ? error.message : 'Failed to upload files'
    };
  }
}

// Alias for backward compatibility
export const uploadPostImages = uploadPostMedia;
