"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Image as ImageIcon, X, BarChart2, VideoIcon, Plus, Trash2, ChevronDown, Globe } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import { createPost, createPollPost, type CreatePollData, type Post } from '@/api/posts';
import { supabase } from '@/utils/supabase';
import { type CompressedResult } from '@/utils/mediaCompressor';
import { MentionDropdown } from './MentionDropdown';
import { notifyMentionedUsers } from '@/utils/mentions';
import { extractCleanUsername } from '@/utils/username';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { LoginPromptModal, useLoginPrompt } from '@/components/auth/LoginPromptModal';

// Zoomable image used in fullscreen preview
function ZoomableImage({ src, alt, onSwipe }: { src: string; alt?: string; onSwipe?: (dir: 'left' | 'right') => void }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const posStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Touch pinch/zoom
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const touchPanningRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchPosStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartTimeRef = useRef<number | null>(null);

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    const next = clamp(scale + delta, 1, 5);
    if (next === scale) return;
    // Zoom towards cursor: adjust translation so the point under cursor stays near
    const cx = e.clientX - window.innerWidth / 2;
    const cy = e.clientY - window.innerHeight / 2;
    const factor = next / scale;
    setPos(({ x, y }) => ({ x: x - cx * (factor - 1), y: y - cy * (factor - 1) }));
    setScale(next);
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...pos };
  };
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPos({ x: posStartRef.current.x + dx, y: posStartRef.current.y + dy });
  };
  const endDrag = () => { draggingRef.current = false; };

  const onDoubleClick = () => {
    if (scale === 1) {
      setScale(2);
    } else {
      setScale(1);
      setPos({ x: 0, y: 0 });
    }
  };

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      pinchStartDistRef.current = Math.hypot(dx, dy);
      pinchStartScaleRef.current = scale;
    } else if (e.touches.length === 1) {
      touchPanningRef.current = true;
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchPosStartRef.current = { ...pos };
      swipeStartXRef.current = e.touches[0].clientX;
      swipeStartTimeRef.current = Date.now();
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchStartDistRef.current;
      const next = clamp(pinchStartScaleRef.current * ratio, 1, 5);
      setScale(next);
    } else if (e.touches.length === 1 && touchPanningRef.current && touchStartRef.current) {
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      setPos({ x: touchPosStartRef.current.x + dx, y: touchPosStartRef.current.y + dy });
    }
  };

  const onTouchEnd = () => {
    pinchStartDistRef.current = null;
    touchPanningRef.current = false;
    // Detect swipe when not zoomed
    if (scale === 1 && swipeStartXRef.current !== null && swipeStartTimeRef.current !== null && touchStartRef.current) {
      const dt = Date.now() - swipeStartTimeRef.current;
      const dx = (touchStartRef.current ? touchStartRef.current.x : 0) - swipeStartXRef.current; // touchStartRef holds last move pos; use delta sign accordingly
      const absDx = Math.abs(dx);
      if (dt < 400 && absDx > 50 && onSwipe) {
        onSwipe(dx > 0 ? 'left' : 'right');
      }
    }
    swipeStartXRef.current = null;
    swipeStartTimeRef.current = null;
  };

  return (
    <div
      className="absolute inset-0 w-screen h-screen cursor-grab active:cursor-grabbing select-none"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onDoubleClick={onDoubleClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <Image
        src={src}
        alt={alt || 'preview'}
        draggable={false}
        unoptimized
        fill
        sizes="90vw"
        className="pointer-events-none select-none"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          maxWidth: '90vw',
          maxHeight: '90vh',
          objectFit: 'contain',
        }}
      />

      {/* Controls */}
      <div className="absolute bottom-6 right-6 flex items-center gap-2">
        <button
          className="bg-white/10 hover:bg-white/20 text-white rounded-md px-3 py-2"
          onClick={(e) => { e.stopPropagation(); setScale(s => clamp(s - 0.2, 1, 5)); }}
        >
          −
        </button>
        <div className="text-white/80 text-sm w-16 text-center">{Math.round(scale * 100)}%</div>
        <button
          className="bg-white/10 hover:bg-white/20 text-white rounded-md px-3 py-2"
          onClick={(e) => { e.stopPropagation(); setScale(s => clamp(s + 0.2, 1, 5)); }}
        >
          +
        </button>
        <button
          className="bg-white/10 hover:bg-white/20 text-white rounded-md px-3 py-2"
          onClick={(e) => { e.stopPropagation(); setScale(1); setPos({ x: 0, y: 0 }); }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}



type CreatePostInputProps = {
  onPostCreated?: (post: Post) => void;
  initialPostType?: 'text' | 'media' | 'poll';
};

export function CreatePostInput({ onPostCreated, initialPostType }: CreatePostInputProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [environmentId, setEnvironmentId] = useState<string | null>(null);
  interface EnvironmentItem { id: string; name: string; picture?: string | null; banner?: string | null; description?: string | null; }
  const [environments, setEnvironments] = useState<EnvironmentItem[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<EnvironmentItem | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [, setCompressedResults] = useState<CompressedResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<{ isCompressing: boolean; currentFile: string; progress: number }>({ isCompressing: false, currentFile: '', progress: 0 });
  const [pollData, setPollData] = useState<CreatePollData>({ question: '', options: ['', ''], poll_type: 'single_choice' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const loginPrompt = useLoginPrompt();
  const { userData } = useUserData();
  const MAX_CONTENT = 500;
  const CHAR_WARN_THRESHOLD = 400; // show counter after this many chars
  const [postType, setPostType] = useState<'text' | 'media' | 'poll'>(initialPostType ?? 'text');

  // Auto-resize textarea to fit content
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minH = window.innerWidth < 640 ? 80 : 100;
    el.style.height = `${Math.max(minH, el.scrollHeight)}px`;
  }, []);
  const [envQuery, setEnvQuery] = useState('');
  const [envLoading, setEnvLoading] = useState(true);
  const [isEnvDropdownOpen, setIsEnvDropdownOpen] = useState(false);
  const envDropdownRef = useRef<HTMLDivElement>(null);

  // Mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [mentionedUsers, setMentionedUsers] = useState<Map<string, string>>(new Map()); // username -> userId
  // Preview modal state for selected media
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedViaHoverRef = useRef(false);
  const shouldRequestFsRef = useRef(false);
  const [isPointerFine, setIsPointerFine] = useState(false);
  // Hover tooltip preview state (desktop only)
  const [hoverPreview, setHoverPreview] = useState<{ visible: boolean; index: number | null; x: number; y: number }>({ visible: false, index: null, x: 0, y: 0 });

  useEffect(() => {
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      const mq = window.matchMedia('(pointer: fine)');
      const update = () => setIsPointerFine(!!mq.matches);
      update();
      mq.addEventListener?.('change', update);
      return () => mq.removeEventListener?.('change', update);
    }
  }, []);

  // Auto-resize textarea on mount and content changes
  useEffect(() => { autoResize(); }, [content, autoResize]);

  // Attempt to enter fullscreen when opening preview (desktop-like behavior)
  useEffect(() => {
    const enterFs = async () => {
      try {
        const el = previewContainerRef.current as (HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }) | null;
        if (shouldRequestFsRef.current) {
          if (el?.requestFullscreen) {
            await el.requestFullscreen();
          } else {
            el?.webkitRequestFullscreen?.();
          }
        }
      } catch {
        // silently ignore
      }
    };
    if (previewIndex !== null) enterFs();
    // reset flag after attempt
    shouldRequestFsRef.current = false;
  }, [previewIndex]);

  // Lock background scroll when preview is open
  useEffect(() => {
    if (previewIndex !== null) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = original; };
    }
  }, [previewIndex]);

  const closePreview = async () => {
    setPreviewIndex(null);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
    openedViaHoverRef.current = false;
  };

  const handleHoverEnter = (index: number) => {
    if (!isPointerFine) return; // desktop-only
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      openedViaHoverRef.current = false;
      setHoverPreview(prev => ({ ...prev, visible: true, index }));
    }, 150);
  };

  const handleHoverMove = (e: React.MouseEvent) => {
    if (!isPointerFine) return;
    if (!hoverPreview.visible) return;
    const padding = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = e.clientX + 18;
    let y = e.clientY + 18;
    const boxW = 320, boxH = 320;
    if (x + boxW + padding > vw) x = e.clientX - boxW - 18;
    if (y + boxH + padding > vh) y = e.clientY - boxH - 18;
    setHoverPreview(prev => ({ ...prev, x, y }));
  };

  const handleHoverLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverPreview({ visible: false, index: null, x: 0, y: 0 });
  };

  // Edge function endpoint for uploading media
  const EDGE_UPLOAD_URL = 'https://lrgwsbslfqiwoazmitre.supabase.co/functions/v1/upload-post-media';

  // Convert a File to a data URL (base64) for the edge function
  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Upload a single file via Supabase Edge Function with filename sanitization and basic retry
  type EdgeUploadResponse = { imageUrl: string; fileType: string; width?: number; height?: number };
  type EdgeUploadPayload = { imageData: string; fileName: string; userId: string; fileType: string; isVideo: boolean };
  const uploadFileViaEdge = async (file: File, userId: string) => {
    // Replace spaces and special chars to avoid signature mismatch on S3 sig v2
    const safeName = file.name.replace(/[^A-Za-z0-9_.-]/g, '_');
    const dataUrl = await fileToDataUrl(file);
    const isVideo = file.type.startsWith('video/');
    const payload: EdgeUploadPayload = {
      imageData: dataUrl,
      fileName: safeName,
      userId,
      fileType: file.type,
      isVideo
    };

    const attempt = async () => {
      const res = await fetch(EDGE_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        // ignore
      }
      if (!res.ok) {
        const errMsg = (json as { error?: string } | null)?.error || `Upload failed: ${res.status}`;
        throw new Error(errMsg);
      }
      return {
        url: (json as EdgeUploadResponse).imageUrl,
        type: (json as EdgeUploadResponse).fileType,
        width: (json as EdgeUploadResponse).width,
        height: (json as EdgeUploadResponse).height
      };
    };

    try {
      return await attempt();
    } catch {
      // brief retry once (e.g., SignatureDoesNotMatch transient)
      await new Promise(r => setTimeout(r, 350));
      return await attempt();
    }
  };

  // Fetch environments and set default environment on component mount
  useEffect(() => {
    // If an environment is already selected, skip fetching again (satisfies exhaustive-deps)
    if (selectedEnvironment) return;
    const loadEnvironments = async () => {
      console.log('Fetching environments...');
      try {
        setEnvLoading(true);
        const response = await fetch('/api/environments', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log('Environments API response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Environments API error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          });
          throw new Error(
            errorData.error || 'Spaces could not be loaded right now. Try again?'
          );
        }

        const data = await response.json();
        console.log('Environments data received:', data);

        if (Array.isArray(data) && data.length > 0) {
          interface EnvironmentData {
            id: string;
            name: string;
            picture?: string;
            banner?: string;
            description?: string;
          }

          const formattedEnvs: EnvironmentItem[] = data.map((env: EnvironmentData) => ({
            id: env.id,
            name: env.name,
            picture: env.picture,
            banner: env.banner,
            description: env.description
          }));

          setEnvironments(formattedEnvs);

          const explicitDefault =
            formattedEnvs.find((env) => env.name.toLowerCase() === 'general')
            || formattedEnvs[0];

          // Set explicit default environment if none selected
          if (!selectedEnvironment) {
            setSelectedEnvironment(explicitDefault);
            setEnvironmentId(explicitDefault.id);
          }
        } else {
          console.warn('No environments available');
          setError('No spaces available. Please contact support.');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error in loadEnvironments:', errorMessage, error);
        setError(`Failed to load environments: ${errorMessage}`);
      } finally {
        setEnvLoading(false);
      }
    };

    loadEnvironments();
  }, [selectedEnvironment]);

  // Close env dropdown on outside click
  useEffect(() => {
    if (!isEnvDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (envDropdownRef.current && !envDropdownRef.current.contains(e.target as Node)) {
        setIsEnvDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isEnvDropdownOpen]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    console.log('[CreatePostInput] Processing media files...');
    setCompressionProgress({ isCompressing: true, currentFile: '', progress: 0 });

    try {
      // Process files one by one to show progress
      const fileArray = Array.from(files);
      const results: CompressedResult[] = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const isVideo = file.type.startsWith('video/');

        setCompressionProgress({
          isCompressing: true,
          currentFile: file.name,
          progress: Math.round((i / fileArray.length) * 100)
        });

        console.log(`[CreatePostInput] Processing ${isVideo ? 'video' : 'image'}: ${file.name}`);

        // Import and compress individual file
        const { compressMediaFile } = await import('@/utils/mediaCompressor');
        const result = await compressMediaFile(file);
        results.push(result);

        // Log compression result immediately
        if (result.wasCompressed) {
          console.log(`[CreatePostInput] ✅ ${file.name} compressed successfully`);
        } else {
          console.log(`[CreatePostInput] ⚠️ ${file.name} not compressed (${result.reason})`);
        }
      }

      // Extract compressed files and preview URLs
      const compressedFiles = results.map(r => r.file);
      const previews = results.map(r => r.previewUrl);

      setSelectedImages(prev => [...prev, ...compressedFiles]);
      setImagePreviews(prev => [...prev, ...previews]);
      setCompressedResults(prev => [...prev, ...results]);

      console.log(`[CreatePostInput] ✅ Completed processing ${results.length} files`);

    } catch (error) {
      console.error('[CreatePostInput] Error processing files:', error);
    } finally {
      setCompressionProgress({ isCompressing: false, currentFile: '', progress: 0 });
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setCompressedResults(prev => prev.filter((_, i) => i !== index));
    // Revoke the object URL to avoid memory leaks
    URL.revokeObjectURL(imagePreviews[index]);
  };

  // Poll helper functions
  const addPollOption = () => {
    if (pollData.options.length < 6) {
      setPollData(prev => ({ ...prev, options: [...prev.options, ''] }));
    }
  };

  const removePollOption = (index: number) => {
    if (pollData.options.length > 2) {
      setPollData(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }));
    }
  };

  const updatePollOption = (index: number, value: string) => {
    setPollData(prev => ({
      ...prev,
      options: prev.options.map((option, i) => i === index ? value : option)
    }));
  };

  const updatePollQuestion = (value: string) => {
    setPollData(prev => ({ ...prev, question: value }));
  };

  // Handle content change and detect mentions
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value.slice(0, MAX_CONTENT);
    const cursorPosition = e.target.selectionStart;
    setContent(newContent);
    autoResize();

    // Check for @ symbol before cursor
    const textBeforeCursor = newContent.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

      // Show dropdown if:
      // 1. We just typed @ (textAfterAt is empty)
      // 2. We're typing after @ without space/newline
      // 3. The @ is at the start or preceded by space/newline
      const charBeforeAt = lastAtIndex > 0 ? newContent[lastAtIndex - 1] : ' ';
      const isValidMentionStart = charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0;

      if (isValidMentionStart && !textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        console.log('[Mention] Showing dropdown, search:', textAfterAt);
        setMentionSearch(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        setShowMentionDropdown(true);

        // Calculate dropdown position relative to viewport
        if (textareaRef.current) {
          const textarea = textareaRef.current;
          const rect = textarea.getBoundingClientRect();

          // Position below cursor approximately
          const lines = newContent.substring(0, lastAtIndex).split('\n');
          const lineHeight = 24;
          const cursorY = rect.top + Math.min((lines.length * lineHeight) + 30, 100);

          const position = {
            top: cursorY,
            left: rect.left + 10
          };
          console.log('[Mention] Setting position:', position);
          setMentionPosition(position);
        }
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  // Handle user selection from mention dropdown
  const handleSelectUser = (user: {
    id: string;
    username: string;
    full_name?: string;
    avatar_url?: string;
  } | null) => {
    if (!user) {
      setShowMentionDropdown(false);
      return;
    }

    // Extract clean username using utility function
    const username = extractCleanUsername(user);

    const beforeMention = content.substring(0, mentionStartIndex);
    const afterMention = content.substring(mentionStartIndex + mentionSearch.length + 1);
    const newContent = `${beforeMention}@${username} ${afterMention}`.slice(0, MAX_CONTENT);

    setContent(newContent);
    setMentionedUsers(prev => new Map(prev).set(username, user.id)); // Store username -> userId for notifications
    setShowMentionDropdown(false);
    setMentionSearch('');

    // Focus back on textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
      const newCursorPosition = Math.min(beforeMention.length + username.length + 2, newContent.length);
      textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
    }
  };

  // Keyboard navigation for preview modal
  useEffect(() => {
    if (previewIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewIndex(null);
      if (e.key === 'ArrowRight' && imagePreviews.length > 0) setPreviewIndex((idx) => idx === null ? 0 : Math.min(idx + 1, imagePreviews.length - 1));
      if (e.key === 'ArrowLeft' && imagePreviews.length > 0) setPreviewIndex((idx) => idx === null ? 0 : Math.max(idx - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewIndex, imagePreviews.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() && selectedImages.length === 0 && postType !== 'poll') {
      setError('Please add some content or select images to post');
      return;
    }

    // Handle type-specific validation
    if (postType === 'poll') {
      if (!pollData.question.trim()) {
        setError('Please enter a poll question');
        return;
      }
      const validOptions = pollData.options.filter(opt => opt.trim());
      if (validOptions.length < 2) {
        setError('Please provide at least 2 poll options');
        return;
      }
    }
    if (postType === 'media' && selectedImages.length === 0) {
      setError('Please add at least one image or video for a media post');
      return;
    }

    if (!user) {
      loginPrompt.open('Sign in to post', 'You need to sign in to create a post.');
      return;
    }

    if (!environmentId) {
      setError('No space selected. Please try again later.');
      return;
    }

    setIsSubmitting(true);
    setIsUploading(true);
    setError(null);

    try {
      // Keep content as-is with simple @username format
      const processedContent = content;

      let postData;
      let postError;

      if (postType === 'poll') {
        // Create poll post
        const validOptions = pollData.options.filter(opt => opt.trim());
        const result = await createPollPost(
          user.id,
          environmentId,
          processedContent,
          pollData.question,
          validOptions,
          pollData.poll_type
        );
        postData = result.data;
        postError = result.error;
      } else {
        // Determine final post type for non-poll posts
        const finalType: 'text' | 'media' = (postType === 'media' || selectedImages.length > 0) ? 'media' : 'text';
        const result = await createPost(
          user.id,
          environmentId,
          processedContent,
          finalType
        );
        postData = result.data;
        postError = result.error;
      }

      if (postError) {
        throw postError;
      }

      // Upload and insert media one-by-one (only for media posts)
      if (selectedImages.length > 0 && postData && postType === 'media') {
        for (const file of selectedImages) {
          try {
            const uploaded = await uploadFileViaEdge(file, user.id);
            const { error: mediaError } = await supabase
              .from('post_media')
              .insert({
                post_id: postData.id,
                media_url: uploaded.url,
                media_type: uploaded.type?.startsWith('video/') ? 'video' : 'photo',
                width: uploaded.width ?? null,
                height: uploaded.height ?? null,
                created_at: new Date().toISOString()
              });
            if (mediaError) {
              console.error('Error inserting into post_media:', JSON.stringify(mediaError));
            }
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error('Upload failed for a media file:', msg);
            setError('One of the media uploads failed. Others may have succeeded.');
          }
        }
      }

      // Send notifications to mentioned users
      if (postData && mentionedUsers.size > 0) {
        await notifyMentionedUsers(postData.id, user.id, Array.from(mentionedUsers.values()));
      }

      // Build optimistic post so the feed can show it instantly
      const optimisticPost: Post = {
        id: postData!.id,
        author_id: user.id,
        environment_id: environmentId!,
        parent_post_id: null,
        content: processedContent,
        post_type: postData!.post_type ?? (postType === 'poll' ? 'poll' : selectedImages.length > 0 ? 'media' : 'text'),
        created_at: postData!.created_at ?? new Date().toISOString(),
        deleted: false,
        likes: 0,
        replies: 0,
        author: {
          id: user.id,
          username: userData?.username || user.user_metadata?.username || user.email?.split('@')[0] || 'you',
          avatar_url: userData?.avatar_url,
          full_name: userData?.full_name || user.user_metadata?.full_name,
          is_verified: userData?.is_verified || false,
        },
        environment: selectedEnvironment
          ? { id: selectedEnvironment.id, name: selectedEnvironment.name, picture: selectedEnvironment.picture ?? undefined }
          : undefined,
        media: postType === 'media' && imagePreviews.length > 0
          ? imagePreviews.map((url, i) => ({
            id: `optimistic-${i}`,
            post_id: postData!.id,
            media_url: url,
            media_type: (selectedImages[i]?.type?.startsWith('video/') ? 'video' : 'photo') as 'video' | 'photo',
            created_at: new Date().toISOString(),
          }))
          : [],
        poll: postType === 'poll'
          ? {
            id: `optimistic-poll-${postData!.id}`,
            post_id: postData!.id,
            question: pollData.question,
            poll_type: pollData.poll_type,
            created_at: new Date().toISOString(),
            options: pollData.options
              .filter((o) => o.trim())
              .map((text, i) => ({
                id: `optimistic-opt-${i}`,
                poll_id: `optimistic-poll-${postData!.id}`,
                option_text: text,
                votes: 0,
                position: i,
              })),
          }
          : null,
      };

      // Reset form
      setContent('');
      setSelectedImages([]);
      setImagePreviews([]);
      setCompressedResults([]);
      setPollData({ question: '', options: ['', ''], poll_type: 'single_choice' });
      setPostType('text');
      setMentionedUsers(new Map());

      if (onPostCreated) onPostCreated(optimisticPost);
    } catch (err) {
      console.error('Error creating post:', err);
      setError(err instanceof Error ? err.message : 'Your post couldn\u2019t be published. Please try again.');
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const filteredEnvs = environments.filter(env => env.name.toLowerCase().includes(envQuery.toLowerCase()));
  const isPostDisabled = (!content.trim() && selectedImages.length === 0 && postType !== 'poll') || isSubmitting || !environmentId || (postType === 'poll' && (!pollData.question.trim() || pollData.options.filter(opt => opt.trim()).length < 2));

  return (
    <>
    <form onSubmit={handleSubmit}>
      {/* Author row: avatar + name + space dropdown */}
      <div className="flex items-start gap-3 mb-4">
        <UserAvatar
          src={userData?.avatar_url}
          alt={userData?.full_name || user?.user_metadata?.full_name || 'User'}
          fallbackText={userData?.full_name || user?.user_metadata?.full_name || user?.email || 'U'}
          size={44}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {userData?.full_name || user?.user_metadata?.full_name || user?.email || 'User'}
          </p>
          <div className="relative" ref={envDropdownRef}>
            <button
              type="button"
              onClick={() => setIsEnvDropdownOpen(!isEnvDropdownOpen)}
              className="flex items-center gap-1.5 mt-1 px-2.5 py-1 bg-muted/50 hover:bg-muted border border-border rounded-lg text-sm transition-colors"
            >
              {selectedEnvironment?.picture ? (
                <Image src={selectedEnvironment.picture} alt={selectedEnvironment.name} width={14} height={14} unoptimized className="h-3.5 w-3.5 rounded-full object-cover" />
              ) : (
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="text-xs font-medium text-muted-foreground">{selectedEnvironment?.name || 'Select space'}</span>
              <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isEnvDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isEnvDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-popover rounded-xl shadow-xl border border-border z-50 overflow-hidden animate-in fade-in-0 zoom-in-95">
                <div className="p-2 border-b border-border">
                  <input
                    type="text"
                    value={envQuery}
                    onChange={(e) => setEnvQuery(e.target.value)}
                    placeholder="Search spaces..."
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto p-1.5">
                  {envLoading && (
                    <div className="space-y-1">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-8 rounded-lg bg-muted/50 animate-pulse" />
                      ))}
                    </div>
                  )}
                  {!envLoading && filteredEnvs.map(env => (
                    <button
                      key={env.id}
                      type="button"
                      onClick={() => { setSelectedEnvironment(env); setEnvironmentId(env.id); setIsEnvDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${selectedEnvironment?.id === env.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent/60 text-foreground'}`}
                    >
                      {env.picture ? (
                        <Image src={env.picture} alt={env.name} width={20} height={20} unoptimized className="h-5 w-5 rounded-full object-cover" />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px]">{env.name.charAt(0).toUpperCase()}</div>
                      )}
                      <span className="font-medium">{env.name}</span>
                    </button>
                  ))}
                  {!envLoading && filteredEnvs.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">No spaces found.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content textarea — borderless, auto-resizes */}
      <div className="relative mb-4">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          placeholder="What's on your mind?"
          className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-card-foreground placeholder:text-muted-foreground min-h-[80px] sm:min-h-[100px] p-0 resize-none overflow-hidden"
          spellCheck="false"
          autoComplete="off"
          rows={1}
        />
        <MentionDropdown
          searchTerm={mentionSearch}
          onSelectUser={handleSelectUser}
          position={mentionPosition}
          isVisible={showMentionDropdown}
        />
      </div>

      {/* Media section */}
      {(postType === 'media' || imagePreviews.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Media</h3>
            <button
              type="button"
              onClick={() => {
                setPostType('text');
                setSelectedImages([]);
                setImagePreviews([]);
                setCompressedResults([]);
              }}
              className="p-1 rounded-full hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Remove media"
              title="Remove media"
            >
              <X size={16} />
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,video/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
            disabled={isSubmitting || isUploading || compressionProgress.isCompressing}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting || isUploading || compressionProgress.isCompressing}
            className="group w-full rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/40 bg-muted/20 hover:bg-primary/5 transition-all duration-200 p-6 sm:p-8 flex flex-col items-center justify-center gap-3"
          >
            <div className={`flex items-center justify-center h-14 w-14 rounded-2xl transition-all duration-200 ${
              isUploading || compressionProgress.isCompressing
                ? 'bg-primary/10'
                : 'bg-primary/10 group-hover:bg-primary/20 group-hover:scale-105'
            }`}>
              {isUploading || compressionProgress.isCompressing ? (
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <ImageIcon className="h-7 w-7 text-primary" />
              )}
            </div>

            {compressionProgress.isCompressing ? (
              <div className="text-center w-full max-w-[240px]">
                <div className="text-sm font-semibold text-primary">Processing Media...</div>
                <div className="text-xs text-muted-foreground mt-1 truncate">{compressionProgress.currentFile}</div>
                <div className="w-full bg-muted rounded-full h-1.5 mt-3">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${compressionProgress.progress}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1.5">{compressionProgress.progress}%</div>
              </div>
            ) : (
              <>
                <div className="text-sm font-semibold text-foreground/80 group-hover:text-foreground transition-colors">Add Photos & Videos</div>
                <div className="text-xs text-muted-foreground/70">Drag or click to upload. Auto-optimized.</div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground/60 bg-muted/50 px-2.5 py-1 rounded-full">
                    <ImageIcon className="h-3 w-3" /> Photos
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground/60 bg-muted/50 px-2.5 py-1 rounded-full">
                    <VideoIcon className="h-3 w-3" /> Videos
                  </span>
                </div>
              </>
            )}
          </button>

          {/* Image/Video previews */}
          {imagePreviews.length > 0 && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {imagePreviews.map((preview, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-xl overflow-hidden border border-border cursor-pointer group"
                  onClick={(e) => { e.stopPropagation(); shouldRequestFsRef.current = true; openedViaHoverRef.current = false; setPreviewIndex(index); }}
                  onMouseEnter={() => handleHoverEnter(index)}
                  onMouseMove={handleHoverMove}
                  onMouseLeave={handleHoverLeave}
                >
                  {/* Show media type indicator */}
                  {selectedImages[index]?.type?.startsWith('video/') ? (
                    <>
                      <video src={preview} className="absolute inset-0 w-full h-full object-cover" muted />
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
                      <div className="absolute top-2 left-2 bg-black/70 rounded-full p-1">
                        <VideoIcon className="h-3 w-3 text-white" />
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md font-medium">VIDEO</div>
                    </>
                  ) : (
                    <>
                      <Image src={preview} alt={`Preview ${index + 1}`} fill className="object-cover" unoptimized />
                      <div className="absolute top-2 left-2 bg-black/70 rounded-full p-1">
                        <ImageIcon className="h-3 w-3 text-white" />
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                    className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 rounded-full p-1"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hover tooltip preview (desktop only) */}
      {isPointerFine && hoverPreview.visible && hoverPreview.index !== null && imagePreviews[hoverPreview.index] && (
        createPortal(
          <>
            <div className="fixed z-[1100] pointer-events-none select-none rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-black/80"
              style={{ left: hoverPreview.x, top: hoverPreview.y, width: 320, height: 320, animation: 'fadeIn 120ms ease-out' }}>
              {selectedImages[hoverPreview.index]?.type?.startsWith('video/') ? (
                <video src={imagePreviews[hoverPreview.index]} className="w-full h-full object-cover" muted />
              ) : (

                <img src={imagePreviews[hoverPreview.index]} className="w-full h-full object-cover" alt="hover preview" />
              )}
            </div>
            <style jsx>{`
              @keyframes fadeIn { from { opacity: 0; transform: scale(0.98);} to { opacity: 1; transform: scale(1);} }
            `}</style>
          </>,
          document.body
        )
      )}

      {/* Fullscreen preview modal */}
      {previewIndex !== null && imagePreviews[previewIndex] && typeof document !== 'undefined' && (
        createPortal(
          <div ref={previewContainerRef} className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-sm" onClick={closePreview}>
            <div className="relative w-full h-full" onClick={(e) => e.stopPropagation()}>
              {/* Close button */}
              <button
                aria-label="Close preview"
                className="absolute -top-10 right-0 md:top-0 md:-right-10 bg-white/10 hover:bg-white/20 text-white rounded-full p-2"
                onClick={closePreview}
              >
                <X className="h-5 w-5" />
              </button>

              {/* Media */}
              {selectedImages[previewIndex]?.type?.startsWith('video/') ? (
                <video
                  src={imagePreviews[previewIndex]}
                  controls
                  className="absolute inset-0 w-screen h-screen object-contain"
                  autoPlay
                />
              ) : (
                <ZoomableImage
                  src={imagePreviews[previewIndex]}
                  alt={`Preview ${previewIndex + 1}`}
                  onSwipe={(dir) => {
                    if (dir === 'left') {
                      setPreviewIndex(Math.min(imagePreviews.length - 1, (previewIndex ?? 0) + 1));
                    } else {
                      setPreviewIndex(Math.max(0, (previewIndex ?? 0) - 1));
                    }
                  }}
                />
              )}

              {/* Navigation */}
              {imagePreviews.length > 1 && (
                <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none">
                  <button
                    className="pointer-events-auto ml-2 md:ml-0 bg-white/10 hover:bg-white/20 text-white rounded-full p-2"
                    onClick={() => setPreviewIndex(Math.max(0, (previewIndex ?? 0) - 1))}
                    disabled={(previewIndex ?? 0) === 0}
                  >
                    ‹
                  </button>
                  <button
                    className="pointer-events-auto mr-2 md:mr-0 bg-white/10 hover:bg-white/20 text-white rounded-full p-2"
                    onClick={() => setPreviewIndex(Math.min(imagePreviews.length - 1, (previewIndex ?? 0) + 1))}
                    disabled={(previewIndex ?? 0) >= imagePreviews.length - 1}
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      )}

      {/* Poll section */}
      {postType === 'poll' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Poll Setup</h3>
            <button
              type="button"
              onClick={() => {
                setPostType('text');
                setPollData({ question: '', options: ['', ''], poll_type: 'single_choice' });
              }}
              className="p-1 rounded-full hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Remove poll"
              title="Remove poll"
            >
              <X size={16} />
            </button>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 space-y-5">
            {/* Poll Type Toggle */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2.5 block">Poll Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPollData(prev => ({ ...prev, poll_type: 'single_choice' }))}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${pollData.poll_type === 'single_choice'
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
                    }`}
                >
                  Single Choice
                </button>
                <button
                  type="button"
                  onClick={() => setPollData(prev => ({ ...prev, poll_type: 'multiple_choice' }))}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${pollData.poll_type === 'multiple_choice'
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
                    }`}
                >
                  Multiple Choice
                </button>
              </div>
            </div>
            {/* Poll Question */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2.5 block">Question</label>
              <input
                type="text"
                value={pollData.question}
                onChange={(e) => updatePollQuestion(e.target.value)}
                placeholder="Ask a question..."
                className="w-full rounded-xl bg-muted/30 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 text-card-foreground placeholder:text-muted-foreground/50 px-4 py-3 text-sm"
                maxLength={200}
              />
              <div className="text-[11px] text-muted-foreground/50 mt-1.5 text-right">{pollData.question.length}/200</div>
            </div>

            {/* Poll Options */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2.5 block">Options</label>
              <div className="space-y-2">
                {pollData.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted/50 text-xs text-muted-foreground/60 font-medium flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updatePollOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="w-full rounded-xl bg-muted/30 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 text-card-foreground placeholder:text-muted-foreground/50 px-3 py-2.5 pr-12 text-sm"
                        maxLength={100}
                      />
                      {option.length > 0 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/40">
                          {option.length}/100
                        </div>
                      )}
                    </div>
                    {pollData.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removePollOption(index)}
                        className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
                        aria-label="Remove option"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Option Button */}
              {pollData.options.length < 6 && (
                <button
                  type="button"
                  onClick={addPollOption}
                  className="mt-3 flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                    <Plus className="h-3.5 w-3.5" />
                  </div>
                  Add Option
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer — actions + character count + post button */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/40">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {/* Quick action icons */}
          <button
            type="button"
            onClick={() => { setPostType(postType === 'media' ? 'text' : 'media'); if (postType !== 'media') fileInputRef.current?.click(); }}
            title="Add photo"
            className={`p-2 rounded-lg transition-colors ${
              postType === 'media' ? 'text-emerald-500 bg-emerald-500/10' : 'text-muted-foreground hover:text-emerald-500 hover:bg-muted/60'
            }`}
          >
            <ImageIcon size={20} />
          </button>
          <button
            type="button"
            onClick={() => { setPostType('media'); fileInputRef.current?.click(); }}
            title="Add video"
            className="p-2 rounded-lg text-muted-foreground hover:text-blue-500 hover:bg-muted/60 transition-colors"
          >
            <VideoIcon size={20} />
          </button>
          <button
            type="button"
            onClick={() => setPostType(postType === 'poll' ? 'text' : 'poll')}
            title="Create poll"
            className={`p-2 rounded-lg transition-colors ${
              postType === 'poll' ? 'text-amber-500 bg-amber-500/10' : 'text-muted-foreground hover:text-amber-500 hover:bg-muted/60'
            }`}
          >
            <BarChart2 size={20} />
          </button>
          {/* Separator */}
          <div className="w-px h-5 bg-border/50 mx-1" />
          {/* Circular character progress — appears near limit */}
          {content.length > CHAR_WARN_THRESHOLD && (() => {
            const remaining = MAX_CONTENT - content.length;
            const ratio = Math.min(content.length / MAX_CONTENT, 1);
            const circumference = 2 * Math.PI * 10;
            const strokeDashoffset = circumference * (1 - ratio);
            const color = remaining <= 0 ? 'text-destructive' : remaining <= 30 ? 'text-amber-500' : 'text-primary';
            return (
              <div className="relative flex items-center justify-center shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
                  <circle cx="12" cy="12" r="10" fill="none" strokeWidth="2" className="stroke-muted/40" />
                  <circle cx="12" cy="12" r="10" fill="none" strokeWidth="2" strokeLinecap="round"
                    className={`${color.replace('text-', 'stroke-')} transition-all duration-300`}
                    strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} />
                </svg>
                {remaining <= 30 && (
                  <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums ${color}`}>
                    {remaining}
                  </span>
                )}
              </div>
            );
          })()}
          {/* Separator dot */}
          {content.length > CHAR_WARN_THRESHOLD && (
            <div className="w-px h-4 bg-border/60" />
          )}
          {/* Error inline */}
          {error && (
            <p className="text-xs text-destructive font-medium truncate">{error}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isPostDisabled}
          className={`flex items-center justify-center gap-2 px-7 py-2.5 rounded-full font-semibold text-sm tracking-wide transition-all duration-200 ${
            isPostDisabled
              ? 'bg-primary/30 text-primary-foreground/50 cursor-not-allowed'
              : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-md active:scale-[0.97]'
          }`}
        >
          {isSubmitting && (
            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}
          {isSubmitting ? 'Publishing...' : 'Post'}
        </button>
      </div>
    </form>
    <LoginPromptModal {...loginPrompt.modalProps} />
    </>
  );
}
