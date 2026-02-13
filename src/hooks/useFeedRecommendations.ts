"use client";

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface SuggestedUser {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  tagline: string | null;
  is_verified: boolean;
}

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

export function useFeedRecommendations() {
  const { user } = useAuth();
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/recommendations');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setSuggestedUsers(data.suggestedUsers || []);
        setTrendingPosts(data.trendingPosts || []);
      } catch {
        // silently ignore – user may not be fully authenticated yet
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  const followUser = useCallback(async (username: string, userId: string) => {
    if (!user) return;

    // Optimistically remove from suggestions
    setSuggestedUsers(prev => prev.filter(u => u.id !== userId));

    try {
      const res = await fetch(`/api/users/${username}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId: user.id, follow: true }),
      });

      if (!res.ok) {
        // Revert on failure — re-fetch
        const refetch = await fetch('/api/recommendations');
        if (refetch.ok) {
          const data = await refetch.json();
          setSuggestedUsers(data.suggestedUsers || []);
        }
      }
    } catch {
      // Silently ignore
    }
  }, [user]);

  return { suggestedUsers, trendingPosts, isLoading, followUser };
}
