"use client";
import React, { useEffect, useState, useRef } from 'react';
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { toProxyUrl } from '@/utils/imageUtils';

interface NotificationItem {
  id: string;
  type?: 'follow' | 'reply' | 'mention' | 'reaction' | string;
  content?: string;
  created_at: string;
  actor_name?: string;
  actor_username?: string;
  actor_avatar_url?: string;
  actor_id?: string;
  post_id?: string;
  notification_source?: 'inapp' | 'legacy' | string;
  is_read?: boolean;
}

// Compact Avatar component
function AvatarImageWithFallback({ avatarUrl, email }: { avatarUrl: string, email?: string }) {
  const [src, setSrc] = useState<string>(
    avatarUrl
      ? toProxyUrl(avatarUrl, { width: 40, quality: 82 })
      : ""
  );
  const [proxyFailed, setProxyFailed] = useState(false);
  const [directFailed, setDirectFailed] = useState(false);

  useEffect(() => {
    setSrc(
      avatarUrl
        ? toProxyUrl(avatarUrl, { width: 40, quality: 82 })
        : ""
    );
    setProxyFailed(false);
    setDirectFailed(false);
  }, [avatarUrl]);

  if (!avatarUrl || directFailed) {
    return (
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
        <span className="text-sm font-semibold">{email?.charAt(0).toUpperCase() || "?"}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt="Profile"
      width={40}
      height={40}
      className="w-10 h-10 object-cover rounded-full border border-border flex-shrink-0"
      unoptimized
      onError={() => {
        if (!proxyFailed) {
          // Only fallback to direct URL if it's http(s); never pass s3:// to next/image
          if (/^https?:\/\//i.test(avatarUrl)) {
            setSrc(avatarUrl);
          } else {
            setDirectFailed(true);
          }
          setProxyFailed(true);
        } else {
          setDirectFailed(true);
        }
      }}
    />
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function getUserIdAndFetch() {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          setError('User not logged in');
          setLoading(false);
          return;
        }
        userIdRef.current = data.user.id;
        const res = await fetch(`/api/notifications?userId=${data.user.id}&limit=50`);
        if (!res.ok) throw new Error('Failed to fetch notifications');
        const result = (await res.json()) as { data?: NotificationItem[] };
        setNotifications(result.data ?? []);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    getUserIdAndFetch();
  }, []);

  const [tab, setTab] = useState<'all' | 'follows' | 'replies' | 'mentions'>('all');

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAllRead = async () => {
    if (!userIdRef.current || markingRead) return;
    setMarkingRead(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userIdRef.current, markAllAsRead: true }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch {
      // ignore
    } finally {
      setMarkingRead(false);
    }
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    if (notification.type === 'follow' && notification.actor_username) {
      router.push(`/profile/${notification.actor_username}`);
    } else if ((notification.type === 'reply' || notification.type === 'mention') && notification.post_id) {
      router.push(`/post/${notification.post_id}`);
    } else if (notification.type === 'reaction' && notification.post_id) {
      router.push(`/post/${notification.post_id}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">Stay updated with your latest activity</p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-primary hover:bg-primary/10 transition disabled:opacity-50"
            >
              {markingRead ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5" />
              )}
              Mark all read
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-accent/30 rounded-xl p-1 w-fit">
          {['All', 'Follows', 'Replies', 'Mentions'].map((t) => (
            <button
              key={t}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${tab === t.toLowerCase()
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'}`}
              onClick={() => setTab(t.toLowerCase() as 'all' | 'follows' | 'replies' | 'mentions')}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        ) : error ? (
          <div className="text-red-500 text-center py-12">{error}</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-accent/30 flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-medium mb-1">No notifications yet</p>
            <p className="text-sm text-muted-foreground/70">When someone interacts with you, it will show up here</p>
          </div>
        ) : (
          <div className="space-y-1">
            {(tab === 'all'
              ? notifications
              : notifications.filter((n) => {
                  if (tab === 'follows') return n.type === 'follow';
                  if (tab === 'replies') return n.type === 'reply';
                  if (tab === 'mentions') return n.type === 'mention';
                  return true;
                })
            ).map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-4 rounded-xl transition-colors border cursor-pointer ${
                  n.is_read
                    ? 'border-transparent hover:bg-accent/30 hover:border-border'
                    : 'bg-primary/5 border-primary/10 hover:bg-primary/10'
                }`}
                onClick={() => handleNotificationClick(n)}
              >
                {/* Unread dot */}
                {!n.is_read && (
                  <div className="w-2 h-2 rounded-full bg-primary mt-4 flex-shrink-0" />
                )}
                {/* Avatar */}
                <div onClick={(e) => {
                  if (n.actor_username) {
                    e.stopPropagation();
                    router.push(`/profile/${n.actor_username}`);
                  }
                }}>
                  <AvatarImageWithFallback
                    avatarUrl={n.actor_avatar_url || ''}
                    email={n.actor_username || n.actor_name || ''}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="font-medium text-foreground text-sm truncate hover:underline"
                      onClick={(e) => {
                        if (n.actor_username) {
                          e.stopPropagation();
                          router.push(`/profile/${n.actor_username}`);
                        }
                      }}
                    >
                      {n.actor_name || n.actor_username || 'System'}
                    </span>

                    {/* Badge */}
                    {n.type && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {n.type.charAt(0).toUpperCase() + n.type.slice(1)}
                      </span>
                    )}

                    {/* Timestamp */}
                    <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Notification message */}
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    {n.type === 'reaction' && n.content ? (
                      <>
                        reacted to your message: <span className="font-medium text-foreground">{n.content}</span>
                      </>
                    ) : n.type === 'mention' ? (
                      <>
                        mentioned you
                        {n.content && (
                          <div className="bg-accent/30 rounded-lg px-3 py-2 mt-2 text-sm text-foreground border-l-2 border-primary">
                            {n.content}
                          </div>
                        )}
                      </>
                    ) : n.type === 'reply' ? (
                      <>
                        replied to your post
                        {n.content && (
                          <div className="bg-accent/30 rounded-lg px-3 py-2 mt-2 text-sm text-foreground border-l-2 border-blue-500">
                            {n.content}
                          </div>
                        )}
                      </>
                    ) : n.type === 'follow' ? (
                      <>started following you</>
                    ) : (
                      <>{n.content || 'Notification'}</>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}