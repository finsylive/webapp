"use client";

import Link from 'next/link';
import { Heart, TrendingUp } from 'lucide-react';
import { toProxyUrl } from '@/utils/imageUtils';
import { formatConversationTime } from '@/utils/dateFormat';

interface TrendingPost {
  id: string;
  content: string | null;
  created_at: string;
  likes: number;
  author: {
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface TrendingPostsProps {
  posts: TrendingPost[];
  isLoading: boolean;
}

export function TrendingPosts({ posts, isLoading }: TrendingPostsProps) {
  if (!isLoading && posts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <TrendingUp className="w-4 h-4" />
        Trending on Ments
      </h3>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-8 h-8 rounded-full bg-muted/30 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted/30 rounded w-1/3" />
                <div className="h-3 bg-muted/30 rounded w-full" />
                <div className="h-3 bg-muted/30 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map(post => (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="flex gap-3 p-2 -mx-2 rounded-lg hover:bg-accent/30 transition-colors group"
            >
              {post.author.avatar_url ? (
                <img
                  src={toProxyUrl(post.author.avatar_url, { width: 64, quality: 80 })}
                  alt={post.author.full_name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm flex-shrink-0">
                  {post.author.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-medium text-foreground truncate">
                    {post.author.full_name}
                  </span>
                  <span className="text-muted-foreground flex-shrink-0">
                    {formatConversationTime(post.created_at)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5 group-hover:text-foreground transition-colors">
                  {post.content || 'Shared a post'}
                </p>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Heart className="w-3 h-3" />
                  <span>{post.likes}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
