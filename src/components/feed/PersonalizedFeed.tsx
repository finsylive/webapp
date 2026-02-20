"use client";

import { useEffect, useRef, useCallback } from 'react';
import { usePersonalizedFeed } from '@/hooks/usePersonalizedFeed';
import { useRealtimeFeedUpdates } from '@/hooks/useRealtimeFeedUpdates';
import { useFeedRecommendations } from '@/hooks/useFeedRecommendations';
import { TrackedPostCard } from '@/components/posts/TrackedPostCard';
import { FeedSuggestions } from '@/components/feed/FeedSuggestions';
import { TrendingPosts } from '@/components/feed/TrendingPosts';
import { NewPostsNotifier } from '@/components/feed/NewPostsNotifier';
import { FeedTrackingProvider } from '@/context/FeedTrackingContext';
import { Loader2 } from 'lucide-react';

export function PersonalizedFeed() {
  const {
    posts,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  } = usePersonalizedFeed();

  const { newPostCount, dismiss } = useRealtimeFeedUpdates();
  const { suggestedUsers, trendingPosts, isLoading: recsLoading, followUser } = useFeedRecommendations();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleRefresh = useCallback(() => {
    dismiss();
    refresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [dismiss, refresh]);

  // Infinite scroll — observe the sentinel element
  useEffect(() => {
    // Disconnect any previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '600px' }
    );

    observerRef.current = observer;

    const el = sentinelRef.current;
    if (el) {
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMore]);

  // Re-observe when sentinel ref changes (after posts render)
  useEffect(() => {
    const el = sentinelRef.current;
    if (el && observerRef.current) {
      observerRef.current.observe(el);
    }
  }, [posts.length]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="post-card animate-pulse">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-muted/30"></div>
              <div className="flex-1">
                <div className="h-4 bg-muted/30 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-muted/30 rounded w-1/4"></div>
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <div className="h-4 bg-muted/30 rounded w-full"></div>
              <div className="h-4 bg-muted/30 rounded w-5/6"></div>
              <div className="h-4 bg-muted/30 rounded w-4/6"></div>
            </div>
            <div className="flex justify-between pt-3">
              <div className="h-6 bg-muted/30 rounded w-16"></div>
              <div className="h-6 bg-muted/30 rounded w-16"></div>
              <div className="h-6 bg-muted/30 rounded w-16"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="post-card border-destructive/20 bg-destructive/5">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-destructive mb-2">Something went wrong</h3>
            <p className="text-destructive/80 mb-4">{error}</p>
            <button
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
              onClick={() => refresh()}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="post-card text-center">
          <div className="py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/20 flex items-center justify-center">
              <span className="text-2xl">&#128173;</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No posts yet</h3>
            <p className="text-muted-foreground">Be the first to share something amazing!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <FeedTrackingProvider>
      {/* New posts banner */}
      <NewPostsNotifier count={newPostCount} onRefresh={handleRefresh} />

      <div className="space-y-6 max-w-3xl mx-auto">
        {posts.map((post, index) => (
          <div key={post.id}>
            <TrackedPostCard post={post} positionInFeed={index} />
            {/* Suggested users after the 3rd post */}
            {index === 2 && posts.length >= 3 && (
              <div className="mt-6">
                <FeedSuggestions
                  users={suggestedUsers}
                  isLoading={recsLoading}
                  onFollow={followUser}
                />
              </div>
            )}
            {/* Trending posts after the 8th post */}
            {index === 7 && posts.length >= 8 && (
              <div className="mt-6">
                <TrendingPosts posts={trendingPosts} isLoading={recsLoading} />
              </div>
            )}
          </div>
        ))}

        {/* Loading more indicator + sentinel */}
        {hasMore && (
          <div ref={sentinelRef} className="py-8 flex flex-col items-center gap-3">
            {isLoadingMore ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading more posts...</span>
              </div>
            ) : (
              <button
                onClick={loadMore}
                className="px-6 py-2.5 text-sm font-medium rounded-xl bg-accent/50 hover:bg-accent/80 border border-border text-foreground transition-colors"
              >
                Load more
              </button>
            )}
          </div>
        )}

        {/* End of feed */}
        {!hasMore && posts.length > 0 && (
          <div className="py-8 text-center text-muted-foreground text-sm">
            You&#39;re all caught up!
          </div>
        )}
      </div>
    </FeedTrackingProvider>
  );
}
