"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Reply, Copy, Trash2, Edit, Check, CheckCheck } from 'lucide-react';
import { useTheme } from '@/context/theme/ThemeContext';
import Image from 'next/image';
import { VerifyBadge } from '@/components/ui/VerifyBadge';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  reply_to_id?: string;
}

interface GroupedReaction {
  emoji: string;
  count: number;
  users: string[];
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isGrouped: boolean;
  parentMessage?: Message | null;
  senderAvatar?: string;
  senderName?: string;
  senderIsVerified?: boolean;
  reactions: GroupedReaction[];
  myReaction?: string;
  isLastInGroup?: boolean;
  isLastMessage?: boolean;
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string) => void;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  userId: string;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function MessageBubble({
  message,
  isOwn,
  isGrouped,
  parentMessage,
  senderAvatar,
  senderName,
  senderIsVerified,
  reactions,
  myReaction,
  isLastInGroup,
  isLastMessage,
  onReact,
  onRemoveReaction,
  onReply,
  onEdit,
  onDelete,
  userId
}: MessageBubbleProps) {
  const { isDarkMode } = useTheme();
  const [showActions, setShowActions] = useState(false);
  const [showQuickReactions, setShowQuickReactions] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Handle copy message
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setShowActions(false);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  // Handle message actions
  const handleReply = () => {
    onReply?.(message);
    setShowActions(false);
  };

  const handleEdit = () => {
    onEdit?.(message);
    setShowActions(false);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this message?')) {
      onDelete?.(message.id);
    }
    setShowActions(false);
  };

  // Quick reaction handler
  const handleQuickReact = (emoji: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (myReaction === emoji) {
      onRemoveReaction(message.id);
    } else {
      onReact(message.id, emoji);
    }
    setShowQuickReactions(false);
  };

  // Format timestamp
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Get proxied image URL
  function getProxiedImageUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const base = 'https://lrgwsbslfqiwoazmitre.supabase.co/functions/v1/get-image?url=';
    return `${base}${encodeURIComponent(url)}`;
  }

  return (
    <div
      ref={bubbleRef}
      className={`flex items-end group transition-all duration-300 ${
        isOwn ? 'justify-end' : 'justify-start'
      } ${isGrouped ? 'mt-1' : 'mt-4'} ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      } hover:bg-accent/20 rounded-lg px-2 py-1 -mx-2`}
    >
      {/* Avatar for incoming messages (only show for first in group) */}
      {!isOwn && !isGrouped && (
        <div className="mr-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/60 flex items-center justify-center text-primary-foreground text-xs">
            {(() => {
              const src = getProxiedImageUrl(senderAvatar ?? null);
              return src ? (
                <Image 
                  src={src} 
                  alt={senderName || 'Avatar'} 
                  width={32} 
                  height={32} 
                  className="object-cover" 
                />
              ) : (
                <span>{(senderName || 'U').charAt(0).toUpperCase()}</span>
              );
            })()}
          </div>
        </div>
      )}

      {/* Spacer for grouped messages */}
      {!isOwn && isGrouped && <div className="w-8 mr-3 flex-shrink-0" />}

      <div className={`message-bubble relative max-w-[85%] md:max-w-[70%] lg:max-w-[60%] min-w-0 ${
        isOwn ? 'ml-auto' : 'mr-auto'
      }`}>
        {/* Reply context */}
        {parentMessage && (
          <div className="mb-2 pl-3 py-2 rounded-lg text-xs border-l-4 bg-muted/50 border-border text-muted-foreground">
            <div className="font-medium mb-1 opacity-75">
              {parentMessage.sender_id === userId ? 'You' : senderName}
            </div>
            <div className="opacity-90 truncate">{parentMessage.content}</div>
          </div>
        )}

        {/* Message bubble */}
        <div className="relative">
          {/* Quick reactions (show on hover) */}
          <div className={`absolute ${isOwn ? 'right-full mr-2' : 'left-full ml-2'} top-0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1 bg-popover rounded-full px-2 py-1 shadow-lg border border-border z-10 whitespace-nowrap ${isOwn ? 'hidden sm:flex' : 'hidden sm:flex'}`}>
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={(e) => handleQuickReact(emoji, e)}
                className={`p-1 rounded-full hover:scale-125 transition-transform ${
                  myReaction === emoji ? 'bg-primary/20' : 'hover:bg-accent/60'
                }`}
                title={`React with ${emoji}`}
              >
                <span className="text-sm">{emoji}</span>
              </button>
            ))}
            <button
              onClick={() => setShowActions(true)}
              className="p-1 rounded-full hover:bg-accent/60 transition-colors"
              title="More actions"
            >
              <MoreVertical className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>

          {/* Message content */}
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-sm transition-all duration-200 ${
              isOwn
                ? `bg-primary text-primary-foreground ${
                    isLastInGroup ? 'rounded-br-md' : ''
                  } hover:bg-primary/90 hover:shadow-md`
                : `bg-card text-foreground border border-border ${
                    isLastInGroup ? 'rounded-bl-md' : ''
                  } hover:shadow-md`
            }`}
          >
            {/* Sender name (for incoming grouped messages) */}
            {!isOwn && !isGrouped && senderName && (
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs font-medium text-primary">
                  {senderName}
                </span>
                {senderIsVerified && (
                  <VerifyBadge size="sm" />
                )}
              </div>
            )}

            {/* Message text */}
            <div className="message-content text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </div>

            {/* Timestamp and status */}
            <div className={`flex items-center gap-1 mt-2 ${
              isOwn ? 'justify-end' : 'justify-start'
            }`}>
              <span className={`text-xs ${
                isOwn 
                  ? 'text-primary-foreground/80' 
                  : 'text-muted-foreground'
              }`}>
                {formatTime(message.created_at)}
              </span>
              
              {/* Read status for own messages */}
              {isOwn && (
                <div className="flex items-center">
                  {isLastMessage ? (
                    <CheckCheck className="h-3 w-3 text-primary-foreground/80" />
                  ) : (
                    <Check className="h-3 w-3 text-primary-foreground/80" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-2 ${
            isOwn ? 'justify-end' : 'justify-start'
          }`}>
            {reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={() => {
                  if (myReaction === reaction.emoji) {
                    onRemoveReaction(message.id);
                  } else {
                    onReact(message.id, reaction.emoji);
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all duration-200 border ${
                  myReaction === reaction.emoji
                    ? 'bg-primary border-primary text-primary-foreground scale-105'
                    : 'bg-muted border-border text-muted-foreground hover:bg-accent/60'
                } hover:scale-105 active:scale-95`}
                title={`${reaction.count} reaction${reaction.count > 1 ? 's' : ''}`}
              >
                <span>{reaction.emoji}</span>
                <span className="font-medium">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Message Actions Menu */}
      {showActions && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setShowActions(false)}
          />
          <div className={`absolute ${isOwn ? 'right-0' : 'left-12'} top-0 mt-2 py-2 rounded-xl shadow-xl border min-w-40 max-w-xs z-30 bg-popover border-border animate-in fade-in duration-200`}>
            {onReply && (
              <button
                onClick={handleReply}
                className="w-full px-4 py-2 text-left flex items-center gap-3 transition-colors hover:bg-accent/60 text-popover-foreground"
              >
                <Reply className="h-4 w-4" />
                <span>Reply</span>
              </button>
            )}
            <button
              onClick={handleCopy}
              className="w-full px-4 py-2 text-left flex items-center gap-3 transition-colors hover:bg-accent/60 text-popover-foreground"
            >
              <Copy className="h-4 w-4" />
              <span>Copy</span>
            </button>
            {isOwn && onEdit && (
              <button
                onClick={handleEdit}
                className="w-full px-4 py-2 text-left flex items-center gap-3 transition-colors hover:bg-accent/60 text-popover-foreground"
              >
                <Edit className="h-4 w-4" />
                <span>Edit</span>
              </button>
            )}
            {isOwn && onDelete && (
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left flex items-center gap-3 transition-colors hover:bg-destructive/10 text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}