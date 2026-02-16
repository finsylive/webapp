'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useMessages } from '@/hooks/useMessages';
import { useConversations } from '@/hooks/useConversations';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ConversationList } from './ConversationList';
import { ChatRequestApproval, PendingRequestStatus } from './ChatRequestApproval';
import type { EnrichedConversation, Message } from '@/types/messaging';
import { cn } from '@/utils/cn';

interface ChatPageProps {
  userId: string;
  username: string;
  initialConversationId?: string;
  onFileUpload?: (file: File) => Promise<string>;
  className?: string;
}

export function ChatPage({
  userId,
  username,
  initialConversationId,
  onFileUpload,
  className
}: ChatPageProps) {
  const [selectedConversation, setSelectedConversation] = useState<EnrichedConversation | null>(null);
  const [pendingReply, setPendingReply] = useState<Message | null>(null);
  const [showMobileList, setShowMobileList] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const {
    conversations,
    updateConversationStatus,
    clearUnreadCount
  } = useConversations(userId);

  const {
    messages,
    loading: messagesLoading,
    hasMore,
    loadingMore,
    sendMessage,
    markAsRead,
    deleteMessage,
    // editMessage, // TODO: Add back when edit functionality is implemented
    loadMoreMessages
  } = useMessages(
    selectedConversation?.conversation_id || '',
    userId
  );

  // Auto-select conversation on initial load
  useEffect(() => {
    if (initialConversationId && conversations.length > 0 && !selectedConversation) {
      const conversation = conversations.find(c => c.conversation_id === initialConversationId);
      if (conversation) {
        setSelectedConversation(conversation);
        setShowMobileList(false);
      }
    }
  }, [initialConversationId, conversations, selectedConversation]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && !loadingMore) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loadingMore]);

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (selectedConversation && messages.length > 0) {
      const unreadMessages = messages.filter(m => !m.is_read && m.sender_id !== userId);
      if (unreadMessages.length > 0) {
        markAsRead().then(() => {
          clearUnreadCount(selectedConversation.conversation_id);
        });
      }
    }
  }, [selectedConversation, messages, userId, markAsRead, clearUnreadCount]);

  // Handle infinite scroll for message pagination
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || loadingMore || !hasMore) return;

    if (container.scrollTop === 0) {
      loadMoreMessages();
    }
  }, [loadingMore, hasMore, loadMoreMessages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const handleSelectConversation = useCallback((conversation: EnrichedConversation) => {
    setSelectedConversation(conversation);
    setPendingReply(null);
    setShowMobileList(false);
  }, []);

  const handleSendMessage = useCallback(async (
    content: string, 
    replyToId?: string, 
    mediaUrl?: string, 
    messageType?: 'text' | 'image' | 'video' | 'audio' | 'file'
  ) => {
    if (!selectedConversation) return;

    await sendMessage({
      content,
      reply_to_id: replyToId,
      media_url: mediaUrl,
      message_type: messageType || 'text'
    });
  }, [selectedConversation, sendMessage]);

  const handleReply = useCallback((message: Message) => {
    setPendingReply(message);
  }, []);

  const handleEdit = useCallback((message: Message) => {
    // TODO: Implement edit functionality - for now, this is a placeholder
    // The actual editing would need to prompt for new content or open an edit modal
    console.log('Edit message:', message);
    // Example: editMessage(message.id, newContent) where newContent comes from user input
    // When implemented, this would call: await editMessage(message.id, newContent);
  }, []);

  const handleCancelReply = useCallback(() => {
    setPendingReply(null);
  }, []);

  const handleApproveRequest = useCallback(async (conversationId: string) => {
    await updateConversationStatus(conversationId, 'approved');
  }, [updateConversationStatus]);

  const handleRejectRequest = useCallback(async (conversationId: string) => {
    await updateConversationStatus(conversationId, 'rejected');
    setSelectedConversation(null);
    setShowMobileList(true);
  }, [updateConversationStatus]);

  const canSendMessages = selectedConversation?.status === 'approved' || 
    (selectedConversation?.status === 'pending' && selectedConversation?.other_user_id !== userId);

  const renderHeader = () => {
    if (!selectedConversation) return null;

    return (
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900">
        {/* Mobile back button */}
        <button
          onClick={() => setShowMobileList(true)}
          className="md:hidden p-2 text-gray-400 hover:text-white transition-colors mr-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* User info */}
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
            {selectedConversation.other_avatar_url ? (
              <Image
                src={selectedConversation.other_avatar_url}
                alt={selectedConversation.other_username}
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-medium text-gray-300">
                {selectedConversation.other_username.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-white">
                {selectedConversation.other_full_name || selectedConversation.other_username}
              </h2>
              {selectedConversation.other_is_verified && (
                <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <p className="text-sm text-gray-400">@{selectedConversation.other_username}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Call"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
          
          <button
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Video call"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          
          <button
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="More options"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  const renderMessages = () => {
    if (!selectedConversation) {
      return (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
            <p className="text-sm">Choose a conversation from the list to start messaging</p>
          </div>
        </div>
      );
    }

    if (messagesLoading && messages.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col">
        {/* Chat request approval */}
        <ChatRequestApproval
          conversation={selectedConversation}
          currentUserId={userId}
          onApprove={handleApproveRequest}
          onReject={handleRejectRequest}
        />

        <PendingRequestStatus
          conversation={selectedConversation}
          currentUserId={userId}
        />

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
            </div>
          )}

          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              isMe={message.sender_id === userId}
              showAvatar={index === 0 || messages[index - 1].sender_id !== message.sender_id}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={deleteMessage}
            />
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <MessageInput
          conversationId={selectedConversation.conversation_id}
          userId={userId}
          username={username}
          onSendMessage={handleSendMessage}
          onFileUpload={onFileUpload}
          pendingReply={pendingReply || undefined}
          onCancelReply={handleCancelReply}
          disabled={!canSendMessages}
          placeholder={
            selectedConversation.status === 'pending' && selectedConversation.other_user_id === userId
              ? "Accept the message request to reply"
              : "Type a message..."
          }
        />
      </div>
    );
  };

  return (
    <div className={cn("h-screen bg-gray-900 flex", className)}>
      {/* Conversation list - mobile responsive */}
      <div className={cn(
        "bg-gray-900 border-r border-gray-700 transition-all duration-300",
        "md:w-80 md:flex-shrink-0",
        showMobileList ? "w-full" : "w-0 hidden md:block"
      )}>
        <ConversationList
          userId={userId}
          selectedConversationId={selectedConversation?.conversation_id}
          onSelectConversation={handleSelectConversation}
          className="h-full"
        />
      </div>

      {/* Chat area - mobile responsive */}
      <div className={cn(
        "flex flex-col bg-gray-800 flex-1 transition-all duration-300",
        !showMobileList ? "w-full" : "w-0 hidden md:flex"
      )}>
        {renderHeader()}
        {renderMessages()}
      </div>
    </div>
  );
}