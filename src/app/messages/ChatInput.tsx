"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Smile, X, Image as ImageIcon, Mic, MicOff, Heart } from 'lucide-react';

interface ChatInputProps {
  conversationId: string;
  userId: string;
  onSent: (message: Message) => void;
  replyingTo?: Message | null;
  onClearReply?: () => void;
  onTyping?: (isTyping: boolean) => void;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  reply_to_id?: string;
}

const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖',
  '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯',
  '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔',
  '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦',
  '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴',
  '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿',
  '👍', '❤️', '🔥', '💯', '🎉', '👏', '💪', '🙏', '✨', '💀',
  '🤝'
];

export default function ChatInput({
  conversationId,
  userId,
  onSent,
  replyingTo,
  onClearReply,
  onTyping
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [emojiPickerPos, setEmojiPickerPos] = useState<{ bottom: number; right: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  // Fetch recipient ID for this conversation
  useEffect(() => {
    async function fetchRecipient() {
      try {
        const res = await fetch(`/api/conversations/${conversationId}`);
        if (res.ok) {
          const convo = await res.json();
          const recipient = convo.user1_id === userId ? convo.user2_id : convo.user1_id;
          setRecipientId(recipient);
        }
      } catch (error) {
        console.error('Error fetching recipient:', error);
      }
    }
    if (conversationId && userId) {
      fetchRecipient();
    }
  }, [conversationId, userId]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [content]);

  // Handle typing indicator
  const handleTyping = useCallback((value: string) => {
    setContent(value);

    if (onTyping) {
      onTyping(value.length > 0);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 1000);
    }
  }, [onTyping]);

  // Recording functions
  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  };

  // Image select handler
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    console.log('Images selected:', files);
  };

  // Insert emoji
  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + emoji + content.slice(end);
      setContent(newContent);

      setTimeout(() => {
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
        textarea.focus();
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim() || loading) return;

    setLoading(true);

    try {
      if (onTyping) onTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      const messagePayload: {
        conversation_id: string;
        sender_id: string;
        content: string;
        reply_to_id?: string;
        media_url?: string;
      } = {
        conversation_id: conversationId,
        sender_id: userId,
        content: content.trim()
      };

      if (replyingTo) {
        messagePayload.reply_to_id = replyingTo.id;
      }

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messagePayload),
      });
      const data = await res.json();

      if (res.ok) {
        setContent('');
        onSent(data.message);
        onClearReply?.();

        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }

        if (recipientId) {
          try {
            await fetch('/api/push-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                senderId: userId,
                recipientId: recipientId,
                messageContent: content.trim(),
                conversationId: conversationId,
                activeConversations: [],
                type: 'message'
              }),
            });
          } catch (notifError) {
            console.error('Push notification failed:', notifError);
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const characterCount = content.length;
  const maxCharacters = 2000;
  const isNearLimit = characterCount > maxCharacters * 0.8;

  return (
    <div className="relative min-w-0">
      {/* Reply Context — Instagram style */}
      {replyingTo && (
        <div className="mb-2 mx-1 flex items-center gap-2">
          <div className="flex-1 min-w-0 py-2 px-3 rounded-xl bg-muted/40 border-l-2 border-primary/40">
            <div className="text-xs text-muted-foreground/70 mb-0.5">Replying</div>
            <div className="text-sm text-foreground/70 truncate">{replyingTo.content}</div>
          </div>
          <button
            onClick={onClearReply}
            className="p-1 rounded-full transition-colors hover:bg-accent/60 text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="mb-1 flex items-center gap-2 px-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-red-500 font-medium">{formatRecordingTime(recordingTime)}</span>
        </div>
      )}

      <form onSubmit={handleSend} className="relative">
        <div className="flex items-end gap-1 px-3 py-2 rounded-full border transition-all duration-200 min-w-0 bg-transparent border-border/60 focus-within:border-muted-foreground/40">
          {/* Emoji Button — far left */}
          <button
            ref={emojiButtonRef}
            type="button"
            onClick={() => {
              if (!showEmojiPicker && emojiButtonRef.current) {
                const rect = emojiButtonRef.current.getBoundingClientRect();
                setEmojiPickerPos({
                  bottom: window.innerHeight - rect.top + 8,
                  right: Math.max(8, window.innerWidth - rect.right),
                });
              }
              setShowEmojiPicker(!showEmojiPicker);
            }}
            className="p-1.5 rounded-full transition-colors text-muted-foreground hover:text-foreground"
          >
            <Smile className="h-6 w-6" />
          </button>

          {/* Message Input */}
          <div className="flex-1 relative min-w-0">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Message..."
              disabled={loading}
              rows={1}
              maxLength={maxCharacters}
              className="w-full resize-none border-none outline-none bg-transparent text-foreground placeholder:text-muted-foreground/60 text-sm leading-5 max-h-28 min-w-0 py-1"
              style={{ minHeight: '20px' }}
            />

            {/* Character Count */}
            {isNearLimit && (
              <div className={`absolute -top-6 right-0 text-xs transition-colors ${
                characterCount > maxCharacters ? 'text-destructive' : 'text-muted-foreground'
              }`}>
                {characterCount}/{maxCharacters}
              </div>
            )}
          </div>

          {/* Right side: when empty show Mic, Image, Heart; when typing show Send */}
          {content.trim() ? (
            <button
              type="submit"
              disabled={loading || !content.trim() || characterCount > maxCharacters}
              className="p-1.5 rounded-full transition-all text-primary hover:text-primary/80 disabled:opacity-40 font-semibold text-sm"
            >
              {loading ? (
                <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          ) : (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-1.5 rounded-full transition-colors ${isRecording ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="p-1.5 rounded-full transition-colors text-muted-foreground hover:text-foreground"
              >
                <ImageIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTyping('❤️');
                  setTimeout(() => handleSend(), 50);
                }}
                className="p-1.5 rounded-full transition-colors text-muted-foreground hover:text-red-500"
              >
                <Heart className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Hidden Image Input */}
      <input
        ref={imageInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleImageSelect}
        accept="image/*"
      />

      {/* Click Outside Handler */}
      {showEmojiPicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Emoji Picker - fixed position to escape overflow:hidden */}
      {showEmojiPicker && emojiPickerPos && (
        <div
          className="fixed z-50 p-3 rounded-xl shadow-2xl border max-h-72 overflow-y-auto w-[300px] sm:w-[340px] bg-popover border-border animate-in fade-in duration-200"
          style={{ bottom: emojiPickerPos.bottom, right: emojiPickerPos.right }}
        >
          <div className="grid grid-cols-8 sm:grid-cols-9 gap-0.5">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                className="p-1.5 rounded-lg text-xl leading-none transition-all duration-150 hover:scale-110 hover:bg-accent/60"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
