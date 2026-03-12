"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Post } from '@/api/posts';

interface PersonalizedFeedState {
  posts: Post[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  source: string;
  experimentId: string | null;
  variant: string | null;
}

export function usePersonalizedFeed() {
  const { user } = useAuth();
  const [state, setState] = useState<PersonalizedFeedState>({
    posts: [],
    isLoading: true,
    isLoadingMore: false,
    error: null,
    hasMore: true,
    source: '',
    experimentId: null,
    variant: null,
  });

  const cursorRef = useRef<string | null>(null);
  const offsetRef = useRef<number>(0);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchFeed = useCallback(async (isLoadMore = false) => {
    if (!user) return;
    if (loadingRef.current) return;
    loadingRef.current = true;

    if (isLoadMore) {
      setState((prev) => ({ ...prev, isLoadingMore: true }));
    } else {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
    }

    try {
      const params = new URLSearchParams();
      if (isLoadMore) {
        if (cursorRef.current) {
          params.set('cursor', cursorRef.current);
        }
        if (offsetRef.current > 0) {
          params.set('offset', String(offsetRef.current));
        }
      }

      const res = await fetch(`/api/feed?${params}`, {
        headers: { 'x-user-id': user.id },
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        throw new Error(`Feed request failed: ${res.status}`);
      }

      const data = await res.json();
      const newPosts = (data.posts || []) as Post[];

      if (!mountedRef.current) return;

      setState((prev) => {
        const merged = isLoadMore ? [...prev.posts, ...newPosts] : newPosts;
        // Deduplicate by post id to prevent React key warnings
        const seen = new Set<string>();
        const uniquePosts = merged.filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
        return {
          ...prev,
          posts: uniquePosts,
          isLoading: false,
          isLoadingMore: false,
          hasMore: data.has_more ?? false,
          source: data.source || '',
          experimentId: data.experiment_id || null,
          variant: data.variant || null,
          error: null,
        };
      });

      cursorRef.current = data.cursor || null;
      if (data.offset !== undefined) {
        offsetRef.current = data.offset;
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('Error fetching personalized feed:', err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isLoadingMore: false,
        error: err instanceof Error ? err.message : 'Failed to load feed',
      }));
    } finally {
      loadingRef.current = false;
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    if (user) {
      cursorRef.current = null;
      offsetRef.current = 0;
      loadingRef.current = false;
      fetchFeed(false);
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
    return () => {
      mountedRef.current = false;
    };
  }, [user, fetchFeed]);

  const loadMore = useCallback(() => {
    if (!loadingRef.current && state.hasMore) {
      fetchFeed(true);
    }
  }, [state.hasMore, fetchFeed]);

  const refresh = useCallback(async () => {
    try {
      await fetch('/api/feed/refresh', { method: 'POST' }).catch(() => {});
    } catch {
      // Non-blocking
    }
    cursorRef.current = null;
    offsetRef.current = 0;
    loadingRef.current = false;
    await fetchFeed(false);
  }, [fetchFeed]);

  // Instantly prepend a newly created post to the top of the feed
  const prependPost = useCallback((post: Post) => {
    setState((prev) => ({
      ...prev,
      posts: [post, ...prev.posts.filter((p) => p.id !== post.id)],
    }));
  }, []);

  return {
    posts: state.posts,
    isLoading: state.isLoading,
    isLoadingMore: state.isLoadingMore,
    error: state.error,
    hasMore: state.hasMore,
    source: state.source,
    experimentId: state.experimentId,
    variant: state.variant,
    loadMore,
    refresh,
    prependPost,
  };
}
