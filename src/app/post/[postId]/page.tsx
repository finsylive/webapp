"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Post, fetchPostById, fetchReplies, createReply, createPost } from "@/api/posts";
import { PostCard } from "@/components/posts/PostCard";
import { useAuth } from "@/context/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/utils/supabase";
import { compressMediaBatch } from "@/utils/mediaCompressor";
import { toProxyUrl } from '@/utils/imageUtils';

// Define a new type that extends Post with nested replies
type PostWithReplies = Omit<Post, 'replies'> & {
  replies: PostWithReplies[];
};

// Use the optimized toProxyUrl utility (replaces toImageProxy)
const toImageProxy = (rawUrl: string) => toProxyUrl(rawUrl, { width: 40, quality: 82 });

// Recursively fetch replies for a post and build the reply tree
async function fetchRepliesTree(parentPostId: string): Promise<PostWithReplies[]> {
  const { data: replies, error } = await fetchReplies(parentPostId);
  if (error || !replies) return [];

  // Fetch replies for each reply
  const repliesWithNested = await Promise.all(
    replies.map(async (reply) => {
      const nestedReplies = await fetchRepliesTree(reply.id);
      return {
        ...reply,
        replies: nestedReplies,
      } as PostWithReplies;
    })
  );

  return repliesWithNested;
}

// Function to fetch a post with its reply tree
async function fetchPostWithReplies(postId: string): Promise<PostWithReplies | null> {
  const { data: post, error } = await fetchPostById(postId);
  if (error || !post) return null;

  const replies = await fetchRepliesTree(postId);
  return {
    ...post,
    replies,
  };
}

// Component for rendering reply posts with proper typing
function ReplyPostCard({ post, onReply }: { post: PostWithReplies, onReply?: () => void }) {
  const [avatarError, setAvatarError] = useState(false);
  
  // Deleted placeholder UI
  if (post.deleted) {
    const initial = post.author?.username?.charAt(0).toUpperCase() || 'U';
    const handle = post.author?.handle || post.author?.username || 'user';
    return (
      <div className="border-l-2 border-gray-200 pl-4">
        <div className="mt-2 flex items-start gap-3 rounded-2xl bg-muted/10 border border-border/60 px-4 py-3 text-muted-foreground">
          {post.author?.avatar_url && !avatarError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={toImageProxy(post.author.avatar_url)}
              alt={handle}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-muted/40 to-muted/20 flex items-center justify-center text-xs font-semibold">
              {initial}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <div className="text-xs text-foreground/70">@{handle}</div>
            <div className="italic text-sm select-none">This reply has been deleted</div>
          </div>
        </div>
      </div>
    );
  }

  // Convert back to regular Post for the PostCard component
  const postData: Post = {
    ...post,
    replies: post.replies.length // Convert back to number for the PostCard
  };

  return (
    <div className="border-l-2 border-gray-200 pl-4">
      <PostCard post={postData} onReply={onReply} />
    </div>
  );
}

// Recursive component to render reply tree
function ReplyTree({ replies, onReply }: { replies: PostWithReplies[]; onReply?: () => void }) {
  if (!replies || replies.length === 0) return null;
  
  return (
    <div className="space-y-4">
      {replies.map((reply) => (
        <div key={reply.id}>
          <ReplyPostCard post={reply} onReply={onReply} />
          {/* Recursively render children if present */}
          {reply.replies && reply.replies.length > 0 && (
            <div className="ml-6 mt-2">
              <ReplyTree replies={reply.replies} onReply={onReply} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function PostPage() {
  const { postId } = useParams<{ postId: string }>();
  const [post, setPost] = useState<PostWithReplies | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!postId) return;
    fetchPostWithReplies(postId as string).then((data) => {
      setPost(data);
      setLoading(false);
    });
  }, [postId]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!post) return <div className="p-8 text-center">Post not found.</div>;

  // Convert main post back to regular Post type for the PostCard
  const mainPost: Post = {
    ...post,
    replies: post.replies.length // Convert to number
  };

  const focusReply = () => {
    // Scroll to bottom where composer sits and focus
    try {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch {}
    inputRef.current?.focus();
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      setError("You must be logged in to reply.");
      return;
    }
    if (!replyContent.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      // If media attached, create a media reply and upload files
      if (selectedMedia.length > 0) {
        setIsUploading(true);
        const { data: replyPost, error: postErr } = await createPost(
          user.id,
          mainPost.environment_id,
          replyContent.trim(),
          'media',
          mainPost.id
        );
        if (postErr || !replyPost) {
          setError(postErr?.message || 'Failed to create media reply');
        } else {
          // upload each file via edge and insert into post_media
          for (const file of selectedMedia) {
            // Status update per file (videos: compression occurs server-side)
            if (file.type.startsWith('video/')) {
              setUploadStatus('Compressing video on server…');
            } else if (file.type.startsWith('image/')) {
              setUploadStatus('Uploading image…');
            } else {
              setUploadStatus('Uploading…');
            }
            try {
              const uploaded = await uploadFileViaEdge(file, user.id);
              const { error: mediaError } = await supabase
                .from('post_media')
                .insert({
                  post_id: replyPost.id,
                  media_url: uploaded.url,
                  media_type: uploaded.type?.startsWith('video/') ? 'video' : 'photo',
                  width: uploaded.width ?? null,
                  height: uploaded.height ?? null,
                  created_at: new Date().toISOString()
                });
              if (mediaError) console.error('post_media insert error', mediaError);
            } catch (upErr) {
              console.error('Upload failed', upErr);
              setError('One of the media uploads failed. Others may have succeeded.');
            }
          }
          setUploadStatus('');
          // Clear media selection
          mediaPreviews.forEach((url) => URL.revokeObjectURL(url));
          setSelectedMedia([]);
          setMediaPreviews([]);
          setReplyContent('');
          // Refresh
          const refreshed = await fetchPostWithReplies(mainPost.id);
          setPost(refreshed);
        }
        setIsUploading(false);
        setUploadStatus('');
      } else {
        // text-only reply
        const { error } = await createReply({
          authorId: user.id,
          environmentId: mainPost.environment_id,
          parentPostId: mainPost.id,
          content: replyContent.trim(),
        });
        if (error) {
          setError(error.message || "Failed to post reply.");
        } else {
          setReplyContent("");
          const refreshed = await fetchPostWithReplies(mainPost.id);
          setPost(refreshed);
        }
      }
    } catch (err: unknown) {
      const error = err as Error | undefined;
      setError(error?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  // Edge upload helpers (mirrors CreatePostInput minimal)
  const EDGE_UPLOAD_URL = 'https://lrgwsbslfqiwoazmitre.supabase.co/functions/v1/upload-post-media';
  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  type EdgeUploadResponse = { imageUrl: string; fileType: string; width?: number; height?: number };
  const uploadFileViaEdge = async (file: File, userId: string) => {
    const safeName = file.name.replace(/[^A-Za-z0-9_.-]/g, '_');
    const dataUrl = await fileToDataUrl(file);
    const isVideo = file.type.startsWith('video/');
    // Send server-side compression hints for videos. Images may still be pre-compressed client-side.
    const payload: Record<string, unknown> = {
      imageData: dataUrl,
      fileName: safeName,
      userId,
      fileType: file.type,
      isVideo,
    };
    if (isVideo) {
      payload.videoOptions = {
        maxWidth: 1280,
        maxHeight: 1280,
        targetBitrateKbps: 2500, // ~2.5 Mbps target
        crf: 28,
        preset: 'veryfast',
        faststart: true,
      };
      console.info('[compress] video will be compressed server-side with', payload.videoOptions);
    }
    const attempt = async () => {
      const res = await fetch(EDGE_UPLOAD_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error((json?.error as string) || `Upload failed: ${res.status}`);
      return { url: (json as EdgeUploadResponse).imageUrl, type: (json as EdgeUploadResponse).fileType, width: (json as EdgeUploadResponse).width, height: (json as EdgeUploadResponse).height };
    };
    try { return await attempt(); } catch { await new Promise(r => setTimeout(r, 300)); return await attempt(); }
  };

  const onSelectFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      // Compress images/videos before preview and upload
      const originalArr = Array.from(files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
      const results = await compressMediaBatch(files);
      // Log sizes to console
      results.forEach((r, i) => {
        const orig = originalArr[i];
        if (!orig) return;
        const origKB = (orig.size / 1024).toFixed(1);
        const compKB = (r.file.size / 1024).toFixed(1);
        const savings = orig.size > 0 ? (((orig.size - r.file.size) / orig.size) * 100).toFixed(1) : '0.0';
        console.log(
          `[compress] ${orig.name} -> ${r.file.name} | ${origKB} KB -> ${compKB} KB | ${r.wasCompressed ? `saved ${savings}%` : `no change${r.reason ? ` (${r.reason})` : ''}`}`
        );
      });
      const compressedFiles = results.map(r => r.file);
      const previewUrls = results.map(r => r.previewUrl);
      if (compressedFiles.length === 0) return;
      setSelectedMedia(prev => [...prev, ...compressedFiles]);
      setMediaPreviews(prev => [...prev, ...previewUrls]);
    } catch {
      // Fallback: if compression fails unexpectedly, add originals
      const arr = Array.from(files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
      const previews = arr.map(f => URL.createObjectURL(f));
      setSelectedMedia(prev => [...prev, ...arr]);
      setMediaPreviews(prev => [...prev, ...previews]);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto p-4 pb-28">{/* extra bottom padding for fixed composer */}
        <PostCard post={mainPost} onReply={focusReply} />

        <h4 className="mt-8 mb-4 text-lg font-semibold">Replies</h4>
        <ReplyTree replies={post.replies} onReply={focusReply} />

        {/* Fixed bottom reply composer (mobile-first) */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <form onSubmit={handleSubmitReply} className="mx-auto max-w-2xl px-4 py-3">
            {/* pill */}
            <div className="flex items-center gap-3 rounded-full bg-card/90 border border-border px-3 py-2 shadow-lg">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary font-semibold">
                {(user?.user_metadata?.username?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </div>
              {/* Input */}
              <input
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                placeholder={`Reply to ${mainPost.author?.username ? '@' + (mainPost.author.handle || mainPost.author.username) : 'post'}...`}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                disabled={submitting}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (replyContent.trim() && !submitting) handleSubmitReply(e as React.FormEvent);
                  }
                }}
              />
              {/* Media count indicator */}
              {selectedMedia.length > 0 && (
                <div className="text-xs text-muted-foreground mr-1">{selectedMedia.length}</div>
              )}
              {/* Add Content button (opens sheet) */}
              <button
                type="button"
                onClick={() => setShowAddSheet(true)}
                className="ml-auto inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white"
                aria-label="Add content"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
            {/* Selected media previews */}
            {mediaPreviews.length > 0 && (
              <div className="mt-2 grid grid-cols-5 gap-2 px-1">
                {mediaPreviews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border">
                    {/* Using img/video to keep lightweight here */}
                    {selectedMedia[i]?.type.startsWith('video/') ? (
                      <video src={src} className="w-full h-full object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="preview" className="w-full h-full object-cover" />
                    )}
                    <button type="button" onClick={() => { setSelectedMedia(prev => prev.filter((_, idx) => idx !== i)); setMediaPreviews(prev => prev.filter((_, idx) => idx !== i)); URL.revokeObjectURL(src); }} className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs">×</button>
                  </div>
                ))}
              </div>
            )}
            {/* Inline status and error */}
            {uploadStatus && (
              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <span>{uploadStatus}</span>
              </div>
            )}
            {/* Inline error */}
            {error && (
              <div className="mt-2 text-xs text-red-500">{error}</div>
            )}
          </form>
          {/* Hidden file inputs */}
          <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onSelectFiles(e.target.files)} />
          <input ref={videoInputRef} type="file" accept="video/*" multiple className="hidden" onChange={(e) => onSelectFiles(e.target.files)} />
        </div>
      </div>

      {/* Floating Add button removed to avoid duplicate; use inline plus in composer */}

      {/* Add Content Bottom Sheet */}
      {showAddSheet && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddSheet(false)} />
          {/* Sheet (larger rectangular panel) */}
          <div className="absolute inset-x-0 bottom-0 pb-6">
            <div className="mx-auto w-[96%] max-w-2xl md:max-w-3xl rounded-xl bg-card border border-border shadow-2xl">
              {/* Grab handle */}
              <div className="flex justify-center pt-3">
                <div className="h-1.5 w-10 rounded-full bg-border" />
              </div>
              <h3 className="text-center text-xs font-semibold text-muted-foreground mt-2">Add Content</h3>
              <div className="p-4 md:p-5 space-y-3">
                <button
                  className="w-full flex items-center justify-between rounded-lg border border-border bg-background/80 px-4 py-3.5 hover:bg-accent/40 transition-colors"
                  onClick={() => { setShowAddSheet(false); imageInputRef.current?.click(); }}
                >
                  <span className="text-sm md:text-base font-semibold">Photo</span>
                  <span className="text-[11px] md:text-xs text-muted-foreground">Choose from gallery or camera</span>
                </button>
                <button
                  className="w-full flex items-center justify-between rounded-lg border border-border bg-background/80 px-4 py-3.5 hover:bg-accent/40 transition-colors"
                  onClick={() => { setShowAddSheet(false); videoInputRef.current?.click(); }}
                >
                  <span className="text-sm md:text-base font-semibold">Video</span>
                  <span className="text-[11px] md:text-xs text-muted-foreground">Record or choose from gallery</span>
                </button>
                <button
                  className="w-full flex items-center justify-between rounded-lg border border-border bg-background/80 px-4 py-3.5 hover:bg-accent/40 transition-colors"
                  onClick={() => { setShowAddSheet(false); setError('Poll replies coming soon.'); }}
                >
                  <span className="text-sm md:text-base font-semibold">Poll</span>
                  <span className="text-[11px] md:text-xs text-muted-foreground">Create a poll for your post</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}