"use client";
import React, { useEffect, useState } from 'react';
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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
      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 flex-shrink-0">
        <span className="text-sm font-medium">{email?.charAt(0).toUpperCase() || "👤"}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt="Profile"
      width={40}
      height={40}
      className="w-10 h-10 object-cover rounded-full border border-gray-600 flex-shrink-0"
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
        const res = await fetch(`/api/notifications?userId=${data.user.id}`);
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
      <div className="flex flex-col flex-1 w-full h-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <h1 className="text-2xl font-semibold text-white mb-6">Notifications</h1>
        
        {/* Compact Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-800 rounded-lg p-1 w-fit">
          {['All', 'Follows', 'Replies', 'Mentions'].map((t) => (
            <button
              key={t}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                ${tab === t.toLowerCase() 
                  ? 'bg-green-500 text-white shadow-sm' 
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}
              onClick={() => setTab(t.toLowerCase() as 'all' | 'follows' | 'replies' | 'mentions')}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : error ? (
          <div className="text-red-400 text-center py-12">{error}</div>
        ) : notifications.length === 0 ? (
          <div className="text-center text-gray-400 py-12">No notifications</div>
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
                className="flex items-start gap-3 p-4 hover:bg-gray-800/50 rounded-lg transition-colors border border-transparent hover:border-gray-700 cursor-pointer"
                onClick={() => handleNotificationClick(n)}
              >
                {/* Compact Avatar */}
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
                      className="font-medium text-white text-sm truncate hover:underline"
                      onClick={(e) => {
                        if (n.actor_username) {
                          e.stopPropagation();
                          router.push(`/profile/${n.actor_username}`);
                        }
                      }}
                    >
                      {n.actor_name || n.actor_username || 'System'}
                    </span>
                    
                    {/* Compact badges */}
                    <div className="flex gap-1">
                      {n.type && (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-300">
                          {n.type.charAt(0).toUpperCase() + n.type.slice(1)}
                        </span>
                      )}
                      {(n.notification_source === 'inapp' || n.notification_source === 'legacy') && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                          {n.notification_source}
                        </span>
                      )}
                    </div>
                    
                    {/* Timestamp */}
                    <span className="text-xs text-gray-500 ml-auto">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {/* Notification message */}
                  <div className="text-sm text-gray-300 leading-relaxed">
                    {n.type === 'reaction' && n.content ? (
                      <>
                        reacted to your message: <span className="font-medium">{n.content}</span>
                      </>
                    ) : n.type === 'mention' ? (
                      <>
                        mentioned you
                        {n.content && (
                          <div className="bg-gray-800 rounded px-3 py-2 mt-2 text-gray-300 text-sm border-l-2 border-green-500">
                            {n.content}
                          </div>
                        )}
                      </>
                    ) : n.type === 'reply' ? (
                      <>
                        replied to your post
                        {n.content && (
                          <div className="bg-gray-800 rounded px-3 py-2 mt-2 text-gray-300 text-sm border-l-2 border-blue-500">
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