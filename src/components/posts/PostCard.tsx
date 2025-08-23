"use client";
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow, differenceInMinutes, differenceInHours, differenceInDays, differenceInWeeks, differenceInMonths, differenceInYears } from 'date-fns';
import { MoreVertical, MessageCircle, Heart, Share, Bookmark, TrendingUp, Users, Clock, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createPortal } from 'react-dom';
import { Post, likePost, unlikePost, votePollOption, checkUserLikedPost, checkUserPollVotes, deletePost } from '@/api/posts';
import { useAuth } from '@/context/AuthContext';
import { PollVoters } from '@/components/polls/PollVoters';
import Image from 'next/image';
import { MentionText } from './MentionText';
import { EditPostModal } from './EditPostModal';
import { Trash2, Edit } from 'lucide-react';

type PostCardProps = {
  post: Post;
  onReply?: () => void;
  onLike?: () => void;
};

// Constants
const IMAGE_ASPECT = '4 / 5';
const VIDEO_ASPECT = '16 / 9';
const SWIPE_THRESHOLD = 40;
const SWIPE_TIME_THRESHOLD = 400;
const CONTENT_TRUNCATE_LENGTH = 280;

// Memoized tag styling function with proper dependencies
const getTagStyling = (tag: string) => {
  const normalizedTag = tag.toLowerCase();
  
  if (normalizedTag.includes('app') || normalizedTag.includes('dev')) {
    return 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 hover:border-blue-500/50 shadow-sm';
  } else if (normalizedTag.includes('collaborat') || normalizedTag.includes('team')) {
    return 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-700 dark:text-green-300 border border-green-500/30 hover:border-green-500/50 shadow-sm';
  } else if (normalizedTag.includes('ai') || normalizedTag.includes('artificial')) {
    return 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 hover:border-purple-500/50 shadow-sm';
  }
  return 'bg-gradient-to-r from-slate-500/10 to-slate-600/10 text-slate-700 dark:text-slate-300 border border-slate-500/20 hover:border-slate-500/30 shadow-sm';
};

// Memoized time formatter with proper dependencies
const formatTimeAgoShort = (date: Date): string => {
  const now = new Date();
  const years = differenceInYears(now, date);
  if (years > 0) return `${years}y`;
  const months = differenceInMonths(now, date);
  if (months > 0) return `${months}mo`;
  const weeks = differenceInWeeks(now, date);
  if (weeks > 0) return `${weeks}w`;
  const days = differenceInDays(now, date);
  if (days > 0) return `${days}d`;
  const hours = differenceInHours(now, date);
  if (hours > 0) return `${hours}h`;
  const minutes = differenceInMinutes(now, date);
  if (minutes > 0) return `${minutes}m`;
  return 'now';
};

// Memoized proxy URL function with proper dependencies
const toProxyUrl = (rawUrl: string) => 
  `https://lrgwsbslfqiwoazmitre.supabase.co/functions/v1/get-image?url=${encodeURIComponent(rawUrl)}`;

// Memoized Google avatar check with proper dependencies
const isGoogleAvatar = (url?: string | null): boolean => {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname === 'lh3.googleusercontent.com';
  } catch {
    return false;
  }
};

// Optimized Video Thumbnail component with enhanced performance
const VideoThumbnail = memo(({ 
  src, 
  thumbnail, 
  onPlay, 
  width, 
  height,
  className = "" 
}: { 
  src: string; 
  thumbnail?: string | null; 
  onPlay?: () => void;
  width?: number | null;
  height?: number | null;
  className?: string;
}) => {
  const [thumbnailError, setThumbnailError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleThumbnailError = useCallback(() => setThumbnailError(true), []);
  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay?.();
  }, [onPlay]);

  const aspect = useMemo(() => {
    if (width && height) return `${width} / ${height}`;
    return VIDEO_ASPECT;
  }, [width, height]);

  // Use thumbnail if available, otherwise show a video placeholder
  const displayThumbnail = thumbnail && !thumbnailError;

  return (
    <div 
      className={`relative mx-auto rounded-2xl overflow-hidden bg-black shadow-xl group max-h-[520px] md:max-h-[600px] cursor-pointer ${className}`}
      style={{ aspectRatio: aspect, width: '100%', maxWidth: '100%' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Thumbnail or placeholder */}
      {displayThumbnail ? (
        <Image
          src={toProxyUrl(thumbnail)}
          alt="Video thumbnail"
          fill
          className="object-cover w-full h-full rounded-2xl transition-all duration-300"
          sizes="(max-width: 768px) 100vw, 700px"
          draggable={false}
          loading="lazy"
          priority={false}
          onError={handleThumbnailError}
          unoptimized={true}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-white/10 rounded-full flex items-center justify-center">
              <Play className="h-8 w-8 text-white/80 ml-1" />
            </div>
            <p className="text-white/70 text-sm font-medium">Video</p>
          </div>
        </div>
      )}
      
      {/* Play button overlay */}
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
        isHovered ? 'opacity-100' : 'opacity-80'
      }`}>
        <div className={`w-16 h-16 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all duration-200 ${
          isHovered ? 'scale-110 bg-black/80' : 'scale-100'
        }`}>
          <Play className="h-8 w-8 text-white ml-1" />
        </div>
      </div>
      
      {/* Gradient overlay for better button visibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent rounded-2xl pointer-events-none" />
      
      {/* Border */}
      <div className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none" />
    </div>
  );
});

VideoThumbnail.displayName = 'VideoThumbnail';

// Optimized ResponsiveVideo component with lazy loading
const ResponsiveVideo = memo(({ src, poster, width, height }: { 
  src: string; 
  poster?: string; 
  width?: number | null;
  height?: number | null;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const handleLoadedMetadata = useCallback(() => setIsLoaded(true), []);
  const handleError = useCallback(() => { setHasError(true); setIsLoaded(true); }, []);
  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleMouseEnter = useCallback(() => setShowControls(true), []);
  const handleMouseLeave = useCallback(() => setShowControls(false), []);

  const handlePlayPause = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (video) {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    }
  }, []);

  const aspect = useMemo(() => {
    if (width && height) return `${width} / ${height}`;
    return VIDEO_ASPECT;
  }, [width, height]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [handleLoadedMetadata, handleError, handlePlay, handlePause]);

  if (hasError) {
    return (
      <div className="relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/20 border border-red-200 dark:border-red-800">
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <div className="text-red-500 mb-2 text-2xl">⚠️</div>
            <span className="text-red-600 dark:text-red-400 text-sm font-medium">Failed to load video</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative mx-auto rounded-2xl overflow-hidden bg-black shadow-xl group max-h-[520px] md:max-h-[600px]"
      style={{ aspectRatio: aspect, width: '100%', maxWidth: '100%' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        controls={showControls}
        preload="metadata"
        poster={poster}
        className="absolute inset-0 w-full h-full object-contain rounded-2xl transition-all duration-300"
        playsInline
      >
        <source src={src} type="video/mp4" />
        <source src={src} type="video/webm" />
        <source src={src} type="video/ogg" />
        Your browser does not support the video tag.
      </video>
      
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900/90 to-slate-800/90 rounded-2xl backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-3 border-white/20 border-t-white/80"></div>
            <span className="text-sm text-white/90 font-medium">Loading video...</span>
          </div>
        </div>
      )}
      
      {isLoaded && (
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
          <Button
            variant="ghost"
            size="icon"
            className="w-16 h-16 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <Pause className="h-8 w-8 text-white" />
            ) : (
              <Play className="h-8 w-8 text-white ml-1" />
            )}
          </Button>
        </div>
      )}
      
      <div className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none"></div>
    </div>
  );
});

ResponsiveVideo.displayName = 'ResponsiveVideo';

// Optimized MediaGallery with enhanced video thumbnail support
const MediaGallery = memo(({ items, onOpen }: { 
  items: Array<{ 
    id?: string; 
    media_type: 'photo' | 'video'; 
    media_url: string; 
    media_thumbnail?: string | null; 
    width?: number | null; 
    height?: number | null 
  }>; 
  onOpen?: (index: number) => void 
}) => {
  const total = items?.length || 0;
  const [current, setCurrent] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<number | null>(null);
  
  const touchStartX = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  const lastTouchXRef = useRef<number | null>(null);

  const handleImageError = useCallback(() => setImageError(true), []);
  
  const goPrev = useCallback((e?: React.MouseEvent) => { 
    if (e) e.stopPropagation(); 
    setCurrent(c => (c - 1 + total) % total);
    setPlayingVideo(null); // Stop any playing video when navigating
  }, [total]);
  
  const goNext = useCallback((e?: React.MouseEvent) => { 
    if (e) e.stopPropagation(); 
    setCurrent(c => (c + 1) % total);
    setPlayingVideo(null); // Stop any playing video when navigating
  }, [total]);

  const onTouchStart = useCallback((e: React.TouchEvent) => { 
    touchStartX.current = e.touches[0].clientX; 
    touchStartTime.current = Date.now(); 
  }, []);
  
  const onTouchMove = useCallback((e: React.TouchEvent) => { 
    lastTouchXRef.current = e.touches[0].clientX; 
  }, []);
  
  const onTouchEnd = useCallback(() => {
    if (touchStartX.current == null || touchStartTime.current == null) return;
    const dx = (lastTouchXRef.current ?? touchStartX.current) - touchStartX.current;
    const dt = Date.now() - touchStartTime.current;
    if (dt < SWIPE_TIME_THRESHOLD && Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx > 0) goNext(); else goPrev();
    }
    touchStartX.current = null; 
    touchStartTime.current = null; 
    lastTouchXRef.current = null;
  }, [goNext, goPrev]);

  // Memoized click handlers
  const handleImageClick = useMemo(() => 
    (index: number) => (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpen?.(index);
    }, [onOpen]
  );

  const handleVideoPlay = useMemo(() =>
    (index: number) => () => {
      setPlayingVideo(index);
    }, []
  );

  const handleDotClick = useMemo(() => 
    (index: number) => (e: React.MouseEvent) => {
      e.stopPropagation();
      setCurrent(index);
      setPlayingVideo(null);
    }, []
  );

  if (!items || total === 0) return null;

  // Single item optimization
  if (total === 1) {
    const m = items[0];
    const aspect = m.width && m.height 
      ? `${m.width} / ${m.height}` 
      : (m.media_type === 'photo' ? IMAGE_ASPECT : VIDEO_ASPECT);
    
    if (m.media_type === 'photo') {
      return (
        <div 
          className="relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden max-h-[520px] md:max-h-[600px] cursor-zoom-in" 
          style={{ aspectRatio: aspect }} 
          onClick={handleImageClick(0)} 
          data-no-nav="true"
        >
          {!imageError ? (
            <Image
              src={toProxyUrl(m.media_url)}
              alt="Post media"
              fill
              className="object-contain w-full h-full rounded-2xl transition-transform duration-300 group-hover:scale-[1.02] bg-black"
              sizes="(max-width: 768px) 100vw, 700px"
              draggable={false}
              loading="lazy"
              priority={false}
              onError={handleImageError}
              unoptimized={true}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-muted/30 to-muted/50 rounded-2xl flex items-center justify-center">
              <span className="text-muted-foreground">Failed to load image</span>
            </div>
          )}
        </div>
      );
    }
    
    // Single video - show thumbnail first, then video on play
    return (
      <div className="relative w-full max-w-2xl mx-auto" data-no-nav="true">
        {playingVideo === 0 ? (
          <ResponsiveVideo 
            src={toProxyUrl(m.media_url)} 
            poster={m.media_thumbnail || undefined}
            width={m.width}
            height={m.height}
          />
        ) : (
          <VideoThumbnail
            src={toProxyUrl(m.media_url)}
            thumbnail={m.media_thumbnail}
            onPlay={handleVideoPlay(0)}
            width={m.width}
            height={m.height}
          />
        )}
      </div>
    );
  }

  const currentMedia = items[current];
  const currentAspect = currentMedia.width && currentMedia.height 
    ? `${currentMedia.width} / ${currentMedia.height}` 
    : (currentMedia.media_type === 'photo' ? IMAGE_ASPECT : VIDEO_ASPECT);

  return (
    <div className="relative w-full max-w-2xl mx-auto" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="rounded-2xl overflow-hidden bg-black max-h-[520px] md:max-h-[600px]">
        {currentMedia.media_type === 'photo' ? (
          <div 
            className="relative w-full max-h-[520px] md:max-h-[600px] cursor-zoom-in" 
            style={{ aspectRatio: currentAspect }} 
            onClick={handleImageClick(current)} 
            data-no-nav="true"
          >
            <Image
              key={`${current}-${currentMedia.media_url}`}
              src={toProxyUrl(currentMedia.media_url)}
              alt={`Media ${current + 1}`}
              fill
              className="object-contain w-full h-full bg-black"
              sizes="(max-width: 768px) 100vw, 700px"
              draggable={false}
              loading="lazy"
              onError={handleImageError}
              unoptimized={true}
            />
          </div>
        ) : (
          <div
            data-no-nav="true"
            className="relative w-full max-h-[520px] md:max-h-[600px]"
          >
            {playingVideo === current ? (
              <ResponsiveVideo 
                key={`video-${current}-${currentMedia.media_url}`}
                src={toProxyUrl(currentMedia.media_url)} 
                poster={currentMedia.media_thumbnail || undefined}
                width={currentMedia.width}
                height={currentMedia.height}
              />
            ) : (
              <VideoThumbnail
                key={`thumbnail-${current}-${currentMedia.media_url}`}
                src={toProxyUrl(currentMedia.media_url)}
                thumbnail={currentMedia.media_thumbnail}
                onPlay={handleVideoPlay(current)}
                width={currentMedia.width}
                height={currentMedia.height}
                className="cursor-pointer"
              />
            )}
          </div>
        )}
      </div>

      {total > 1 && (
        <>
          <button
            data-no-nav="true"
            className="absolute top-1/2 -translate-y-1/2 left-2 bg-black/50 hover:bg-black/70 text-white rounded-full w-9 h-9 flex items-center justify-center z-10"
            onClick={goPrev}
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            data-no-nav="true"
            className="absolute top-1/2 -translate-y-1/2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full w-9 h-9 flex items-center justify-center z-10"
            onClick={goNext}
            aria-label="Next"
          >
            ›
          </button>

          <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1 z-10">
            {items.map((item, i) => (
              <button
                data-no-nav="true"
                key={i}
                onClick={handleDotClick(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  i === current 
                    ? 'bg-white scale-125' 
                    : 'bg-white/40 hover:bg-white/60'
                }`}
                aria-label={`Go to ${item.media_type} ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
});

MediaGallery.displayName = 'MediaGallery';

// Enhanced Lightbox with video thumbnail support
const Lightbox = memo(({ items, index, onClose, onPrev, onNext }: { 
  items: Array<{ media_type: 'photo' | 'video'; media_url: string; media_thumbnail?: string | null }>; 
  index: number; 
  onClose: () => void; 
  onPrev: () => void; 
  onNext: () => void; 
}) => {
  const current = items[index];
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => { setMounted(true); }, []);
  
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (!mounted || !current) return null;

  const overlay = (
    <div 
      className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center" 
      role="dialog" 
      aria-modal="true" 
      data-no-nav="true" 
      onClick={handleOverlayClick}
    >
      <div className="relative w-full h-full max-w-6xl max-h-[90vh] m-4" onClick={handleContentClick}>
        <div className="relative w-full h-full">
          {current.media_type === 'photo' ? (
            <Image
              src={toProxyUrl(current.media_url)}
              alt="Preview"
              fill
              className="object-contain select-none"
              sizes="100vw"
              draggable={false}
              priority={true}
              unoptimized={true}
            />
          ) : (
            <video
              className="absolute inset-0 w-full h-full object-contain"
              controls
              autoPlay
              poster={current.media_thumbnail || undefined}
            >
              <source src={toProxyUrl(current.media_url)} type="video/mp4" />
              <source src={toProxyUrl(current.media_url)} type="video/webm" />
              <source src={toProxyUrl(current.media_url)} type="video/ogg" />
              Your browser does not support the video tag.
            </video>
          )}
        </div>
        <button 
          className="absolute top-4 right-4 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center" 
          onClick={onClose} 
          aria-label="Close" 
          data-no-nav="true"
        >
          ✕
        </button>
        {items.length > 1 && (
          <>
            <button 
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10" 
              onClick={onPrev} 
              aria-label="Previous" 
              data-no-nav="true"
            >
              ‹
            </button>
            <button 
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10" 
              onClick={onNext} 
              aria-label="Next" 
              data-no-nav="true"
            >
              ›
            </button>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
});

Lightbox.displayName = 'Lightbox';

// Main PostCard component with optimizations (keeping the rest of your existing code)
export const PostCard = memo(({ post, onReply, onLike }: PostCardProps) => {
  const router = useRouter();
  const { user } = useAuth();
  
  // State management
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [likes, setLikes] = useState(post.likes || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [replies] = useState(post.replies || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);
  const [envImageError, setEnvImageError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Poll state
  const [pollVotes, setPollVotes] = useState<{[key: string]: number}>({});
  const [userVotedOptions, setUserVotedOptions] = useState<string[]>([]);
  const [hasUserVoted, setHasUserVoted] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);

  // Refs
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Memoized values - optimized to prevent unnecessary re-renders
  const content = useMemo(() => post.content ?? '', [post.content]);
  const isLongContent = useMemo(() => content.length > CONTENT_TRUNCATE_LENGTH, [content.length]);
  const displayContent = useMemo(() => 
    isLongContent && !showFullContent 
      ? content.substring(0, CONTENT_TRUNCATE_LENGTH) + '...' 
      : content,
    [content, isLongContent, showFullContent]
  );
  
  const isVerified = useMemo(() => Boolean(post.author?.is_verified), [post.author?.is_verified]);
  const isAuthor = useMemo(() => user?.id === post.author_id, [user?.id, post.author_id]);
  const totalPollVotes = useMemo(() => 
    Object.values(pollVotes).reduce((sum, votes) => sum + votes, 0), 
    [pollVotes]
  );
  const createdAtDate = useMemo(() => new Date(post.created_at), [post.created_at]);
  const timeAgo = useMemo(() => formatTimeAgoShort(createdAtDate), [createdAtDate]);
  const timeAgoFull = useMemo(() => formatDistanceToNow(createdAtDate, { addSuffix: true }), [createdAtDate]);

  // Event handlers (keeping your existing handlers with the same optimization)
  const handleImageError = useCallback(() => setImageError(true), []);
  const handleEnvImageError = useCallback(() => setEnvImageError(true), []);

  const handleLike = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id || isLiking) return;

    setIsLiking(true);
    
    try {
      if (isLiked) {
        const { error } = await unlikePost(post.id, user.id);
        if (!error) {
          setLikes(prev => prev - 1);
          setIsLiked(false);
        }
      } else {
        const { error } = await likePost(post.id, user.id);
        if (!error) {
          setLikes(prev => prev + 1);
          setIsLiked(true);
        }
      }
    } catch (error) {
      console.error('Error liking/unliking post:', error);
    } finally {
      setIsLiking(false);
    }
    
    onLike?.();
  }, [user?.id, isLiking, isLiked, post.id, onLike]);

  const handleReply = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onReply) {
      onReply();
    } else {
      router.push(`/post/${post.id}`);
    }
  }, [onReply, router, post.id]);

  const handleProfileClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const username = post.author?.username || post.author?.handle;
    if (username) {
      router.push(`/profile/${username}`);
    }
  }, [post.author?.username, post.author?.handle, router]);

  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(prev => !prev);
  }, []);

  const handleCardClick = useCallback(() => {
    router.push(`/post/${post.id}`);
  }, [router, post.id]);

  const onCardClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    const interactiveTags = new Set(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'LABEL']);
    if (interactiveTags.has(tag)) return;
    if (target.closest('[data-no-nav="true"]')) return;
    if (target.closest('video')) return;
    handleCardClick();
  }, [handleCardClick]);

  const handleBookmark = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBookmarked(prev => !prev);
  }, []);

  const handleShare = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      navigator.share({
        title: `Post by ${post.author?.username || 'Anonymous'}`,
        text: content,
        url
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url)
        .then(() => console.log('Link copied to clipboard'))
        .catch(console.error);
    }
  }, [post.id, post.author?.username, content]);

  const handlePollVote = useCallback(async (optionId: string) => {
    if (!user?.id || isVoting) return;

    const previousVotes = { ...pollVotes };
    const previousUserVotes = [...userVotedOptions];
    const previousHasVoted = hasUserVoted;

    const newVotes = { ...pollVotes };
    let newUserVotes = [...userVotedOptions];
    let action: 'added' | 'removed' = 'added';
    let previousOptionId: string | null = null;

    const isRemovingVote = userVotedOptions.includes(optionId);
    
    if (isRemovingVote) {
      action = 'removed';
      newUserVotes = newUserVotes.filter(id => id !== optionId);
      newVotes[optionId] = Math.max(0, (newVotes[optionId] || 1) - 1);
    } else {
      previousOptionId = userVotedOptions[0] || null;
      
      if (previousOptionId) {
        newUserVotes = newUserVotes.filter(id => id !== previousOptionId);
        newVotes[previousOptionId] = Math.max(0, (newVotes[previousOptionId] || 1) - 1);
      }
      
      newUserVotes = [optionId];
      newVotes[optionId] = (newVotes[optionId] || 0) + 1;
    }

    setPollVotes(newVotes);
    setUserVotedOptions(newUserVotes);
    setHasUserVoted(newUserVotes.length > 0);
    setIsVoting(true);
    setVotingOptionId(optionId);

    try {
      const { data, error } = await votePollOption(optionId, user.id);
      
      if (error || !data || !data.success) {
        console.error('Vote failed, rolling back:', error);
        setPollVotes(previousVotes);
        setUserVotedOptions(previousUserVotes);
        setHasUserVoted(previousHasVoted);
        return;
      }

      if (data.action !== action) {
        const serverVotes = { ...pollVotes };
        let serverUserVotes = [...userVotedOptions];
        
        if (data.action === 'removed') {
          serverUserVotes = serverUserVotes.filter(id => id !== optionId);
          serverVotes[optionId] = Math.max(0, (serverVotes[optionId] || 1) - 1);
        } else if (data.action === 'added') {
          if (data.previous_option_id) {
            serverUserVotes = serverUserVotes.filter(id => id !== data.previous_option_id);
            serverVotes[data.previous_option_id] = Math.max(0, (serverVotes[data.previous_option_id] || 1) - 1);
          }
          if (!serverUserVotes.includes(optionId)) {
            serverUserVotes.push(optionId);
          }
          serverVotes[optionId] = (serverVotes[optionId] || 0) + 1;
        }
        
        setPollVotes(serverVotes);
        setUserVotedOptions(serverUserVotes);
        setHasUserVoted(serverUserVotes.length > 0);
      }
    } catch (error) {
      console.error('Error voting on poll:', error);
      setPollVotes(previousVotes);
      setUserVotedOptions(previousUserVotes);
      setHasUserVoted(previousHasVoted);
    } finally {
      setIsVoting(false);
      setVotingOptionId(null);
    }
  }, [user?.id, isVoting, pollVotes, userVotedOptions, hasUserVoted]);

  // Lightbox handlers
  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const lightboxPrev = useCallback(() => {
    if (!post.media) return;
    const total = post.media.length;
    setLightboxIndex(prev => (prev - 1 + total) % total);
  }, [post.media]);

  const lightboxNext = useCallback(() => {
    if (!post.media) return;
    const total = post.media.length;
    setLightboxIndex(prev => (prev + 1) % total);
  }, [post.media]);

  // Effects - optimized with proper dependencies
  useEffect(() => {
    if (!user?.id) return;

    const checkUserInteractions = async () => {
      try {
        const [likeResult, pollResult] = await Promise.all([
          checkUserLikedPost(post.id, user.id),
          post.poll ? checkUserPollVotes(post.poll.id, user.id) : Promise.resolve({ votes: [], error: null })
        ]);

        const { liked, error: likeError } = likeResult;
        if (!likeError) {
          setIsLiked(liked);
        }

        if (post.poll && !pollResult.error) {
          const votedOptionIds = pollResult.votes.map(v => v.option_id);
          setUserVotedOptions(votedOptionIds);
          setHasUserVoted(votedOptionIds.length > 0);
          
          if (post.poll.options) {
            const initialVotes: {[key: string]: number} = {};
            post.poll.options.forEach(option => {
              initialVotes[option.id] = option.votes;
            });
            setPollVotes(initialVotes);
          }
        }
      } catch (error) {
        console.error('Error in checkUserInteractions:', error);
      }
    };

    checkUserInteractions();
  }, [user?.id, post.id, post.poll?.id]);

  useEffect(() => {
    if (!isMenuOpen) return;
    
    const onDocMouseDown = (e: MouseEvent) => {
      const n = menuRef.current;
      if (n && !n.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isMenuOpen]);

  // Delete post handler
  const handleDeletePost = useCallback(async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const { error } = await deletePost(post.id, user.id);
      if (!error) {
        window.location.reload();
      } else {
        console.error('Error deleting post:', error);
      }
    } catch (error) {
      console.error('Error deleting post:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [user, post.id]);

  // Memoized JSX elements to prevent unnecessary re-renders (keeping your existing profileSection and tagsSection)
  const profileSection = useMemo(() => (
    <div className="flex items-center gap-4 flex-1 min-w-0">
      {/* Profile Picture */}
      <div className="relative" onClick={handleProfileClick} data-no-nav="true" role="link" tabIndex={0}>
        <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 ring-2 ring-border/20 group-hover:ring-primary/30 transition-all duration-300">
          {post.author?.avatar_url && !isGoogleAvatar(post.author.avatar_url) && !imageError ? (
            <div className="relative w-full h-full">
              <Image
                src={toProxyUrl(post.author.avatar_url)}
                alt={post.author.username || 'User'}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-110"
                onError={handleImageError}
                unoptimized={true}
              />
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/20 to-primary/10 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">
                {post.author?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
          )}
        </div>
        {isVerified && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6" aria-label="Verified">
            <svg viewBox="0 0 40 40" width="24" height="24" className="block" aria-hidden="true">
              <path
                d="M19.998 3.094 14.638 0l-2.972 5.15H5.432v6.354L0 14.64 3.094 20 0 25.359l5.432 3.137v5.905h5.975L14.638 40l5.36-3.094L25.358 40l3.232-5.6h6.162v-6.01L40 25.359 36.905 20 40 14.641l-5.248-3.03v-6.46h-6.419L25.358 0l-5.36 3.094Zm7.415 11.225 2.254 2.287-11.43 11.5-6.835-6.93 2.244-2.258 4.587 4.581 9.18-9.18Z"
                fill="#0095F6"
                fillRule="evenodd"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>
      
      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="font-bold text-lg text-foreground truncate group-hover:text-primary transition-colors duration-200 cursor-pointer" onClick={handleProfileClick} data-no-nav="true" role="link">
            {post.author?.full_name || post.author?.username || 'Anonymous'}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
          <span className="font-medium cursor-pointer" onClick={handleProfileClick} data-no-nav="true" role="link">
            @{post.author?.handle || post.author?.username?.toLowerCase() || 'anonymous'}
          </span>
          <span className="opacity-60">•</span>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span title={timeAgoFull}>{timeAgo}</span>
          </div>
        </div>
        
        {/* Environment info */}
        {post.environment && (
          <div className="flex items-center gap-3 text-sm bg-[#1C1F26] px-4 py-2 rounded-xl border border-[#2A2E38] w-fit">
            {post.environment.picture && !envImageError ? (
              <div className="w-6 h-6 rounded-md overflow-hidden ring-1 ring-[#3C4049]">
                <Image
                  src={toProxyUrl(post.environment.picture)}
                  alt={post.environment.name}
                  width={24}
                  height={24}
                  className="object-cover w-full h-full"
                  onError={handleEnvImageError}
                  unoptimized={true}
                />
              </div>
            ) : (
              <Users className="h-5 w-5 text-gray-400" />
            )}
            <span className="text-white font-semibold">{post.environment.name}</span>
          </div>
        )}
      </div>
    </div>
  ), [post.author, isVerified, imageError, handleProfileClick, handleImageError, timeAgo, timeAgoFull, post.environment, envImageError, handleEnvImageError]);

  const tagsSection = useMemo(() => {
    if (!post.tags || post.tags.length === 0) return null;
    
    return (
      <div className="flex gap-2 mb-5 flex-wrap">
        {post.tags.map((tag, index) => (
          <div 
            key={index} 
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-105 cursor-pointer ${getTagStyling(tag)}`}
          >
            <span>{tag}</span>
            {tag.toLowerCase() === 'ai' && <span className="ml-1.5 text-xs">✨</span>}
          </div>
        ))}
      </div>
    );
  }, [post.tags]);

  return (
    <article
      className="group relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-3xl p-6 cursor-pointer transition-all duration-300 hover:bg-card/80 hover:border-border/80 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 hover:-translate-y-1"
      onClick={onCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(); }}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      <div className="relative z-10">
        {/* Header */}
        <header className="flex items-start justify-between mb-5">
          {profileSection}
          
          {/* Menu */}
          <div className="relative" ref={menuRef}>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-10 w-10 rounded-2xl transition-colors hover:bg-accent/40 text-foreground/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              onClick={toggleMenu}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-label="More options"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
            {isMenuOpen && (
              <div 
                className="absolute right-0 mt-2 w-56 rounded-xl bg-popover text-popover-foreground border border-border/60 shadow-xl z-20 overflow-hidden animate-in fade-in-0 zoom-in-95"
                role="menu"
              >
                <div className="py-1">
                  {isAuthor && (
                    <>
                      <button 
                        className="w-full px-3 py-2 text-sm flex items-center gap-3 hover:bg-accent/50 transition-colors"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMenuOpen(false);
                          setIsEditModalOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4 opacity-80" />
                        <span>Edit post</span>
                      </button>
                      <button 
                        className="w-full px-3 py-2 text-sm flex items-center gap-3 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMenuOpen(false);
                          setShowDeleteConfirm(true);
                        }}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4 opacity-80" />
                        <span>{isDeleting ? 'Deleting...' : 'Delete post'}</span>
                      </button>
                      <div className="h-px bg-border/60 my-1" />
                    </>
                  )}
                  <button 
                    className="w-full px-3 py-2 text-sm flex items-center gap-3 hover:bg-accent/50 transition-colors"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare(e);
                      setIsMenuOpen(false);
                    }}
                  >
                    <Share className="h-4 w-4 opacity-80" />
                    <span>Copy link</span>
                  </button>
                  {!isAuthor && (
                    <>
                      <div className="h-px bg-border/60 my-1" />
                      <button 
                        className="w-full px-3 py-2 text-sm flex items-center gap-3 hover:bg-accent/50 transition-colors"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMenuOpen(false);
                        }}
                      >
                        <TrendingUp className="h-4 w-4 opacity-80" />
                        <span>Report post</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>
        
        {/* Tags */}
        {tagsSection}
        
        {/* Content */}
        <div className="mb-5">
          <MentionText 
            content={displayContent}
            className="text-foreground leading-relaxed text-base block"
          />
          {isLongContent && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFullContent(!showFullContent);
              }}
              className="mt-2 text-primary hover:text-primary/80 text-sm font-medium transition-colors"
            >
              {showFullContent ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
        
        {/* Media */}
        {post.media && post.media.length > 0 && (
          <div className="mb-5 rounded-2xl overflow-hidden bg-muted/5 ring-1 ring-border/20 p-2">
            <MediaGallery
              items={post.media}
              onOpen={openLightbox}
            />
          </div>
        )}

        {/* Poll */}
        {post.poll && (
          <div className="mb-5 rounded-2xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-5 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
            <div className="font-bold mb-4 text-foreground text-lg">{post.poll.question}</div>
            <div className="space-y-3">
              {post.poll.options?.map(option => {
                const voteCount = pollVotes[option.id] || 0;
                const percentage = totalPollVotes > 0 ? (voteCount / totalPollVotes) * 100 : 0;
                const isSelected = userVotedOptions.includes(option.id);
                const isCurrentlyVoting = votingOptionId === option.id;
                const isDisabled = isVoting && !isCurrentlyVoting;
                
                return (
                  <div key={option.id} className="relative">
                    <button 
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                        isSelected
                          ? 'bg-gradient-to-r from-primary/20 to-primary/10 border-primary/40 text-primary shadow-lg shadow-primary/10 transform scale-[1.02]' 
                          : 'bg-muted/30 border-border/30 hover:bg-muted/50 hover:border-border/50 hover:scale-[1.01]'
                      } ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                      ${isCurrentlyVoting ? 'ring-2 ring-primary/30 animate-pulse' : ''}`}
                      onClick={() => handlePollVote(option.id)}
                      disabled={isDisabled}
                    >
                      {hasUserVoted && (
                        <div 
                          className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent rounded-xl transition-all duration-700 ease-out"
                          style={{ width: `${percentage}%` }}
                        />
                      )}
                      
                      {isCurrentlyVoting && (
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent rounded-xl">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-slide-right" />
                        </div>
                      )}
                      
                      <span className="text-foreground font-medium relative z-10 flex items-center gap-2">
                        {option.option_text}
                        {isCurrentlyVoting && (
                          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        )}
                      </span>
                      
                      {hasUserVoted && (
                        <div className="flex items-center gap-2 relative z-10">
                          <span className="text-muted-foreground text-sm font-medium transition-all duration-300">
                            {voteCount} vote{voteCount !== 1 ? 's' : ''}
                          </span>
                          <span className="text-primary text-sm font-bold transition-all duration-300">
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
            {hasUserVoted && (
              <div className="mt-4 pt-3 border-t border-border/30">
                <p className="text-muted-foreground text-sm text-center">
                  {totalPollVotes} total vote{totalPollVotes !== 1 ? 's' : ''}
                </p>
                
                <PollVoters
                  pollId={post.poll.id}
                  isCreator={user?.id === post.author_id}
                  totalVotes={totalPollVotes}
                />
              </div>
            )}
          </div>
        )}
        
        {/* Interaction buttons */}
        <footer className="flex items-center justify-between pt-4 border-t border-border/30">
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex items-center gap-2 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded-2xl px-4 py-2 transition-all duration-200 group/reply"
            onClick={handleReply}
          >
            <MessageCircle className="h-5 w-5 group-hover/reply:scale-110 transition-transform duration-200" />
            <span className="text-sm font-semibold">
              {replies > 0 ? replies : 'Reply'}
            </span>
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className={`flex items-center gap-2 rounded-2xl px-4 py-2 transition-all duration-200 group/like ${
              isLiked 
                ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20' 
                : 'text-muted-foreground hover:text-red-500 hover:bg-red-500/10'
            } ${isLiking ? 'opacity-50 scale-95' : ''}`}
            onClick={handleLike}
            disabled={isLiking}
          >
            <Heart className={`h-5 w-5 group-hover/like:scale-110 transition-all duration-200 ${isLiked ? 'fill-current animate-pulse' : ''}`} />
            <span className="text-sm font-semibold">
              {likes > 0 ? likes : 'Like'}
            </span>
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            className={`flex items-center gap-2 rounded-2xl px-4 py-2 transition-all duration-200 group/bookmark ${
              isBookmarked 
                ? 'text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20' 
                : 'text-muted-foreground hover:text-yellow-500 hover:bg-yellow-500/10'
            }`}
            onClick={handleBookmark}
          >
            <Bookmark className={`h-5 w-5 group-hover/bookmark:scale-110 transition-all duration-200 ${isBookmarked ? 'fill-current' : ''}`} />
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex items-center gap-2 text-muted-foreground hover:text-green-500 hover:bg-green-500/10 rounded-2xl px-4 py-2 transition-all duration-200 group/share"
            onClick={handleShare}
          >
            <Share className="h-5 w-5 group-hover/share:scale-110 transition-transform duration-200" />
          </Button>
        </footer>
      </div>
      
      {/* Hover effects */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      {/* Animation dots */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-30 transition-opacity duration-300">
        <div className="flex gap-1">
          <div className="w-1 h-1 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="w-1 h-1 bg-primary rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
          <div className="w-1 h-1 bg-primary rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
        </div>
      </div>
      
      {/* Lightbox */}
      {lightboxOpen && post.media && (
        <Lightbox
          items={post.media}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={lightboxPrev}
          onNext={lightboxNext}
        />
      )}
      
      {/* Edit Modal */}
      {isEditModalOpen && user && (
        <EditPostModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          postId={post.id}
          initialContent={post.content || ''}
          userId={user.id}
          onPostUpdated={() => {
            window.location.reload();
          }}
        />
      )}
      
      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Delete Post?</h3>
            <p className="text-muted-foreground text-sm mb-4">
              This action cannot be undone. This post will be permanently deleted.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeletePost}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
});

PostCard.displayName = 'PostCard';