'use client';

import React, { useState, useRef, useCallback } from 'react';
import type { Message } from '@/types/messaging';
import { useTypingInput } from '@/hooks/useTyping';
import { cn } from '@/utils/cn';

interface MessageInputProps {
  conversationId: string;
  userId: string;
  username: string;
  onSendMessage: (content: string, replyToId?: string, mediaUrl?: string, messageType?: 'text' | 'image' | 'video' | 'audio' | 'file') => Promise<void>;
  onFileUpload?: (file: File) => Promise<string>; // Returns URL of uploaded file
  pendingReply?: Message;
  onCancelReply?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function MessageInput({
  conversationId,
  userId,
  username,
  onSendMessage,
  onFileUpload,
  pendingReply,
  onCancelReply,
  disabled = false,
  placeholder = "Type a message...",
  className
}: MessageInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    inputValue,
    typingMessage,
    handleInputChange,
    handleSend
  } = useTypingInput(conversationId, userId, username);

  const handleSendClick = useCallback(async () => {
    if (!inputValue.trim() || disabled || isUploading) return;

    const content = inputValue.trim();
    const replyToId = pendingReply?.id;

    try {
      await onSendMessage(content, replyToId);
      handleSend();
      onCancelReply?.();
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [inputValue, disabled, isUploading, onSendMessage, pendingReply, handleSend, onCancelReply]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  }, [handleSendClick]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    handleInputChange(value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }, [handleInputChange]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onFileUpload) return;

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert('File size must be less than 50MB');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress (in real app, you'd track actual upload progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const mediaUrl = await onFileUpload(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      // Determine message type based on file type
      let messageType: 'text' | 'image' | 'video' | 'audio' | 'file' = 'file';
      if (file.type.startsWith('image/')) {
        messageType = 'image';
      } else if (file.type.startsWith('video/')) {
        messageType = 'video';
      } else if (file.type.startsWith('audio/')) {
        messageType = 'audio';
      }

      // Send message with media
      await onSendMessage(
        inputValue.trim() || file.name,
        pendingReply?.id,
        mediaUrl,
        messageType
      );

      handleSend();
      onCancelReply?.();

    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [inputValue, onFileUpload, onSendMessage, pendingReply, handleSend, onCancelReply]);

  const openFileSelector = useCallback((accept?: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept || '*/*';
      fileInputRef.current.click();
    }
  }, []);

  const renderReplyPreview = () => {
    if (!pendingReply) return null;

    return (
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-1 h-10 bg-green-500 rounded-full"></div>
          <div className="flex-1">
            <div className="text-sm font-medium text-green-500">
              Replying to {pendingReply.sender?.username || 'User'}
            </div>
            <div className="text-sm text-gray-400 truncate max-w-xs">
              {pendingReply.message_type === 'image' && '📷 Image'}
              {pendingReply.message_type === 'video' && '🎥 Video'}
              {pendingReply.message_type === 'audio' && '🎵 Audio'}
              {pendingReply.message_type === 'file' && '📎 File'}
              {pendingReply.message_type === 'text' && pendingReply.content}
            </div>
          </div>
        </div>
        <button
          onClick={onCancelReply}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  };

  const renderUploadProgress = () => {
    if (!isUploading) return null;

    return (
      <div className="p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm text-gray-300 mb-1">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTypingIndicator = () => {
    if (!typingMessage) return null;

    return (
      <div className="px-4 py-2 text-sm text-gray-400 bg-gray-900">
        {typingMessage}
      </div>
    );
  };

  return (
    <div className={cn("bg-gray-900 border-t border-gray-700", className)}>
      {renderReplyPreview()}
      {renderUploadProgress()}
      {renderTypingIndicator()}
      
      <div className="p-4">
        <div className="flex items-end gap-3">
          {/* Media attachment button */}
          <div className="relative">
            <button
              onClick={() => openFileSelector()}
              disabled={disabled || isUploading}
              className="p-2 text-gray-400 hover:text-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Attach file"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            
            {/* Media type selector dropdown */}
            <div className="absolute bottom-full left-0 mb-2 bg-gray-800 rounded-lg shadow-lg border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <button
                onClick={() => openFileSelector('image/*')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-t-lg"
              >
                <span>📷</span> Image
              </button>
              <button
                onClick={() => openFileSelector('video/*')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                <span>🎥</span> Video
              </button>
              <button
                onClick={() => openFileSelector('audio/*')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                <span>🎵</span> Audio
              </button>
              <button
                onClick={() => openFileSelector()}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-b-lg"
              >
                <span>📎</span> File
              </button>
            </div>
          </div>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleTextareaChange}
              onKeyPress={handleKeyPress}
              placeholder={disabled ? "Cannot send messages" : placeholder}
              disabled={disabled || isUploading}
              className={cn(
                "w-full resize-none rounded-2xl px-4 py-3 pr-12",
                "bg-gray-800 border border-gray-600 text-white placeholder-gray-400",
                "focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "min-h-[48px] max-h-[120px]"
              )}
              style={{ height: 'auto' }}
              rows={1}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSendClick}
            disabled={!inputValue.trim() || disabled || isUploading}
            className={cn(
              "p-3 rounded-full transition-all duration-200",
              "flex items-center justify-center",
              inputValue.trim() && !disabled && !isUploading ? (
                "bg-green-600 hover:bg-green-500 text-white transform hover:scale-105"
              ) : (
                "bg-gray-700 text-gray-400 cursor-not-allowed"
              )
            )}
            title="Send message"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}