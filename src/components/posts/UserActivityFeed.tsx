"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Post } from '@/api/posts';
import { PostCard } from './PostCard';
import { supabase } from '@/utils/supabase';

type Props = {
  userId: string;
  type: 'posts' | 'replies';
};

export function UserActivityFeed({ userId, type }: Props) {
  const [items, setItems] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const isReplies = useMemo(() => type === 'replies', [type]);

  // Shared fetch function for user posts/replies
  const fetchUserActivity = useCallback(async (start: number, limit = 20) => {
    // Base select with joins similar to fetchPosts fallback
    let query = supabase
      .from('posts')
      .select(`
        *,
        author:author_id(id, username, avatar_url, full_name, is_verified),
        environment:environment_id(id, name, description, picture),
        media:post_media(*),
        poll:post_polls(*, options:post_poll_options(*))
      `, { count: 'exact' })
      .eq('deleted', false)
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .range(start, start + limit - 1);

    if (isReplies) {
      query = query.not('parent_post_id', 'is', null);
    } else {
      query = query.is('parent_post_id', null);
    }

    const { data: posts, error: postsError, count } = await query;
    if (postsError || !posts) {
      return { data: null as Post[] | null, error: postsError, hasMore: false };
    }

    // Batch counts for likes and replies
    const postIds = posts.map(p => p.id);
    const [likesResult, repliesResult] = await Promise.all([
      supabase.from('post_likes').select('post_id').in('post_id', postIds),
      supabase.from('posts').select('parent_post_id').in('parent_post_id', postIds).eq('deleted', false),
    ]);

    const likesMap = new Map<string, number>();
    const repliesMap = new Map<string, number>();

    if (likesResult.data) {
      likesResult.data.forEach(like => {
        likesMap.set(like.post_id, (likesMap.get(like.post_id) || 0) + 1);
      });
    }

    if (repliesResult.data) {
      repliesResult.data.forEach(reply => {
        if (reply.parent_post_id) {
          repliesMap.set(reply.parent_post_id, (repliesMap.get(reply.parent_post_id) || 0) + 1);
        }
      });
    }

    const withCounts = posts.map(p => ({
      ...p,
      likes: likesMap.get(p.id) || 0,
      replies: repliesMap.get(p.id) || 0,
    })) as Post[];

    const total = count ?? withCounts.length;
    const more = start + withCounts.length < total;
    return { data: withCounts, error: null, hasMore: more };
  }, [userId, isReplies]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      setHasMore(true);
      setOffset(0);
      try {
        const { data, error, hasMore } = await fetchUserActivity(0, 20);
        if (error) throw new Error(error.message);
        if (cancelled) return;
        setItems(data || []);
        setHasMore(Boolean(hasMore));
        setOffset((data?.length || 0));
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Failed to load data';
        setError(msg);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [userId, type, fetchUserActivity]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const { data, error, hasMore: more } = await fetchUserActivity(offset, 20);
      if (error) throw new Error(error.message);
      setItems(prev => [...prev, ...(data || [])]);
      const added = data?.length || 0;
      setOffset(prev => prev + added);
      setHasMore(Boolean(more));
    } catch (e) {
      // non-fatal
      // console.error(e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, fetchUserActivity, offset]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    let ticking = false;
    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && !isLoadingMore && hasMore) {
        if (ticking) return;
        ticking = true;
        Promise.resolve().then(() => {
          loadMore().finally(() => { ticking = false; });
        });
      }
    }, { root: null, rootMargin: '200px 0px', threshold: 0.01 });

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        {[1,2,3].map(i => (
          <div key={i} className="post-card animate-pulse">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-muted/30" />
              <div className="flex-1">
                <div className="h-4 bg-muted/30 rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted/30 rounded w-1/4" />
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <div className="h-4 bg-muted/30 rounded w-full" />
              <div className="h-4 bg-muted/30 rounded w-5/6" />
              <div className="h-4 bg-muted/30 rounded w-4/6" />
            </div>
            <div className="flex justify-between pt-3">
              <div className="h-6 bg-muted/30 rounded w-16" />
              <div className="h-6 bg-muted/30 rounded w-16" />
              <div className="h-6 bg-muted/30 rounded w-16" />
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

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="post-card text-center">
          <div className="py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/20 flex items-center justify-center">
              <span className="text-2xl">{isReplies ? '💬' : '💭'}</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No {isReplies ? 'replies' : 'posts'} yet</h3>
            <p className="text-muted-foreground">{isReplies ? 'Conversations will appear here.' : 'Be the first to share something!'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {items.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {hasMore && (
        <div ref={sentinelRef} className="h-10 flex items-center justify-center text-muted-foreground">
          {isLoadingMore ? 'Loading…' : ''}
        </div>
      )}
    </div>
  );
}
