"use client";

import { memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PostCard } from './PostCard';
import { useFeedTracking } from '@/hooks/useFeedTracking';
import type { Post } from '@/api/posts';

interface TrackedPostCardProps {
  post: Post;
  positionInFeed: number;
  onReply?: () => void;
  onLike?: () => void;
}

export const TrackedPostCard = memo(({ post, positionInFeed, onReply, onLike }: TrackedPostCardProps) => {
  const router = useRouter();
  const { ref, trackClick, trackLike, trackReply, trackShare, trackBookmark, trackPollVote, trackProfileClick, trackExpandContent } = useFeedTracking({
    postId: post.id,
    authorId: post.author_id,
    positionInFeed,
  });

  const handleReply = useCallback(() => {
    trackReply();
    if (onReply) {
      onReply();
    } else {
      router.push(`/post/${post.id}`);
    }
  }, [trackReply, onReply, router, post.id]);

  const handleLike = useCallback(() => {
    trackLike();
    onLike?.();
  }, [trackLike, onLike]);

  return (
    <div
      ref={ref}
      data-post-id={post.id}
      data-author-id={post.author_id}
      onClick={trackClick}
    >
      <PostCard
        post={post}
        onReply={handleReply}
        onLike={handleLike}
        onShare={trackShare}
        onBookmark={trackBookmark}
        onPollVote={trackPollVote}
        onProfileClick={trackProfileClick}
        onExpandContent={trackExpandContent}
      />
    </div>
  );
});

TrackedPostCard.displayName = 'TrackedPostCard';
