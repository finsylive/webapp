'use client';

import React from 'react';
import { format } from 'date-fns';
import type { Message } from '@/types/messaging';
import { cn } from '@/utils/cn';
import { VerifyBadge } from '@/components/ui/VerifyBadge';

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  showAvatar?: boolean;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onReact?: (messageId: string, reaction: string) => void;
  className?: string;
}

export function MessageBubble({
  message,
  isMe,
  showAvatar = true,
  onReply,
  onEdit,
  onDelete,
  onReact,
  className
}: MessageBubbleProps) {
  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'h:mm a');
  };

  const renderReplyPreview = () => {
    if (!message.reply_to) return null;

    const replyTo = message.reply_to;
    const isReplyFromMe = replyTo.sender_id === message.sender_id;

    return (
      <div className="mb-2 p-2 bg-black/10 rounded-lg border-l-2 border-green-500">
        <div className="flex items-center gap-1 mb-1">
          <svg 
            className="w-3 h-3 text-green-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <span className="text-xs font-medium text-green-500">
            {isReplyFromMe ? 'You' : replyTo.sender?.username || 'User'}
          </span>
          {!isReplyFromMe && replyTo.sender?.is_verified && (
            <VerifyBadge size="sm" />
          )}
        </div>
        <div className="text-xs text-gray-400 line-clamp-2">
          {replyTo.message_type === 'image' && '📷 Image'}
          {replyTo.message_type === 'video' && '🎥 Video'}
          {replyTo.message_type === 'audio' && '🎵 Audio'}
          {replyTo.message_type === 'file' && '📎 File'}
          {replyTo.message_type === 'text' && replyTo.content}
        </div>
      </div>
    );
  };

  const renderMessageContent = () => {
    switch (message.message_type) {
      case 'image':
        return (
          <div className="space-y-2">
            {message.media_url && (
              <div className="relative overflow-hidden rounded-lg max-w-sm">
                <img
                  src={message.media_url}
                  alt="Shared image"
                  className="w-full h-auto object-cover"
                  style={{ maxHeight: '300px' }}
                />
              </div>
            )}
            {message.content && (
              <div className="text-sm">
                {message.content}
              </div>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="space-y-2">
            {message.media_url && (
              <div className="relative overflow-hidden rounded-lg max-w-sm">
                <video
                  src={message.media_url}
                  controls
                  className="w-full h-auto object-cover"
                  style={{ maxHeight: '300px' }}
                />
              </div>
            )}
            {message.content && (
              <div className="text-sm">
                {message.content}
              </div>
            )}
          </div>
        );

      case 'audio':
        return (
          <div className="space-y-2">
            {message.media_url && (
              <audio
                src={message.media_url}
                controls
                className="w-full max-w-sm"
              />
            )}
            {message.content && (
              <div className="text-sm">
                {message.content}
              </div>
            )}
          </div>
        );

      case 'file':
        return (
          <div className="space-y-2">
            {message.media_url && (
              <a
                href={message.media_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-black/10 rounded-lg hover:bg-black/20 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm">
                  {message.content || 'Download File'}
                </span>
              </a>
            )}
          </div>
        );

      default:
        return (
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
        );
    }
  };

  const renderAvatar = () => {
    if (!showAvatar || isMe) return null;

    return (
      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
        {message.sender?.avatar_url ? (
          <img
            src={message.sender.avatar_url}
            alt={message.sender.username}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <span className="text-xs font-medium text-gray-300">
            {message.sender?.username?.charAt(0).toUpperCase() || '?'}
          </span>
        )}
      </div>
    );
  };

  const renderReadStatus = () => {
    if (!isMe) return null;

    return (
      <div className="flex items-center gap-1">
        {message.is_read ? (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    );
  };

  return (
    <div className={cn(
      "flex items-end gap-2 group",
      isMe ? "justify-end" : "justify-start",
      className
    )}>
      {!isMe && renderAvatar()}
      
      <div className={cn(
        "relative max-w-[70%] p-3 rounded-2xl",
        isMe ? (
          "bg-green-600 text-white rounded-br-md"
        ) : (
          "bg-gray-800 text-gray-100 rounded-bl-md"
        )
      )}>
        {/* Message Actions Menu */}
        <div className={cn(
          "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 bg-gray-900 rounded-full px-2 py-1 text-xs",
          isMe ? "-left-20" : "-right-20"
        )}>
          {onReply && (
            <button
              onClick={() => onReply(message)}
              className="p-1 hover:bg-gray-700 rounded-full transition-colors"
              title="Reply"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
          )}
          
          {isMe && onEdit && (
            <button
              onClick={() => onEdit(message)}
              className="p-1 hover:bg-gray-700 rounded-full transition-colors"
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          
          {isMe && onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              className="p-1 hover:bg-red-600 rounded-full transition-colors"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>

        {renderReplyPreview()}
        {renderMessageContent()}
        
        <div className={cn(
          "flex items-center justify-end gap-2 mt-2 text-xs",
          isMe ? "text-green-100" : "text-gray-400"
        )}>
          <span>{formatTime(message.created_at)}</span>
          {renderReadStatus()}
        </div>
      </div>
    </div>
  );
}