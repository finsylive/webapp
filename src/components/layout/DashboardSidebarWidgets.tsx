"use client";

import { TrendingUp, Users, Bell, MessageCircle, Heart, UserPlus, CheckCircle } from "lucide-react";
import { useSidebarData } from '@/hooks/useSidebarData';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import Link from 'next/link';
import { toProxyUrl } from '@/utils/imageUtils';

import React, { useState, useCallback, useRef, useEffect } from 'react';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function truncateText(text: string | null, max: number): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

const DashboardSidebarWidgets = React.memo(function DashboardSidebarWidgets() {
  const { user } = useAuth();
  const { environments, recentConversations, notifications, myPosts, suggestedUsers, refetch } = useSidebarData();
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [loadingFollow, setLoadingFollow] = useState<Set<string>>(new Set());

  const handleFollow = useCallback(async (username: string, userId: string) => {
    if (!user || loadingFollow.has(userId)) return;

    setLoadingFollow(prev => new Set(prev).add(userId));
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId: user.id, follow: true }),
      });
      if (res.ok) {
        setFollowingSet(prev => new Set(prev).add(userId));
        refetch();
      }
    } catch {
      // ignore
    } finally {
      setLoadingFollow(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  }, [user, loadingFollow, refetch]);

  const containerRef = useRef<HTMLDivElement>(null);
  const baseTopRef = useRef(80);
  const scrollOffsetRef = useRef(0);
  const [stickyTop, setStickyTop] = useState(80);

  // Calculate base sticky top from content height
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const sidebarHeight = containerRef.current.offsetHeight;
      const viewportHeight = window.innerHeight;
      const headerHeight = 80;
      const bottomPadding = 24;
      const calculated = viewportHeight - sidebarHeight - bottomPadding;
      baseTopRef.current = Math.min(headerHeight, calculated);
      scrollOffsetRef.current = 0;
      setStickyTop(baseTopRef.current);
    };

    update();
    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, []);

  // Independent wheel scroll on sidebar — adjusts the sticky top to reveal different widgets
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const baseTop = baseTopRef.current;
      const maxOffset = 80 - baseTop; // total scrollable range
      if (maxOffset <= 0) return; // sidebar fits in viewport, nothing to do

      const currentOffset = scrollOffsetRef.current;
      // At top of sidebar and scrolling up → let page scroll
      const atTop = currentOffset >= maxOffset && e.deltaY < 0;
      // At bottom of sidebar and scrolling down → let page scroll
      const atBottom = currentOffset <= 0 && e.deltaY > 0;

      if (atTop || atBottom) return;

      e.preventDefault();
      const newOffset = Math.max(0, Math.min(maxOffset, currentOffset - e.deltaY));
      scrollOffsetRef.current = newOffset;
      setStickyTop(baseTop + newOffset);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-4 h-4 text-red-500" />;
      case 'comment': case 'reply': return <MessageCircle className="w-4 h-4 text-muted-foreground" />;
      case 'follow': return <UserPlus className="w-4 h-4 text-green-500" />;
      default: return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div ref={containerRef} className="sticky space-y-4" style={{ top: `${stickyTop}px` }}>
      {/* Communities / Environments Widget */}
      {environments.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-[18px] h-[18px] text-muted-foreground" />
              <h2 className="text-sm font-bold text-foreground">Communities</h2>
            </div>
            <Link href="/environments" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-0.5">
            {environments.slice(0, 12).map((env) => (
              <Link
                key={env.id}
                href={`/environments/${env.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-[7px] text-sm font-medium text-foreground hover:bg-accent/60 transition-colors"
              >
                {env.picture ? (
                  <Image
                    src={toProxyUrl(env.picture, { width: 32, quality: 80 })}
                    alt={env.name}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground flex-shrink-0">
                    {env.name.charAt(0)}
                  </div>
                )}
                <span className="truncate">{env.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Chats Widget */}
      {recentConversations.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-[18px] h-[18px] text-muted-foreground" />
              <h2 className="text-sm font-bold text-foreground">Recent Chats</h2>
            </div>
            <Link href="/messages" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-0.5">
            {recentConversations.map((conv) => (
              <Link
                key={conv.conversation_id}
                href={`/messages/${conv.conversation_id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-[7px] text-sm hover:bg-accent/60 transition-colors"
              >
                {conv.other_avatar_url ? (
                  <Image
                    src={toProxyUrl(conv.other_avatar_url, { width: 32, quality: 80 })}
                    alt={conv.other_full_name || conv.other_username}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground flex-shrink-0">
                    {(conv.other_full_name || conv.other_username || '?').charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {conv.other_full_name || conv.other_username}
                  </p>
                  {conv.last_message && (
                    <p className="truncate text-xs text-muted-foreground">
                      {conv.last_message}
                    </p>
                  )}
                </div>
                {conv.unread_count > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground font-bold">
                    {conv.unread_count > 9 ? '9+' : conv.unread_count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Widget — Real notifications */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-[18px] h-[18px] text-muted-foreground" />
            <h2 className="text-sm font-bold text-foreground">Recent Activity</h2>
          </div>
          <Link href="/notifications" className="text-xs font-medium text-primary hover:underline">View all</Link>
        </div>
        <div className="space-y-1.5">
          {notifications.length > 0 ? (
            notifications.slice(0, 5).map((notif) => (
              <Link
                key={notif.id}
                href="/notifications"
                className={`flex items-start gap-2.5 rounded-lg p-2.5 transition-colors ${
                  !notif.is_read ? 'bg-primary/5 border border-primary/10' : 'hover:bg-accent/60'
                }`}
              >
                <div className="mt-0.5">{getActivityIcon(notif.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground leading-snug">
                    {truncateText(notif.content, 70)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(notif.created_at)}</p>
                </div>
                {!notif.is_read && (
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                )}
              </Link>
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No recent activity</p>
          )}
        </div>
      </div>

      {/* My Posts Performance Widget — Real posts */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-[18px] h-[18px] text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">My Posts</h2>
        </div>
        <div className="space-y-1.5">
          {myPosts.length > 0 ? (
            myPosts.map((post) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="block rounded-lg bg-muted/30 p-2.5 hover:bg-accent/60 transition-colors"
              >
                <p className="text-xs text-foreground mb-1.5 line-clamp-2 leading-snug">
                  {truncateText(post.content, 60) || 'Untitled post'}
                </p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      <span>{post.likes}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      <span>{post.replies}</span>
                    </div>
                  </div>
                  <span>{timeAgo(post.created_at)}</span>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No posts yet</p>
          )}
        </div>
      </div>

      {/* People to Connect Widget */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-[18px] h-[18px] text-muted-foreground" />
            <h2 className="text-sm font-bold text-foreground">People to Connect</h2>
          </div>
          <Link href="/people" className="text-xs font-medium text-primary hover:underline">View all</Link>
        </div>
        <div className="space-y-2">
          {suggestedUsers.length > 0 ? (
            suggestedUsers.map((person) => (
              <div key={person.id} className="rounded-lg bg-muted/30 p-2.5">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/profile/${encodeURIComponent(person.username)}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    {person.avatar_url ? (
                      <Image
                        src={toProxyUrl(person.avatar_url, { width: 36, quality: 80 })}
                        alt={person.full_name || person.username}
                        width={36}
                        height={36}
                        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold bg-muted text-muted-foreground flex-shrink-0">
                        {(person.full_name || person.username || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <h3 className="font-semibold text-sm text-foreground truncate">{person.full_name || person.username}</h3>
                        {person.is_verified && <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {person.tagline || `@${person.username}`}
                      </p>
                    </div>
                  </Link>
                  {followingSet.has(person.id) ? (
                    <span className="text-xs text-muted-foreground px-3 py-1.5 rounded-lg border border-border font-medium">
                      Following
                    </span>
                  ) : (
                    <button
                      onClick={() => handleFollow(person.username, person.id)}
                      disabled={loadingFollow.has(person.id)}
                      className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-50"
                    >
                      {loadingFollow.has(person.id) ? '...' : 'Follow'}
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No suggestions yet</p>
          )}
        </div>
      </div>
    </div>
  );
});

export default DashboardSidebarWidgets;
