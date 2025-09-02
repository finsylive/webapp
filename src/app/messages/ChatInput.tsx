"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Paperclip, Smile, X, Image, FileText, Mic, MicOff } from 'lucide-react';
import { useTheme } from '@/context/theme/ThemeContext';

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
  '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿'
];

export default function ChatInput({ 
  conversationId, 
  userId, 
  onSent, 
  replyingTo, 
  onClearReply, 
  onTyping 
}: ChatInputProps) {
  const { isDarkMode } = useTheme();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Fetch recipient ID for this conversation
  useEffect(() => {
    async function fetchRecipient() {
      try {
        const res = await fetch(`/api/conversations/${conversationId}`);
        if (res.ok) {
          const convo = await res.json();
          // Determine the recipient based on who the current user is
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
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to stop typing indicator
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

  // File attachment handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Handle file attachments - placeholder for now
    console.log('Files selected:', files);
    setShowAttachments(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Handle image attachments - placeholder for now
    console.log('Images selected:', files);
    setShowAttachments(false);
  };

  // Insert emoji
  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + emoji + content.slice(end);
      setContent(newContent);
      
      // Move cursor after emoji
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
      // Clear typing indicator
      if (onTyping) onTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      // Send the message
      const messagePayload: any = {
        conversation_id: conversationId,
        sender_id: userId,
        content: content.trim()
      };
      
      // Add reply_to_id if replying to a message
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
        onClearReply?.(); // Clear reply context
        
        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        
        // Send push notification if we have recipient ID
        if (recipientId) {
          try {
            await fetch('/api/push-notification', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json'
              },
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
            // Don't block message send if notification fails
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
      {/* Reply Context */}
      {replyingTo && (
        <div className={`mb-3 mx-3 p-3 rounded-lg border-l-4 transition-all duration-200 ${
          isDarkMode 
            ? 'bg-gray-800/50 border-emerald-500 text-gray-300' 
            : 'bg-gray-100 border-emerald-500 text-gray-700'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-emerald-400 mb-1">Replying to</div>
              <div className="text-sm truncate">{replyingTo.content}</div>
            </div>
            <button
              onClick={onClearReply}
              className={`p-1 rounded-full transition-colors ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Voice Recording Overlay */}
      {isRecording && (
        <div className={`absolute inset-0 z-20 rounded-2xl flex items-center justify-center transition-all duration-300 ${
          isDarkMode ? 'bg-gray-900/95' : 'bg-white/95'
        } backdrop-blur-sm`}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-500 font-medium">{formatRecordingTime(recordingTime)}</span>
            </div>
            <div className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Recording voice message...</div>
            <button
              onClick={stopRecording}
              className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
            >
              <MicOff className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSend} className="relative">
        <div className={`flex items-end gap-2 p-3 rounded-2xl border transition-all duration-200 min-w-0 ${
          isDarkMode 
            ? 'bg-gray-800/60 border-gray-700 focus-within:border-emerald-500 focus-within:bg-gray-800/80' 
            : 'bg-white border-gray-300 focus-within:border-emerald-500 focus-within:shadow-md'
        } backdrop-blur-sm`}>
          {/* Attachment Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAttachments(!showAttachments)}
              className={`p-2 rounded-full transition-all duration-200 ${
                isDarkMode 
                  ? 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-400/10' 
                  : 'text-gray-500 hover:text-emerald-500 hover:bg-emerald-50'
              }`}
            >
              <Paperclip className="h-5 w-5" />
            </button>
            
            {/* Attachment Menu */}
            {showAttachments && (
              <div className={`absolute bottom-full left-0 mb-2 py-2 rounded-xl shadow-xl border min-w-40 max-w-xs z-30 ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200'
              } animate-in fade-in duration-200`}>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className={`w-full px-4 py-2 text-left flex items-center gap-3 transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-gray-700 text-gray-300' 
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <Image className="h-4 w-4 text-blue-500" />
                  <span>Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full px-4 py-2 text-left flex items-center gap-3 transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-gray-700 text-gray-300' 
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <FileText className="h-4 w-4 text-green-500" />
                  <span>Document</span>
                </button>
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="flex-1 relative min-w-0">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              disabled={loading}
              rows={1}
              maxLength={maxCharacters}
              className={`w-full resize-none border-none outline-none bg-transparent placeholder-gray-400 text-sm leading-5 max-h-28 min-w-0 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}
              style={{ minHeight: '20px' }}
            />
            
            {/* Character Count */}
            {isNearLimit && (
              <div className={`absolute -top-6 right-0 text-xs transition-colors ${
                characterCount > maxCharacters ? 'text-red-500' : 'text-gray-400'
              }`}>
                {characterCount}/{maxCharacters}
              </div>
            )}
          </div>

          {/* Emoji Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2 rounded-full transition-all duration-200 ${
                isDarkMode 
                  ? 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-400/10' 
                  : 'text-gray-500 hover:text-emerald-500 hover:bg-emerald-50'
              }`}
            >
              <Smile className="h-5 w-5" />
            </button>
            
            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div className={`absolute bottom-full right-0 mb-2 p-3 rounded-xl shadow-xl border max-h-48 max-w-xs overflow-y-auto z-30 ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200'
              } animate-in fade-in duration-200`}>
                <div className="grid grid-cols-8 gap-1 w-64">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className={`p-2 rounded-lg text-lg transition-all duration-200 hover:scale-110 ${
                        isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Voice/Send Button */}
          {content.trim() ? (
            <button
              type="submit"
              disabled={loading || !content.trim() || characterCount > maxCharacters}
              className="p-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              {loading ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className={`p-2 rounded-full transition-all duration-200 ${
                isDarkMode 
                  ? 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-400/10' 
                  : 'text-gray-500 hover:text-emerald-500 hover:bg-emerald-50'
              }`}
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>
      </form>
      
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept=".pdf,.doc,.docx,.txt,.zip,.rar"
      />
      <input
        ref={imageInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleImageSelect}
        accept="image/*"
      />
      
      {/* Click Outside Handler */}
      {(showEmojiPicker || showAttachments) && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => {
            setShowEmojiPicker(false);
            setShowAttachments(false);
          }}
        />
      )}
    </div>
  );
}