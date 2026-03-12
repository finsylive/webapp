"use client";
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Bell, CheckCheck, Loader2, Rocket, Check, X,
  UserPlus, MessageSquare, AtSign, Heart,
} from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { toProxyUrl } from '@/utils/imageUtils';
import { formatConversationTime } from '@/utils/dateFormat';
import { differenceInDays, isToday, isYesterday } from 'date-fns';

interface NotificationItem {
  id: string;
  type?: 'follow' | 'reply' | 'mention' | 'reaction' | 'cofounder_request' | string;
  content?: string;
  created_at: string;
  actor_name?: string;
  actor_username?: string;
  actor_avatar_url?: string;
  actor_id?: string;
  post_id?: string;
  notification_source?: 'inapp' | 'legacy' | string;
  is_read?: boolean;
  data?: {
    startup_id?: string;
    startup_name?: string;
    founder_id?: string;
    founder_name?: string;
    requester_id?: string;
    [key: string]: unknown;
  };
}

// ── Notification type config ──
const NOTIFICATION_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
}> = {
  follow: {
    icon: UserPlus,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/15',
    label: 'started following you',
  },
  reply: {
    icon: MessageSquare,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/15',
    label: 'replied to your post',
  },
  mention: {
    icon: AtSign,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/15',
    label: 'mentioned you',
  },
  reaction: {
    icon: Heart,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/15',
    label: 'reacted to your message',
  },
  cofounder_request: {
    icon: Rocket,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/15',
    label: 'invited you as co-founder',
  },
};

const DEFAULT_CONFIG = {
  icon: Bell,
  color: 'text-primary',
  bgColor: 'bg-primary/15',
  label: '',
};

function getConfig(type?: string) {
  return (type && NOTIFICATION_CONFIG[type]) || DEFAULT_CONFIG;
}

// ── Date grouping ──
function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (differenceInDays(new Date(), date) < 7) return 'This Week';
  return 'Earlier';
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier'];

function groupNotifications(items: NotificationItem[]): { label: string; items: NotificationItem[] }[] {
  const map = new Map<string, NotificationItem[]>();
  for (const n of items) {
    const g = getDateGroup(n.created_at);
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(n);
  }
  return GROUP_ORDER.filter(g => map.has(g)).map(g => ({ label: g, items: map.get(g)! }));
}

// ── Avatar component ──
function AvatarImageWithFallback({ avatarUrl, email }: { avatarUrl: string; email?: string }) {
  const [src, setSrc] = useState<string>(
    avatarUrl ? toProxyUrl(avatarUrl, { width: 40, quality: 82 }) : ""
  );
  const [proxyFailed, setProxyFailed] = useState(false);
  const [directFailed, setDirectFailed] = useState(false);

  useEffect(() => {
    setSrc(avatarUrl ? toProxyUrl(avatarUrl, { width: 40, quality: 82 }) : "");
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

// ── Skeleton loader ──
function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3.5 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-24 bg-muted rounded" />
          <div className="h-3 w-12 bg-muted rounded ml-auto" />
        </div>
        <div className="h-3 w-40 bg-muted rounded" />
      </div>
    </div>
  );
}

// ── Tab config ──
type TabKey = 'all' | 'follows' | 'replies' | 'mentions';

const TABS: { key: TabKey; label: string; filterType?: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'follows', label: 'Follows', filterType: 'follow' },
  { key: 'replies', label: 'Replies', filterType: 'reply' },
  { key: 'mentions', label: 'Mentions', filterType: 'mention' },
];

// ── Main component ──
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('all');

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

  // ── Derived data ──
  const filteredNotifications = useMemo(() => {
    const tabConfig = TABS.find(t => t.key === tab);
    if (!tabConfig?.filterType) return notifications;
    return notifications.filter(n => n.type === tabConfig.filterType);
  }, [notifications, tab]);

  const grouped = useMemo(() => groupNotifications(filteredNotifications), [filteredNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const tabUnreadCounts = useMemo(() => {
    const counts: Record<TabKey, number> = { all: 0, follows: 0, replies: 0, mentions: 0 };
    for (const n of notifications) {
      if (n.is_read) continue;
      counts.all++;
      if (n.type === 'follow') counts.follows++;
      if (n.type === 'reply') counts.replies++;
      if (n.type === 'mention') counts.mentions++;
    }
    return counts;
  }, [notifications]);

  // ── Mark all read ──
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

  // ── Mark single as read ──
  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userIdRef.current, notificationIds: [id] }),
      });
    } catch {
      // ignore — optimistic update stays
    }
  }, []);

  // ── Co-founder request responses ──
  const [respondedRequests, setRespondedRequests] = useState<Record<string, 'accepted' | 'declined'>>({});
  const [respondingIds, setRespondingIds] = useState<Set<string>>(new Set());

  const handleCofounderRespond = useCallback(async (notificationId: string, founderId: string, action: 'accept' | 'decline') => {
    setRespondingIds(prev => new Set(prev).add(notificationId));
    try {
      const res = await fetch('/api/startups/founders/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ founderId, action }),
      });
      if (res.ok) {
        setRespondedRequests(prev => ({ ...prev, [notificationId]: action === 'accept' ? 'accepted' : 'declined' }));
      }
    } catch {
      // ignore
    } finally {
      setRespondingIds(prev => { const s = new Set(prev); s.delete(notificationId); return s; });
    }
  }, []);

  // ── Click handler ──
  const handleNotificationClick = useCallback((notification: NotificationItem) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    if (notification.type === 'cofounder_request' && notification.data?.startup_id) {
      router.push(`/startups/${notification.data.startup_id}`);
      return;
    }
    if (notification.type === 'follow' && notification.actor_username) {
      router.push(`/profile/${notification.actor_username}`);
    } else if ((notification.type === 'reply' || notification.type === 'mention') && notification.post_id) {
      router.push(`/post/${notification.post_id}`);
    } else if (notification.type === 'reaction' && notification.post_id) {
      router.push(`/post/${notification.post_id}`);
    }
  }, [markAsRead, router]);

  // ── Empty state per tab ──
  const emptyMessages: Record<TabKey, { title: string; subtitle: string }> = {
    all: { title: 'No notifications yet', subtitle: 'When someone interacts with you, it will show up here' },
    follows: { title: 'No follows yet', subtitle: 'When someone follows you, it will appear here' },
    replies: { title: 'No replies yet', subtitle: 'Replies to your posts will appear here' },
    mentions: { title: 'No mentions yet', subtitle: 'When someone mentions you, it will appear here' },
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Stay updated with your latest activity</p>
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

        {/* Tabs with unread badges */}
        <div className="flex gap-1 bg-accent/30 rounded-xl p-1 w-fit">
          {TABS.map(({ key, label }) => {
            const count = tabUnreadCounts[key];
            return (
              <button
                key={key}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${tab === key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'}`}
                onClick={() => setTab(key)}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full ${
                    tab === key
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-primary/15 text-primary'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <NotificationSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="text-red-500 text-center py-12">{error}</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-full bg-accent/40 flex items-center justify-center mb-3">
              <Bell className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-medium mb-0.5">{emptyMessages[tab].title}</p>
            <p className="text-sm text-muted-foreground/70">{emptyMessages[tab].subtitle}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ label, items }) => (
              <div key={label}>
                {/* Section header */}
                <div className="flex items-center gap-3 mb-2 px-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>

                <div className="space-y-0.5">
                  {items.map((n) => {
                    const config = getConfig(n.type);
                    const IconComponent = config.icon;

                    return (
                      <div
                        key={n.id}
                        className={`flex items-start gap-3 p-3.5 rounded-xl transition-all duration-150 cursor-pointer group ${
                          n.is_read
                            ? 'hover:bg-accent/30'
                            : 'bg-primary/[0.03] border-l-2 border-l-primary hover:bg-primary/[0.06]'
                        }`}
                        onClick={() => handleNotificationClick(n)}
                      >
                        {/* Avatar with icon overlay */}
                        <div
                          className="relative flex-shrink-0"
                          onClick={(e) => {
                            if (n.actor_username) {
                              e.stopPropagation();
                              router.push(`/profile/${n.actor_username}`);
                            }
                          }}
                        >
                          <AvatarImageWithFallback
                            avatarUrl={n.actor_avatar_url || ''}
                            email={n.actor_username || n.actor_name || ''}
                          />
                          {/* Type icon badge */}
                          <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full ${config.bgColor} ${config.color} flex items-center justify-center ring-2 ring-[hsl(var(--background))]`}>
                            <IconComponent className="h-2.5 w-2.5" />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span
                              className="font-semibold text-foreground text-sm truncate hover:underline cursor-pointer"
                              onClick={(e) => {
                                if (n.actor_username) {
                                  e.stopPropagation();
                                  router.push(`/profile/${n.actor_username}`);
                                }
                              }}
                            >
                              {n.actor_name || n.actor_username || 'System'}
                            </span>
                            <span className="text-sm text-muted-foreground truncate">
                              {n.type === 'cofounder_request'
                                ? 'invited you as co-founder'
                                : config.label || n.content || 'Notification'}
                            </span>
                            <span className="text-xs text-muted-foreground/70 ml-auto whitespace-nowrap flex-shrink-0">
                              {formatConversationTime(n.created_at)}
                            </span>
                          </div>

                          {/* Extra content */}
                          {n.type === 'cofounder_request' && (
                            <div className="mt-1.5">
                              <span className="text-sm text-muted-foreground">
                                of <span className="font-medium text-foreground">{n.data?.startup_name || 'their startup'}</span>
                              </span>
                              {respondedRequests[n.id] ? (
                                <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                                  respondedRequests[n.id] === 'accepted'
                                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                }`}>
                                  {respondedRequests[n.id] === 'accepted' ? (
                                    <><Check className="h-3.5 w-3.5" /> Accepted</>
                                  ) : (
                                    <><X className="h-3.5 w-3.5" /> Declined</>
                                  )}
                                </div>
                              ) : n.data?.founder_id ? (
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCofounderRespond(n.id, n.data!.founder_id!, 'accept');
                                    }}
                                    disabled={respondingIds.has(n.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                                  >
                                    {respondingIds.has(n.id) ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" />
                                    )}
                                    Accept
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCofounderRespond(n.id, n.data!.founder_id!, 'decline');
                                    }}
                                    disabled={respondingIds.has(n.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors disabled:opacity-50"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    Decline
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          )}

                          {n.type === 'mention' && n.content && (
                            <div className="bg-accent/30 rounded-lg px-3 py-2 mt-1.5 text-sm text-foreground border-l-2 border-amber-500 line-clamp-2">
                              {n.content}
                            </div>
                          )}

                          {n.type === 'reply' && n.content && (
                            <div className="bg-accent/30 rounded-lg px-3 py-2 mt-1.5 text-sm text-foreground border-l-2 border-emerald-500 line-clamp-2">
                              {n.content}
                            </div>
                          )}

                          {n.type === 'reaction' && n.content && (
                            <p className="text-sm text-muted-foreground mt-0.5 truncate">
                              &ldquo;{n.content}&rdquo;
                            </p>
                          )}
                        </div>

                        {/* Unread dot */}
                        {!n.is_read && (
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
