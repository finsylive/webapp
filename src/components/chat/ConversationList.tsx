'use client';

import React, { useState, useMemo } from 'react';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import type { EnrichedConversation, ChatCategory, ConversationFilter } from '@/types/messaging';
import { useConversations } from '@/hooks/useConversations';
import { useChatCategories } from '@/hooks/useChatCategories';
import { cn } from '@/utils/cn';
import { VerifyBadge } from '@/components/ui/VerifyBadge';

interface ConversationListProps {
  userId: string;
  selectedConversationId?: string;
  onSelectConversation: (conversation: EnrichedConversation) => void;
  onCreateConversation?: () => void;
  className?: string;
}

export function ConversationList({
  userId,
  selectedConversationId,
  onSelectConversation,
  onCreateConversation,
  className
}: ConversationListProps) {
  const [activeFilter, setActiveFilter] = useState<ConversationFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategories, setShowCategories] = useState(true);

  const { conversations, loading, error } = useConversations(userId, activeFilter);
  const { categories, totalUnreadCount } = useChatCategories(userId);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    
    return conversations.filter(conv => 
      conv.other_username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.other_full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.last_message && conv.last_message.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [conversations, searchQuery]);

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      return format(date, 'h:mm a');
    }
    
    if (isYesterday(date)) {
      return 'Yesterday';
    }
    
    if (differenceInDays(new Date(), date) < 7) {
      return format(date, 'EEEE');
    }
    
    return format(date, 'MM/dd/yy');
  };

  const renderFilterTabs = () => {
    const filters = [
      { key: 'all', label: 'All', count: conversations.length },
      { key: 'unread', label: 'Unread', count: totalUnreadCount },
      { key: 'pending', label: 'Requests', count: conversations.filter(c => c.status === 'pending').length }
    ];

    return (
      <div className="flex items-center gap-1 p-2 bg-gray-800 rounded-lg">
        {filters.map(filter => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key as ConversationFilter)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              "flex items-center gap-2",
              activeFilter === filter.key ? (
                "bg-green-600 text-white"
              ) : (
                "text-gray-400 hover:text-white hover:bg-gray-700"
              )
            )}
          >
            {filter.label}
            {filter.count > 0 && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded-full",
                activeFilter === filter.key ? "bg-green-500" : "bg-gray-600"
              )}>
                {filter.count}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  };

  const renderCategoryFilter = () => {
    if (!showCategories || categories.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-300">Categories</h4>
          <button
            onClick={() => setShowCategories(false)}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-1">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setActiveFilter(category.id)}
              className={cn(
                "w-full flex items-center justify-between p-2 text-sm rounded-lg transition-colors text-left",
                activeFilter === category.id ? (
                  "bg-green-600 text-white"
                ) : (
                  "text-gray-300 hover:bg-gray-800"
                )
              )}
            >
              <div className="flex items-center gap-2">
                {category.color && (
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                )}
                <span>{category.name}</span>
              </div>
              {(category.unread_count || 0) > 0 && (
                <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {category.unread_count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderConversationItem = (conversation: EnrichedConversation) => {
    const isSelected = selectedConversationId === conversation.conversation_id;
    const hasUnread = conversation.unread_count > 0;

    return (
      <div
        key={conversation.conversation_id}
        onClick={() => onSelectConversation(conversation)}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
          "hover:bg-gray-800",
          isSelected ? "bg-green-600/20 border border-green-600/30" : "",
          hasUnread ? "bg-gray-800/50" : ""
        )}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
            {conversation.other_avatar_url ? (
              <img
                src={conversation.other_avatar_url}
                alt={conversation.other_username}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg font-medium text-gray-300">
                {conversation.other_username.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          
          {/* Online status indicator (if available) */}
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900"></div>
        </div>

        {/* Conversation info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h3 className={cn(
                "font-medium truncate",
                hasUnread ? "text-white" : "text-gray-200"
              )}>
                {conversation.other_full_name || conversation.other_username}
              </h3>
              
              {conversation.other_is_verified && (
                <VerifyBadge />
              )}
            </div>
            
            <span className="text-xs text-gray-500 flex-shrink-0">
              {formatTime(conversation.updated_at)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <p className={cn(
              "text-sm truncate mr-2",
              hasUnread ? "text-gray-300 font-medium" : "text-gray-500"
            )}>
              {conversation.status === 'pending' ? (
                <span className="italic">Message request</span>
              ) : (
                conversation.last_message || 'No messages yet'
              )}
            </p>
            
            {hasUnread && (
              <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex-shrink-0">
                {conversation.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={cn("p-6", className)}>
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                <div className="h-3 bg-gray-800 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-6", className)}>
        <div className="text-center text-red-400">
          <p>Error loading conversations</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Messages</h2>
          {onCreateConversation && (
            <button
              onClick={onCreateConversation}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="New conversation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filter tabs */}
        {renderFilterTabs()}
      </div>

      {/* Categories */}
      {renderCategoryFilter() && (
        <div className="p-4 border-b border-gray-700">
          {renderCategoryFilter()}
        </div>
      )}

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            {searchQuery ? (
              <div>
                <p>No conversations found</p>
                <p className="text-sm">Try adjusting your search</p>
              </div>
            ) : activeFilter === 'pending' ? (
              <div>
                <p>No message requests</p>
                <p className="text-sm">New requests will appear here</p>
              </div>
            ) : activeFilter === 'unread' ? (
              <div>
                <p>No unread messages</p>
                <p className="text-sm">You're all caught up!</p>
              </div>
            ) : (
              <div>
                <p>No conversations yet</p>
                <p className="text-sm">Start a new conversation</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredConversations.map(renderConversationItem)}
          </div>
        )}
      </div>
    </div>
  );
}