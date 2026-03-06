"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase';

interface Environment {
  id: string;
  name: string;
  picture: string | null;
}

interface RecentConversation {
  conversation_id: string;
  other_user_id: string;
  other_username: string;
  other_full_name: string;
  other_avatar_url: string | null;
  last_message: string | null;
  updated_at: string;
  unread_count: number;
}

interface Notification {
  id: string;
  type: string;
  content: string;
  is_read: boolean;
  created_at: string;
  user_id: string;
  notification_source: 'legacy' | 'inapp';
}

interface UserPost {
  id: string;
  content: string | null;
  post_type: string;
  created_at: string;
  likes: number;
  replies: number;
}

interface SuggestedUser {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  tagline: string | null;
  is_verified: boolean;
}

interface SidebarData {
  unreadMessages: number;
  unreadNotifications: number;
  environments: Environment[];
  recentConversations: RecentConversation[];
  notifications: Notification[];
  myPosts: UserPost[];
  suggestedUsers: SuggestedUser[];
}

// Increase poll interval from 30s → 5 minutes.
// At 10K users, 30s = 140K req/min; 5 min = 14K req/min (10x reduction).
// Real-time channels handle urgent updates (messages, notifications).
const POLL_INTERVAL = 300_000; // 5 minutes

// Cache suggested users in memory so we don't re-query every cycle.
let suggestedUsersCache: { users: SuggestedUser[]; fetchedAt: number } | null = null;
const SUGGESTED_USERS_CACHE_TTL = 600_000; // 10 minutes

export function useSidebarData() {
  const { user } = useAuth();
  const [data, setData] = useState<SidebarData>({
    unreadMessages: 0,
    unreadNotifications: 0,
    environments: [],
    recentConversations: [],
    notifications: [],
    myPosts: [],
    suggestedUsers: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch only lightweight counts — not full data sets.
  // Heavy data (environments, suggested users) are fetched once and cached.
  const fetchCounts = useCallback(async () => {
    if (!user) return;
    const userId = user.id;

    try {
      const [messagesRes, notifRes, convRes] = await Promise.allSettled([
        fetch(`/api/messages/read?userId=${userId}`),
        fetch(`/api/notifications?userId=${userId}&unreadOnly=true&limit=1`),
        fetch(`/api/conversations?userId=${userId}&limit=5`),
      ]);

      const update: Partial<SidebarData> = {};

      if (messagesRes.status === 'fulfilled' && messagesRes.value.ok) {
        const json = await messagesRes.value.json();
        update.unreadMessages = json.total_unread_count ?? 0;
      }

      if (notifRes.status === 'fulfilled' && notifRes.value.ok) {
        const json = await notifRes.value.json();
        update.unreadNotifications = json.pagination?.total ?? 0;
      }

      if (convRes.status === 'fulfilled' && convRes.value.ok) {
        const json = await convRes.value.json();
        update.recentConversations = Array.isArray(json) ? json : [];
      }

      setData(prev => ({ ...prev, ...update }));
    } catch {
      // Sidebar data is non-critical
    }
  }, [user]);

  // Fetch heavy data only once on mount (or when cache is stale).
  const fetchHeavyData = useCallback(async () => {
    if (!user) return;
    const userId = user.id;

    try {
      const [envRes, notifListRes, postsResult, suggestedResult] = await Promise.allSettled([
        fetch('/api/environments'),
        fetch(`/api/notifications?userId=${userId}&page=1&limit=10`),
        // User's own posts — use Supabase COUNT for likes/replies instead of fetching all rows
        (async () => {
          const { data: posts } = await supabase
            .from('posts')
            .select('id, content, post_type, created_at')
            .eq('author_id', userId)
            .eq('deleted', false)
            .is('parent_post_id', null)
            .order('created_at', { ascending: false })
            .limit(5);

          if (!posts || posts.length === 0) return [];

          const postIds = posts.map((p: { id: string }) => p.id);

          // Batch fetch counts (still 2 queries, but limited by post count = 5)
          const [likesRes, repliesRes] = await Promise.all([
            supabase.from('post_likes').select('post_id').in('post_id', postIds),
            supabase.from('posts').select('parent_post_id').in('parent_post_id', postIds).eq('deleted', false),
          ]);

          const likesMap = new Map<string, number>();
          const repliesMap = new Map<string, number>();
          likesRes.data?.forEach((l: { post_id: string }) => likesMap.set(l.post_id, (likesMap.get(l.post_id) || 0) + 1));
          repliesRes.data?.forEach((r: { parent_post_id: string | null }) => {
            if (r.parent_post_id) repliesMap.set(r.parent_post_id, (repliesMap.get(r.parent_post_id) || 0) + 1);
          });

          return posts.map((p: { id: string; content: string | null; post_type: string; created_at: string }) => ({
            id: p.id,
            content: p.content,
            post_type: p.post_type,
            created_at: p.created_at,
            likes: likesMap.get(p.id) || 0,
            replies: repliesMap.get(p.id) || 0,
          }));
        })(),
        // Suggested users — use client-side cache to avoid re-querying
        (async () => {
          // Return cached if still fresh
          if (suggestedUsersCache && (Date.now() - suggestedUsersCache.fetchedAt) < SUGGESTED_USERS_CACHE_TTL) {
            return suggestedUsersCache.users;
          }

          const { data: followRows } = await supabase
            .from('user_follows')
            .select('followee_id')
            .eq('follower_id', userId);

          const followingIds = new Set((followRows || []).map((r: { followee_id: string }) => r.followee_id));
          followingIds.add(userId);

          const { data: users } = await supabase
            .from('users')
            .select('id, username, full_name, avatar_url, tagline, is_verified')
            .eq('account_status', 'active')
            .order('is_verified', { ascending: false })
            .limit(30);

          if (!users) return [];

          const result = users
            .filter((u: { id: string }) => !followingIds.has(u.id))
            .slice(0, 5) as SuggestedUser[];

          // Cache the result
          suggestedUsersCache = { users: result, fetchedAt: Date.now() };
          return result;
        })(),
      ]);

      const update: Partial<SidebarData> = {};

      if (envRes.status === 'fulfilled' && envRes.value.ok) {
        const json = await envRes.value.json();
        update.environments = Array.isArray(json) ? json : [];
      }

      if (notifListRes.status === 'fulfilled' && notifListRes.value.ok) {
        const json = await notifListRes.value.json();
        update.notifications = Array.isArray(json.data) ? json.data : [];
      }

      if (postsResult.status === 'fulfilled') {
        update.myPosts = postsResult.value as UserPost[];
      }

      if (suggestedResult.status === 'fulfilled') {
        update.suggestedUsers = suggestedResult.value as SuggestedUser[];
      }

      setData(prev => ({ ...prev, ...update }));
    } catch {
      // Non-critical
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setData({
        unreadMessages: 0,
        unreadNotifications: 0,
        environments: [],
        recentConversations: [],
        notifications: [],
        myPosts: [],
        suggestedUsers: [],
      });
      setIsLoading(false);
      return;
    }

    // Initial load: fetch everything
    const init = async () => {
      await Promise.all([fetchCounts(), fetchHeavyData()]);
      setIsLoading(false);
    };
    init();

    // Only poll the lightweight counts at the reduced interval
    intervalRef.current = setInterval(fetchCounts, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, fetchCounts, fetchHeavyData]);

  return { ...data, isLoading, refetch: fetchCounts };
}
