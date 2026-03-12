"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ChatInput from '../ChatInput';
import MessageBubble from '@/components/messages/MessageBubble';
import TypingIndicator from '@/components/messages/TypingIndicator';
import MessageSkeleton from '@/components/messages/MessageSkeleton';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeMessages } from '../useRealtimeMessages';
import { ArrowLeft, Phone, MoreVertical, Search, AlertCircle, Trash2, Ban, CheckSquare, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { VerifyBadge } from '@/components/ui/VerifyBadge';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  reply_to_id?: string;
}

interface Reaction {
  message_id: string;
  user_id: string;
  reaction: string;
}

interface GroupedReaction {
  emoji: string;
  count: number;
  users: string[];
}

interface OtherUserProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_verified?: boolean;
}

export default function ConversationPage() {
  const { conversationId } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  // Removed unused variable isDarkMode from useTheme
  const userId = user?.id;

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<OtherUserProfile | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false); // you blocked them
  const [isBlockedByOther, setIsBlockedByOther] = useState(false); // they blocked you

  // Select mode & menu state
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deletingMessages, setDeletingMessages] = useState<Set<string>>(new Set());
  const headerMenuRef = useRef<HTMLDivElement>(null);

  // Custom modal state (replaces native alert/confirm)
  const [modal, setModal] = useState<{
    title: string;
    message: string;
    type: 'confirm' | 'alert';
    destructive?: boolean;
    confirmLabel?: string;
    onConfirm?: () => void;
  } | null>(null);

  const showAlert = useCallback((title: string, message: string) => {
    setModal({ title, message, type: 'alert' });
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, opts?: { destructive?: boolean; confirmLabel?: string }) => {
    setModal({ title, message, type: 'confirm', onConfirm, destructive: opts?.destructive, confirmLabel: opts?.confirmLabel });
  }, []);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom with smooth animation
  const scrollToBottom = useCallback((smooth: boolean = true) => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end'
      });
    }, 100);
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Mark messages as read
  const markAsRead = useCallback(async () => {
    if (!conversationId || !userId) return;
    try {
      await fetch('/api/messages/read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ conversation_id: String(conversationId) }),
      });
    } catch (err) {
      console.error('Failed to mark messages as read:', err);
    }
  }, [conversationId, userId]);

  // Fetch messages and reactions
  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/messages?conversationId=${String(conversationId)}`).then(res => {
        if (!res.ok) throw new Error('Failed to fetch messages');
        return res.json();
      }),
      fetch(`/api/messages/reactions?conversationId=${String(conversationId)}`).then(res => {
        if (!res.ok) throw new Error('Failed to fetch reactions');
        return res.json();
      }),
    ])
      .then(([messagesResponse, reacts]) => {
        setMessages(messagesResponse.messages || []);
        setReactions(reacts || []);
      })
      .catch(e => {
        console.error('Failed to load conversation:', e);
        setError(e.message || 'Failed to load conversation');
      })
      .finally(() => setLoading(false));
  }, [conversationId]);

  // Mark all messages as read when conversation loads or gets new messages
  useEffect(() => {
    if (!loading && messages.length > 0 && userId) {
      markAsRead();
    }
  }, [loading, messages.length, userId, markAsRead]);

  // Load the other participant (username and avatar)
  useEffect(() => {
    if (!conversationId || !userId) return;

    (async () => {
      try {
        const { data: convo, error: convoErr } = await supabase
          .from('conversations')
          .select('id,user1_id,user2_id')
          .eq('id', String(conversationId))
          .single();

        if (convoErr) throw convoErr;

        const otherId = convo.user1_id === userId ? convo.user2_id : convo.user1_id;
        if (!otherId) return;

        const { data: profile, error: profErr } = await supabase
          .from('users')
          .select('id, full_name, username, avatar_url, is_verified')
          .eq('id', otherId)
          .single();

        if (profErr) throw profErr;

        setOtherUser(profile as OtherUserProfile);

        // Check block status in both directions
        const [{ data: youBlockedThem }, { data: theyBlockedYou }] = await Promise.all([
          supabase
            .from('user_blocks')
            .select('id')
            .eq('blocker_id', userId)
            .eq('blocked_id', otherId)
            .maybeSingle(),
          supabase
            .from('user_blocks')
            .select('id')
            .eq('blocker_id', otherId)
            .eq('blocked_id', userId)
            .maybeSingle(),
        ]);

        setIsBlocked(!!youBlockedThem);
        setIsBlockedByOther(!!theyBlockedYou);
      } catch (e) {
        console.error('Load other user failed', e);
      }
    })();
  }, [conversationId, userId]);

  // Proxied image helper
  function getProxiedImageUrl(url: string | null | undefined): string | null {
    if (!url) return null;

    // Only proxy S3 URLs that start with "s3://"
    if (url.startsWith('s3://')) {
      const base = 'https://lrgwsbslfqiwoazmitre.supabase.co/functions/v1/get-image?url=';
      return `${base}${encodeURIComponent(url)}`;
    }

    // All other URLs (Google, direct HTTPS, etc.) use directly
    return url;
  }

  // Real-time updates for messages
  useRealtimeMessages(
    conversationId ? String(conversationId) : null,
    (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Mark as read if from other user and page is visible
      if (msg.sender_id !== userId && document.visibilityState === 'visible') {
        markAsRead();
      }
    }
  );

  // Reaction handlers
  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return;

    try {
      await fetch('/api/messages/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, user_id: userId, reaction: emoji })
      });

      // Optimistically update
      setReactions((prev: Reaction[]) => {
        const existing = prev.find(r => r.message_id === messageId && r.user_id === userId);
        if (existing) {
          return prev.map(r =>
            r.message_id === messageId && r.user_id === userId ? { ...r, reaction: emoji } : r
          );
        } else {
          return [...prev, { message_id: messageId, user_id: userId, reaction: emoji }];
        }
      });
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  }, [userId]);

  const handleRemoveReaction = useCallback(async (messageId: string) => {
    if (!userId) return;

    try {
      await fetch('/api/messages/reactions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, user_id: userId })
      });

      setReactions((prev: Reaction[]) =>
        prev.filter(r => !(r.message_id === messageId && r.user_id === userId))
      );
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  }, [userId]);

  // Group reactions by message and emoji
  const getGroupedReactions = useCallback((messageId: string): GroupedReaction[] => {
    const grouped: Record<string, GroupedReaction> = {};
    reactions.filter(r => r.message_id === messageId).forEach(r => {
      if (!grouped[r.reaction]) grouped[r.reaction] = { emoji: r.reaction, count: 0, users: [] };
      grouped[r.reaction].count++;
      grouped[r.reaction].users.push(r.user_id);
    });
    return Object.values(grouped);
  }, [reactions]);

  // Get current user's reaction for a message
  const getMyReaction = useCallback((messageId: string) => {
    return reactions.find(r => r.message_id === messageId && r.user_id === userId)?.reaction;
  }, [reactions, userId]);

  // Group messages by date and handle message grouping
  const groupedMessages = useMemo(() => {
    // Deduplicate messages by id to prevent React duplicate key warnings
    const seen = new Set<string>();
    const unique = messages.filter(msg => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    });
    const groups: Record<string, Message[]> = {};
    unique.forEach(msg => {
      const date = new Date(msg.created_at).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  }, [messages]);

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  // Format time for between-message timestamps (Instagram style)
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  // Check if there's a significant time gap between messages (15 min)
  const shouldShowTimestamp = (current: Message, prev: Message | null) => {
    if (!prev) return true;
    const gap = new Date(current.created_at).getTime() - new Date(prev.created_at).getTime();
    return gap > 15 * 60 * 1000; // 15 minutes
  };

  // Animate message removal then delete from state
  const animateAndRemove = useCallback((ids: string[]) => {
    setDeletingMessages(new Set(ids));
    setTimeout(() => {
      setMessages(prev => prev.filter(m => !ids.includes(m.id)));
      setReactions(prev => prev.filter(r => !ids.includes(r.message_id)));
      setDeletingMessages(new Set());
    }, 300);
  }, []);

  // Handle message actions
  const handleReply = useCallback((message: Message) => {
    setReplyingTo(message);
  }, []);

  const handleClearReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleEdit = useCallback((message: Message) => {
    // Implement edit functionality
    console.log('Edit message:', message);
  }, []);

  const handleDelete = useCallback((messageId: string) => {
    showConfirm('Delete Message', 'Are you sure you want to delete this message?', async () => {
      try {
        const res = await fetch('/api/messages/delete-bulk', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message_ids: [messageId],
            conversation_id: String(conversationId),
          }),
        });
        if (res.ok) {
          animateAndRemove([messageId]);
        } else {
          const data = await res.json();
          showAlert('Error', data.error || 'Failed to delete message');
        }
      } catch {
        showAlert('Error', 'Failed to delete message');
      }
    }, { destructive: true, confirmLabel: 'Delete' });
  }, [conversationId, showConfirm, showAlert, animateAndRemove]);

  // Close header menu on outside click
  useEffect(() => {
    if (!showHeaderMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setShowHeaderMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showHeaderMenu]);

  // Toggle message selection
  const handleToggleSelect = useCallback((messageId: string) => {
    setSelectedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);

  // Select all messages
  const handleSelectAll = useCallback(() => {
    setSelectedMessages(new Set(messages.map(m => m.id)));
  }, [messages]);

  // Exit select mode
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedMessages(new Set());
  }, []);

  // Clear chat handler (per-user: only clears your view, other user still sees messages)
  const handleClearChat = useCallback(() => {
    if (!conversationId) return;
    showConfirm('Clear Chat', 'Clear all messages from your view? The other person will still see the messages.', async () => {
      setActionLoading('clear');
      try {
        const res = await fetch('/api/messages/clear', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_id: String(conversationId) }),
        });
        if (res.ok) {
          animateAndRemove(messages.map(m => m.id));
        } else {
          const data = await res.json();
          showAlert('Error', data.error || 'Failed to clear chat');
        }
      } catch {
        showAlert('Error', 'Failed to clear chat');
      } finally {
        setActionLoading(null);
        setShowHeaderMenu(false);
      }
    }, { destructive: true, confirmLabel: 'Clear' });
  }, [conversationId, showConfirm, showAlert, animateAndRemove, messages]);

  // Block user handler
  const handleBlockUser = useCallback(() => {
    if (!otherUser?.id) return;
    const name = otherUser.full_name || otherUser.username || 'this user';
    showConfirm('Block User', `Are you sure you want to block ${name}? They won't be able to message you.`, async () => {
      setActionLoading('block');
      try {
        const res = await fetch('/api/users/block', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocked_user_id: otherUser.id }),
        });
        if (res.ok) {
          setIsBlocked(true);
        } else {
          const data = await res.json();
          showAlert('Error', data.error || 'Failed to block user');
        }
      } catch {
        showAlert('Error', 'Failed to block user');
      } finally {
        setActionLoading(null);
        setShowHeaderMenu(false);
      }
    }, { destructive: true, confirmLabel: 'Block' });
  }, [otherUser, showConfirm, showAlert]);

  // Unblock user handler
  const handleUnblockUser = useCallback(async () => {
    if (!otherUser?.id) return;
    setActionLoading('unblock');
    try {
      const res = await fetch('/api/users/block', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked_user_id: otherUser.id }),
      });
      if (res.ok) {
        setIsBlocked(false);
      } else {
        const data = await res.json();
        showAlert('Error', data.error || 'Failed to unblock user');
      }
    } catch {
      showAlert('Error', 'Failed to unblock user');
    } finally {
      setActionLoading(null);
      setShowHeaderMenu(false);
    }
  }, [otherUser, showAlert]);

  // Delete selected messages
  const handleDeleteSelected = useCallback(() => {
    if (selectedMessages.size === 0) return;
    const count = selectedMessages.size;
    showConfirm('Delete Messages', `Delete ${count} selected message${count > 1 ? 's' : ''}?`, async () => {
      setActionLoading('delete-selected');
      try {
        const res = await fetch('/api/messages/delete-bulk', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message_ids: Array.from(selectedMessages),
            conversation_id: String(conversationId),
          }),
        });
        if (res.ok) {
          animateAndRemove(Array.from(selectedMessages));
          exitSelectMode();
        } else {
          const data = await res.json();
          showAlert('Error', data.error || 'Failed to delete messages');
        }
      } catch {
        showAlert('Error', 'Failed to delete messages');
      } finally {
        setActionLoading(null);
      }
    }, { destructive: true, confirmLabel: 'Delete' });
  }, [selectedMessages, conversationId, exitSelectMode, showConfirm, showAlert, animateAndRemove]);

  // Typing indicator via Supabase broadcast
  useEffect(() => {
    if (!conversationId || !userId) return;

    const channel = supabase.channel(`typing:${conversationId}`);

    channel
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        // Only show typing if it's from the OTHER user
        if (payload.payload?.user_id !== userId) {
          setIsTyping(payload.payload?.is_typing ?? false);

          // Auto-clear after 3s in case stop event is missed
          if (payload.payload?.is_typing) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
          }
        }
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [conversationId, userId]);

  // Broadcast typing state to the other user
  const handleTyping = useCallback((typing: boolean) => {
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: userId, is_typing: typing },
    });
  }, [userId]);

  // Retry handler for errors
  const handleRetry = () => {
    setError(null);
    setLoading(true);
    // Trigger a re-fetch by changing the effect dependency
    window.location.reload();
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="chat-container flex flex-col h-full w-full overflow-hidden">
      {/* Header */}
      <div className="backdrop-blur-sm border-b px-3 md:px-6 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-10 bg-card/80 border-border/50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary md:hidden hover:bg-accent/60 text-foreground"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Avatar + name — links to profile */}
          <Link
            href={otherUser?.username ? `/profile/${encodeURIComponent(otherUser.username)}` : '#'}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/60 flex items-center justify-center text-primary-foreground font-semibold">
                {(() => {
                  const src = getProxiedImageUrl(otherUser?.avatar_url ?? null);
                  return src ? (
                    <Image
                      src={src}
                      alt={otherUser?.username || 'Avatar'}
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  ) : (
                    <span>{(otherUser?.full_name || otherUser?.username || 'C').charAt(0).toUpperCase()}</span>
                  );
                })()}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold leading-5 text-foreground">
                  {otherUser?.full_name || otherUser?.username || 'Loading...'}
                </span>
                {otherUser?.is_verified && (
                  <VerifyBadge />
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {isTyping ? (
                  <span className="text-primary">typing...</span>
                ) : (
                  otherUser?.username ? `@${otherUser.username}` : 'Online'
                )}
              </div>
            </div>
          </Link>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {selectMode ? (
            <>
              <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-accent/60 text-muted-foreground hover:text-foreground"
              >
                Select All
              </button>
              <button
                onClick={exitSelectMode}
                className="p-2.5 rounded-full transition-colors hover:bg-accent/60 text-muted-foreground hover:text-foreground"
                aria-label="Cancel selection"
              >
                <X className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <button
                className="p-2.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary hover:bg-accent/60 text-muted-foreground hover:text-foreground"
                aria-label="Search in conversation"
              >
                <Search className="h-5 w-5" />
              </button>
              <button
                className="p-2.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary hover:bg-accent/60 text-muted-foreground hover:text-foreground"
                aria-label="Voice call"
              >
                <Phone className="h-5 w-5" />
              </button>
              <div className="relative" ref={headerMenuRef}>
                <button
                  onClick={() => setShowHeaderMenu(prev => !prev)}
                  className="p-2.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary hover:bg-accent/60 text-muted-foreground hover:text-foreground"
                  aria-label="More options"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>

                {/* Dropdown Menu */}
                {showHeaderMenu && (
                  <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border bg-popover border-border/50 shadow-lg z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2" style={{ boxShadow: 'var(--shadow-elevation-high)' }}>
                    <div className="py-1.5">
                      <button
                        onClick={() => {
                          setSelectMode(true);
                          setShowHeaderMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-left flex items-center gap-3 text-sm font-medium transition-colors hover:bg-accent/50 text-popover-foreground"
                      >
                        <CheckSquare className="h-4 w-4 opacity-70" />
                        <span>Select Messages</span>
                      </button>
                      <button
                        onClick={handleClearChat}
                        disabled={actionLoading === 'clear'}
                        className="w-full px-4 py-2.5 text-left flex items-center gap-3 text-sm font-medium transition-colors hover:bg-accent/50 text-popover-foreground disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4 opacity-70" />
                        <span>{actionLoading === 'clear' ? 'Clearing...' : 'Clear Chat'}</span>
                      </button>
                      <div className="h-px my-1" style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--border)), transparent)' }} />
                      {isBlocked ? (
                        <button
                          onClick={handleUnblockUser}
                          disabled={actionLoading === 'unblock'}
                          className="w-full px-4 py-2.5 text-left flex items-center gap-3 text-sm font-medium transition-colors hover:bg-accent/50 text-popover-foreground disabled:opacity-50"
                        >
                          <Ban className="h-4 w-4 opacity-70" />
                          <span>{actionLoading === 'unblock' ? 'Unblocking...' : 'Unblock User'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={handleBlockUser}
                          disabled={actionLoading === 'block'}
                          className="w-full px-4 py-2.5 text-left flex items-center gap-3 text-sm font-medium transition-colors hover:bg-destructive/10 text-destructive disabled:opacity-50"
                        >
                          <Ban className="h-4 w-4 opacity-70" />
                          <span>{actionLoading === 'block' ? 'Blocking...' : 'Block User'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 flex flex-col min-h-0 w-full">
        {loading ? (
          <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4">
            <MessageSkeleton count={6} />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                Failed to load messages
              </h3>
              <p className="text-sm mb-4 text-muted-foreground">
                {error}
              </p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors shadow-sm hover:shadow-md"
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 w-full message-scroll"
            aria-live="polite"
            aria-relevant="additions"
            role="log"
          >
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-sm mx-auto p-6 rounded-2xl border bg-card/50 backdrop-blur-sm border-border/50">
                  <div className="text-4xl mb-3">💬</div>
                  <h2 className="font-semibold mb-2 text-foreground">
                    No messages yet
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Send a message to start the conversation
                  </p>
                </div>
              </div>
            ) : (
              Object.entries(groupedMessages).map(([date, msgs]) => (
                <React.Fragment key={date}>
                  {/* Date Separator — Instagram style */}
                  <div className="flex justify-center my-4">
                    <span className="text-xs text-muted-foreground/60 font-normal">
                      {formatDate(date)}
                    </span>
                  </div>

                  {/* Messages */}
                  {msgs.map((message, index) => {
                    const isOwn = message.sender_id === userId;
                    const parentMessage = message.reply_to_id
                      ? messages.find((m: Message) => m.id === message.reply_to_id)
                      : null;
                    const groupedReactions = getGroupedReactions(message.id);
                    const myReaction = getMyReaction(message.id);

                    const prevMessage = index > 0 ? msgs[index - 1] : null;
                    const shouldGroup = Boolean(prevMessage &&
                      prevMessage.sender_id === message.sender_id &&
                      new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() < 300000);

                    const isLastInGroup = !msgs[index + 1] ||
                      msgs[index + 1].sender_id !== message.sender_id ||
                      new Date(msgs[index + 1].created_at).getTime() - new Date(message.created_at).getTime() > 300000;

                    const showTime = shouldShowTimestamp(message, prevMessage);
                    const isVeryLast = index === msgs.length - 1 && date === Object.keys(groupedMessages).slice(-1)[0];

                    return (
                      <React.Fragment key={message.id}>
                        {/* Centered timestamp between messages — Instagram style */}
                        {showTime && index > 0 && (
                          <div className="flex justify-center my-3">
                            <span className="text-[11px] text-muted-foreground/60 font-normal">
                              {formatTime(message.created_at)}
                            </span>
                          </div>
                        )}

                        <MessageBubble
                          message={message}
                          isOwn={isOwn}
                          isGrouped={shouldGroup && !showTime}
                          parentMessage={parentMessage}
                          senderAvatar={otherUser?.avatar_url || undefined}
                          senderName={otherUser?.full_name || otherUser?.username || undefined}
                          reactions={groupedReactions}
                          myReaction={myReaction}
                          isLastInGroup={isLastInGroup}
                          onReact={handleReact}
                          onRemoveReaction={handleRemoveReaction}
                          onReply={handleReply}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          userId={userId!}
                          isDeleting={deletingMessages.has(message.id)}
                          selectMode={selectMode}
                          isSelected={selectedMessages.has(message.id)}
                          onToggleSelect={handleToggleSelect}
                        />

                        {/* Seen indicator below last own message — Instagram style */}
                        {isVeryLast && isOwn && (
                          <div className="flex justify-end mt-0.5 pr-2">
                            <span className="text-[11px] text-muted-foreground/50">Seen</span>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))
            )}

            {/* Typing Indicator */}
            <TypingIndicator
              isTyping={isTyping}
              senderName={otherUser?.full_name || otherUser?.username || undefined}
              senderAvatar={otherUser?.avatar_url || undefined}
            />

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Selection Toolbar */}
      {selectMode && (
        <div className="flex-shrink-0 backdrop-blur-sm border-t px-4 py-3 flex items-center justify-between bg-card/90 border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground/80">
              {selectedMessages.size} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteSelected}
              disabled={selectedMessages.size === 0 || actionLoading === 'delete-selected'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
              <span>{actionLoading === 'delete-selected' ? 'Deleting...' : 'Delete'}</span>
            </button>
            <button
              onClick={exitSelectMode}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-muted/60 text-foreground/70 hover:bg-muted transition-colors"
            >
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* Chat Input or Blocked Banner */}
      {!selectMode && (
        isBlocked || isBlockedByOther ? (
          <div className="flex-shrink-0 border-t px-4 py-4 bg-background border-border/30">
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Ban className="h-4 w-4" />
                <span className="text-sm">
                  {isBlocked && isBlockedByOther
                    ? `You and ${otherUser?.full_name || otherUser?.username || 'this user'} have blocked each other`
                    : isBlocked
                      ? `You blocked ${otherUser?.full_name || otherUser?.username || 'this user'}`
                      : `${otherUser?.full_name || otherUser?.username || 'This user'} has blocked you`
                  }
                </span>
              </div>
              {isBlocked && (
                <button
                  onClick={handleUnblockUser}
                  disabled={actionLoading === 'unblock'}
                  className="px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'unblock' ? 'Unblocking...' : 'Unblock'}
                </button>
              )}
              {!isBlocked && isBlockedByOther && (
                <span className="text-xs text-muted-foreground/60">You can&apos;t reply to this conversation</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-shrink-0 border-t px-3 py-2 md:px-4 min-w-0 bg-background border-border/30">
            <ChatInput
              conversationId={String(conversationId)}
              userId={userId!}
              onSent={(msg) => {
                setMessages(msgs => {
                  if (msgs.some(m => m.id === msg.id)) return msgs;
                  return [...msgs, msg];
                });
                scrollToBottom();
              }}
              replyingTo={replyingTo}
              onClearReply={handleClearReply}
              onTyping={handleTyping}
            />
          </div>
        )
      )}

      {/* Custom Modal — replaces native alert/confirm */}
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-[90%] max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-semibold text-foreground mb-1.5">{modal.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">{modal.message}</p>
            <div className="flex items-center justify-end gap-2">
              {modal.type === 'confirm' && (
                <button
                  onClick={() => setModal(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-foreground/70 hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => {
                  modal.onConfirm?.();
                  setModal(null);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  modal.destructive
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {modal.confirmLabel || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}