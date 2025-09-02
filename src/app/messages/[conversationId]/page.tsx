"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ChatInput from '../ChatInput';
import MessageBubble from '@/components/messages/MessageBubble';
import TypingIndicator from '@/components/messages/TypingIndicator';
import MessageSkeleton from '@/components/messages/MessageSkeleton';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeMessages } from '../useRealtimeMessages';
import { useTheme } from '@/context/theme/ThemeContext';
import { ArrowLeft, Phone, Video, MoreVertical, Search, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/utils/supabase';
import { VerifyBadge } from '@/components/ui/VerifyBadge';

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
  const { isDarkMode } = useTheme();
  const userId = user?.id;
  
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<OtherUserProfile | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    const groups: Record<string, Message[]> = {};
    messages.forEach(msg => {
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

  const handleDelete = useCallback(async (messageId: string) => {
    try {
      // Implement delete functionality
      console.log('Delete message:', messageId);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }, []);

  // Handle typing
  const handleTyping = useCallback((typing: boolean) => {
    setIsTyping(typing);
  }, []);

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
            
            {/* Avatar with status */}
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
                  `${messages.length} message${messages.length === 1 ? '' : 's'}`
                )}
              </div>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
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
            <button 
              className="p-2.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary hover:bg-accent/60 text-muted-foreground hover:text-foreground"
              aria-label="More options"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
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
                    {/* Date Separator */}
                    <div className="flex justify-center my-6">
                      <div className="px-4 py-1.5 rounded-full text-xs font-medium shadow-sm bg-card/50 backdrop-blur-sm text-primary border border-primary/20">
                        {formatDate(date)}
                      </div>
                    </div>

                    {/* Messages */}
                    {msgs.map((message, index) => {
                      const isOwn = message.sender_id === userId;
                      const parentMessage = message.reply_to_id
                        ? messages.find((m: Message) => m.id === message.reply_to_id)
                        : null;
                      const groupedReactions = getGroupedReactions(message.id);
                      const myReaction = getMyReaction(message.id);
                      
                      // Check if this message should be grouped with the previous one
                      const prevMessage = index > 0 ? msgs[index - 1] : null;
                      const shouldGroup = prevMessage && 
                        prevMessage.sender_id === message.sender_id &&
                        new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() < 300000; // 5 minutes

                      const isLastInGroup = !msgs[index + 1] || 
                        msgs[index + 1].sender_id !== message.sender_id ||
                        new Date(msgs[index + 1].created_at).getTime() - new Date(message.created_at).getTime() > 300000;

                      const isLastMessage = index === msgs.length - 1 && date === Object.keys(groupedMessages).slice(-1)[0];

                      return (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          isOwn={isOwn}
                          isGrouped={shouldGroup}
                          parentMessage={parentMessage}
                          senderAvatar={otherUser?.avatar_url}
                          senderName={otherUser?.full_name || otherUser?.username}
                          senderIsVerified={otherUser?.is_verified}
                          reactions={groupedReactions}
                          myReaction={myReaction}
                          isLastInGroup={isLastInGroup}
                          isLastMessage={isLastMessage}
                          onReact={handleReact}
                          onRemoveReaction={handleRemoveReaction}
                          onReply={handleReply}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          userId={userId!}
                        />
                      );
                    })}
                  </React.Fragment>
                ))
              )}
              
              {/* Typing Indicator */}
              <TypingIndicator 
                isTyping={isTyping} 
                senderName={otherUser?.full_name || otherUser?.username}
                senderAvatar={otherUser?.avatar_url}
              />
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="flex-shrink-0 backdrop-blur-sm border-t p-3 md:p-4 min-w-0 bg-card/80 border-border/50">
          <ChatInput
            conversationId={String(conversationId)}
            userId={userId!}
            onSent={(msg) => {
              setMessages(msgs => [...msgs, msg]);
              scrollToBottom();
            }}
            replyingTo={replyingTo}
            onClearReply={handleClearReply}
            onTyping={handleTyping}
          />
        </div>
      </div>
  );
}