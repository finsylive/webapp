'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TrackedPostCard } from '@/components/posts/TrackedPostCard';
import { TrendingUp, Loader2, Flame } from 'lucide-react';
import type { Post } from '@/api/posts';

interface TrendingPost extends Post {
  engagement_score: number;
  pinned?: boolean;
}

export default function TrendingPage() {
  const [posts, setPosts] = useState<TrendingPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const fetchPosts = useCallback(async (offset = 0) => {
    try {
      const res = await fetch(`/api/trending?limit=30&offset=${offset}`);
      if (!res.ok) return;
      const data = await res.json();
      if (offset === 0) {
        setPosts(data.posts || []);
      } else {
        setPosts(prev => [...prev, ...(data.posts || [])]);
      }
      setHasMore(data.hasMore);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchPosts(0).finally(() => setIsLoading(false));
  }, [fetchPosts]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchPosts(posts.length);
    setLoadingMore(false);
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <TrendingUp className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Trending on Ments</h1>
              <p className="text-sm text-muted-foreground">
                Posts with the most engagement right now
              </p>
            </div>
          </div>
        </div>

        {/* Posts */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <Flame className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-lg font-semibold text-muted-foreground">No trending posts yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Check back soon for popular content.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post, index) => (
              <div key={post.id} className="relative">
                {/* Rank badge */}
                <div className="absolute -left-2 -top-2 z-10 flex items-center gap-1 rounded-full bg-background border border-border px-2 py-0.5 shadow-sm">
                  <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                  {post.engagement_score > 0 && (
                    <span className="text-[10px] text-orange-500 font-medium">{post.engagement_score}</span>
                  )}
                </div>
                <TrackedPostCard post={post} positionInFeed={index} />
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center py-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent/50 hover:bg-accent/80 border border-border text-sm font-medium text-foreground transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load more'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
