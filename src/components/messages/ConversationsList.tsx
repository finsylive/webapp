"use client";

import React from 'react';
import { useTheme } from '@/context/theme/ThemeContext';
import { Search, Edit, MoreVertical, Pin, Archive, Menu, ArrowLeft, MessageCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { VerifyBadge } from '@/components/ui/VerifyBadge';
import { useConversations } from '@/context/ConversationsContext';

export const ConversationsList = React.memo(function ConversationsList() {
  const { isDarkMode } = useTheme();
  const pathname = usePathname();
  const {
    loading,
    categories,
    activeTab,
    searchQuery,
    setActiveTab,
    setSearchQuery,
    filteredConversations,
  } = useConversations();

  const getProxiedImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    
    // Only proxy S3 URLs that start with "s3://"
    if (url.startsWith('s3://')) {
      const base = 'https://lrgwsbslfqiwoazmitre.supabase.co/functions/v1/get-image?url=';
      return `${base}${encodeURIComponent(url)}`;
    }
    
    // All other URLs (Google, direct HTTPS, etc.) use directly
    return url;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button className="md:hidden p-2 rounded-full transition-colors hover:bg-accent/60 text-muted-foreground hover:text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-foreground">
            Messages
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full transition-colors hover:bg-accent/60 text-muted-foreground hover:text-foreground">
            <Edit className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-full transition-colors hover:bg-accent/60 text-muted-foreground hover:text-foreground">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-border/50 overflow-x-auto">
        {/* All Tab */}
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>

        {/* Category Tabs */}
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveTab(category.id)}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === category.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              {category.color && (
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: category.color }}
                />
              )}
              {category.name}
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative bg-accent/30 rounded-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full border-none outline-none text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto conversations-scroll">
        {loading ? (
          <div className="space-y-3 p-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="w-12 h-12 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
                <div className="h-3 bg-muted rounded w-8"></div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length > 0 ? (
          <div className="space-y-1">
            {filteredConversations.map((conversation) => (
              <Link
                key={conversation.conversation_id}
                href={`/messages/${conversation.conversation_id}`}
                className="flex items-center gap-3 p-4 hover:bg-accent/30 transition-colors cursor-pointer border-l-4 border-transparent hover:border-primary"
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                    {(() => {
                      const src = getProxiedImageUrl(conversation.other_avatar_url ?? null);
                      return src ? (
                        <Image
                          src={src}
                          alt={conversation.other_username || 'Avatar'}
                          width={48}
                          height={48}
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-lg">
                          {(conversation.other_full_name || conversation.other_username || 'U').charAt(0).toUpperCase()}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate text-foreground">
                        {conversation.other_full_name || conversation.other_username || 'Unknown'}
                      </h3>
                      {conversation.other_is_verified && (
                        <VerifyBadge className="ml-1" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(conversation.updated_at)}
                    </span>
                  </div>
                  <p className="text-sm truncate text-muted-foreground">
                    {conversation.last_message || 'No messages yet'}
                  </p>
                </div>

                {/* Unread indicator */}
                {conversation.unread_count > 0 && (
                  <div className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 rounded-full mb-4 flex items-center justify-center bg-accent/30">
              <MessageCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">
              No conversations yet
            </h3>
            <p className="text-sm text-muted-foreground">
              Start a conversation to see it here
            </p>
          </div>
        )}
      </div>
    </div>
  );
});