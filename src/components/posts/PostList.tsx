"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Post, fetchPosts } from '@/api/posts';
import { PostCard } from './PostCard';
import { FeedSuggestions } from '@/components/feed/FeedSuggestions';
import { TrendingPosts } from '@/components/feed/TrendingPosts';
import { useFeedRecommendations } from '@/hooks/useFeedRecommendations';

type PostListProps = {
  environmentId: string;
  refreshTrigger?: number; // Increment to trigger refresh
};

export function PostList({ environmentId, refreshTrigger = 0 }: PostListProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { suggestedUsers, trendingPosts, isLoading: recsLoading, followUser } = useFeedRecommendations();

  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true);
      setError(null);
      setOffset(0);
      setHasMore(true);
      try {
        console.log('Fetching posts for environmentId:', environmentId);
        const { data, error, hasMore } = await fetchPosts(environmentId, { offset: 0, limit: 20 });
        console.log('Fetched posts:', data);
        if (error) throw new Error(error.message);
        setPosts(data || []);
        setHasMore(Boolean(hasMore));
        setOffset((data?.length || 0));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load posts');
        console.error('Error loading posts:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitial();
  }, [refreshTrigger, environmentId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const { data, error, hasMore: more } = await fetchPosts(environmentId, { offset, limit: 20 });
      if (error) throw new Error(error.message);
      setPosts((prev) => [...prev, ...(data || [])]);
      const added = data?.length || 0;
      setOffset((prev) => prev + added);
      setHasMore(Boolean(more));
    } catch (err) {
      console.error('Error loading more posts:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, environmentId, offset]);

  // Infinite scroll: observe the sentinel at the bottom
  useEffect(() => {
    if (!hasMore) return; // nothing to observe
    const el = sentinelRef.current;
    if (!el) return;

    let ticking = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoadingMore && hasMore) {
          if (ticking) return;
          ticking = true;
          // small microtask to avoid rapid double-fires on some browsers
          Promise.resolve().then(() => {
            loadMore().finally(() => {
              ticking = false;
            });
          });
        }
      },
      {
        root: null,
        rootMargin: '200px 0px', // prefetch a bit before reaching bottom
        threshold: 0.01,
      }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoadingMore, loadMore]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
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
      <div className="max-w-2xl mx-auto">
        <div className="post-card border-destructive/20 bg-destructive/5">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-destructive mb-2">Something went wrong</h3>
            <p className="text-destructive/80 mb-4">{error}</p>
            <button 
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
              onClick={() => window.location.reload()}
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
      <div className="max-w-2xl mx-auto">
        <div className="post-card text-center">
          <div className="py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/20 flex items-center justify-center">
              <span className="text-2xl">💭</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No posts yet</h3>
            <p className="text-muted-foreground">Be the first to share something amazing!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {posts.map((post, index) => (
        <div key={post.id}>
          <PostCard post={post} />
          {/* Suggested users after the 3rd post */}
          {index === 2 && posts.length >= 3 && (
            <div className="mt-6">
              <FeedSuggestions users={suggestedUsers} isLoading={recsLoading} onFollow={followUser} />
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
      {/* Sentinel for infinite scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="h-10 flex items-center justify-center text-muted-foreground">
          {isLoadingMore ? 'Loading…' : ''}
        </div>
      )}
    </div>
  );
}
