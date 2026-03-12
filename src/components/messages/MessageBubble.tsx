"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MoreVertical, Reply, Copy, Trash2, Edit, Smile, Check } from 'lucide-react';
import Image from 'next/image';

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
  reactions: GroupedReaction[];
  myReaction?: string;
  isLastInGroup?: boolean;
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string) => void;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  userId: string;
  isDeleting?: boolean;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (messageId: string) => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function MessageBubble({
  message,
  isOwn,
  isGrouped,
  parentMessage,
  senderAvatar,
  senderName,
  reactions,
  myReaction,
  isLastInGroup,
  onReact,
  onRemoveReaction,
  onReply,
  onEdit,
  onDelete,
  userId,
  isDeleting,
  selectMode,
  isSelected,
  onToggleSelect
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [actionsPos, setActionsPos] = useState<{ top: number; left: number; right: number; openUp: boolean } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchMoved = useRef(false);

  // Animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Close menus on scroll
  useEffect(() => {
    if (!showActions && !showEmojiPicker) return;
    const onScroll = () => { setShowActions(false); setShowEmojiPicker(false); };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [showActions, showEmojiPicker]);

  // Close menus on Escape key
  useEffect(() => {
    if (!showActions && !showEmojiPicker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowActions(false); setShowEmojiPicker(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showActions, showEmojiPicker]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setShowActions(false);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const handleReply = () => {
    onReply?.(message);
    setShowActions(false);
  };

  const handleEdit = () => {
    onEdit?.(message);
    setShowActions(false);
  };

  const handleDelete = () => {
    onDelete?.(message.id);
    setShowActions(false);
  };

  // Open the more-actions dropdown (viewport-aware)
  const openActions = useCallback(() => {
    if (contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceAbove > 200 || spaceAbove > spaceBelow;
      setActionsPos({
        top: openUp ? rect.top : rect.bottom,
        left: rect.left,
        right: window.innerWidth - rect.right,
        openUp,
      });
    }
    setShowActions(true);
  }, []);

  // Open emoji picker (viewport-aware, positioned near the bubble)
  const openEmojiPicker = useCallback(() => {
    if (contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceAbove > 200 || spaceAbove > spaceBelow;
      setActionsPos({
        top: openUp ? rect.top : rect.bottom,
        left: rect.left,
        right: window.innerWidth - rect.right,
        openUp,
      });
    }
    setShowEmojiPicker(true);
  }, []);

  const handleQuickReact = (emoji: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (myReaction === emoji) {
      onRemoveReaction(message.id);
    } else {
      onReact(message.id, emoji);
    }
    setShowEmojiPicker(false);
    setShowActions(false);
  };

  // Long-press for mobile
  const handleTouchStart = useCallback(() => {
    if (selectMode) return;
    touchMoved.current = false;
    longPressTimerRef.current = setTimeout(() => {
      if (!touchMoved.current) openActions();
    }, 500);
  }, [selectMode, openActions]);

  const handleTouchMove = useCallback(() => {
    touchMoved.current = true;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); };
  }, []);

  function getProxiedImageUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('s3://')) {
      const base = 'https://lrgwsbslfqiwoazmitre.supabase.co/functions/v1/get-image?url=';
      return `${base}${encodeURIComponent(url)}`;
    }
    return url;
  }

  // Inline action icons — the 3 icons that appear next to the bubble on hover (like Instagram)
  const InlineActions = () => (
    <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${isOwn ? 'order-first mr-1.5' : 'order-last ml-1.5'}`}>
      {/* Emoji react */}
      <button
        onClick={(e) => { e.stopPropagation(); openEmojiPicker(); }}
        className="p-1.5 rounded-full hover:bg-accent/60 transition-colors text-muted-foreground/50 hover:text-muted-foreground"
        title="React"
      >
        <Smile className="h-4 w-4" />
      </button>
      {/* Reply */}
      {onReply && (
        <button
          onClick={(e) => { e.stopPropagation(); handleReply(); }}
          className="p-1.5 rounded-full hover:bg-accent/60 transition-colors text-muted-foreground/50 hover:text-muted-foreground"
          title="Reply"
        >
          <Reply className="h-4 w-4" />
        </button>
      )}
      {/* More */}
      <button
        onClick={(e) => { e.stopPropagation(); openActions(); }}
        className="p-1.5 rounded-full hover:bg-accent/60 transition-colors text-muted-foreground/50 hover:text-muted-foreground"
        title="More"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div
      ref={bubbleRef}
      onClick={selectMode ? () => onToggleSelect?.(message.id) : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`flex items-center group ${isOwn ? 'justify-end' : 'justify-start'
        } ${isGrouped ? 'mt-[2px]' : 'mt-2'} ${
          isDeleting ? 'opacity-0 scale-95 max-h-0 mt-0 py-0 overflow-hidden' : isVisible ? 'opacity-100 max-h-[500px]' : 'opacity-0'
        } transition-all duration-300 ease-in-out ${selectMode ? (isSelected ? 'bg-primary/10' : 'hover:bg-accent/10 cursor-pointer') : ''} rounded-lg px-2 py-[1px] -mx-2`}
    >
      {/* Selection checkbox */}
      {selectMode && (
        <div className={`flex-shrink-0 flex items-center self-center ${isOwn ? 'order-last ml-2' : 'mr-2'}`}>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
            isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-primary/60'
          }`}>
            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
          </div>
        </div>
      )}

      {/* Avatar for incoming messages (last in group only — Instagram style) */}
      {!isOwn && isLastInGroup && (
        <div className="mr-1.5 flex-shrink-0 self-end">
          <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center text-muted-foreground text-[10px]">
            {(() => {
              const src = getProxiedImageUrl(senderAvatar ?? null);
              return src ? (
                <Image src={src} alt={senderName || 'Avatar'} width={24} height={24} className="object-cover" />
              ) : (
                <span>{(senderName || 'U').charAt(0).toUpperCase()}</span>
              );
            })()}
          </div>
        </div>
      )}
      {!isOwn && !isLastInGroup && <div className="w-6 mr-1.5 flex-shrink-0" />}

      {/* Inline actions (own messages: actions on left, bubble on right) */}
      {!selectMode && isOwn && <InlineActions />}

      {/* Message bubble + reactions */}
      <div className={`relative max-w-[75%] md:max-w-[65%] lg:max-w-[55%] min-w-0`}>
        {/* Reply context — Instagram style */}
        {parentMessage && (
          <div className={`mb-1 text-xs ${isOwn ? 'text-right' : 'text-left'}`}>
            <div className="text-muted-foreground/70 mb-1">
              {isOwn ? 'You' : senderName} replied to {parentMessage.sender_id === userId ? 'yourself' : isOwn ? (senderName || 'them') : 'you'}
            </div>
            <div className={`inline-block px-3 py-1.5 rounded-xl max-w-full truncate ${
              isOwn ? 'bg-primary/20 text-primary-foreground/60' : 'bg-muted/60 text-muted-foreground'
            }`}>
              {parentMessage.content}
            </div>
          </div>
        )}

        {/* Bubble */}
        <div
          ref={contentRef}
          className={`px-3.5 py-2 rounded-[20px] transition-all duration-200 ${isOwn
            ? `bg-primary text-primary-foreground ${isLastInGroup ? 'rounded-br-md' : ''}`
            : `bg-muted/70 text-foreground ${isLastInGroup ? 'rounded-bl-md' : ''}`
          }`}
        >
          {/* Message text */}
          <div className="text-[14px] leading-[1.35] whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>

        {/* Reaction badges — Instagram style, overlapping bottom edge */}
        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-0.5 -mt-2 relative z-[1] ${isOwn ? 'justify-end pr-2' : 'justify-start pl-2'}`}>
            {reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  if (myReaction === reaction.emoji) onRemoveReaction(message.id);
                  else onReact(message.id, reaction.emoji);
                }}
                className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-xs shadow-sm transition-all duration-150 ${
                  myReaction === reaction.emoji
                    ? 'bg-card border border-primary/40'
                    : 'bg-card border border-border/60'
                } hover:scale-110 active:scale-95`}
              >
                <span className="text-[13px] leading-none">{reaction.emoji}</span>
                {reaction.count > 1 && <span className="text-[9px] font-medium text-muted-foreground">{reaction.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Inline actions (other's messages: bubble on left, actions on right) */}
      {!selectMode && !isOwn && <InlineActions />}

      {/* Emoji Picker Popup — fixed position */}
      {showEmojiPicker && actionsPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
          <div
            className="fixed z-50 rounded-xl shadow-2xl border bg-popover border-border overflow-hidden animate-in fade-in duration-150"
            style={{
              top: actionsPos.openUp ? Math.max(8, actionsPos.top - 8) : actionsPos.top + 4,
              ...(isOwn
                ? { right: Math.min(actionsPos.right, window.innerWidth - 260) }
                : { left: Math.min(actionsPos.left, window.innerWidth - 260) }
              ),
              transform: actionsPos.openUp ? 'translateY(-100%)' : 'none',
            }}
          >
            <div className="flex items-center gap-1 px-2 py-2">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={(e) => handleQuickReact(emoji, e)}
                  className={`p-2 rounded-full hover:scale-125 transition-all duration-150 ${
                    myReaction === emoji ? 'bg-primary/20 scale-110' : 'hover:bg-accent/60'
                  }`}
                >
                  <span className="text-xl leading-none">{emoji}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* More Actions Menu — fixed position */}
      {showActions && actionsPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowActions(false)} />
          <div
            className="fixed z-50 rounded-xl shadow-2xl border min-w-[180px] bg-popover border-border overflow-hidden animate-in fade-in duration-150"
            style={{
              top: actionsPos.openUp ? Math.max(8, actionsPos.top - 8) : actionsPos.top + 4,
              ...(isOwn
                ? { right: Math.min(actionsPos.right, window.innerWidth - 190) }
                : { left: Math.min(actionsPos.left, window.innerWidth - 190) }
              ),
              transform: actionsPos.openUp ? 'translateY(-100%)' : 'none',
            }}
          >
            {/* Quick reactions inside more menu too (for mobile) */}
            <div className="flex items-center justify-center gap-0.5 px-2 py-2 border-b border-border/50">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={(e) => handleQuickReact(emoji, e)}
                  className={`p-1.5 rounded-full hover:scale-125 transition-all duration-150 ${
                    myReaction === emoji ? 'bg-primary/20 scale-110' : 'hover:bg-accent/60'
                  }`}
                >
                  <span className="text-lg leading-none">{emoji}</span>
                </button>
              ))}
            </div>
            <div className="py-1">
              {onReply && (
                <button onClick={handleReply} className="w-full px-4 py-2 text-left flex items-center gap-3 transition-colors hover:bg-accent/50 text-popover-foreground text-sm">
                  <Reply className="h-4 w-4 opacity-50" />
                  <span>Reply</span>
                </button>
              )}
              <button onClick={handleCopy} className="w-full px-4 py-2 text-left flex items-center gap-3 transition-colors hover:bg-accent/50 text-popover-foreground text-sm">
                <Copy className="h-4 w-4 opacity-50" />
                <span>Copy</span>
              </button>
              {isOwn && onEdit && (
                <button onClick={handleEdit} className="w-full px-4 py-2 text-left flex items-center gap-3 transition-colors hover:bg-accent/50 text-popover-foreground text-sm">
                  <Edit className="h-4 w-4 opacity-50" />
                  <span>Edit</span>
                </button>
              )}
              {isOwn && onDelete && (
                <>
                  <div className="h-px my-0.5 mx-3 bg-border/50" />
                  <button onClick={handleDelete} className="w-full px-4 py-2 text-left flex items-center gap-3 transition-colors hover:bg-destructive/10 text-destructive text-sm">
                    <Trash2 className="h-4 w-4 opacity-50" />
                    <span>Delete</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
