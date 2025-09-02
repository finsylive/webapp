"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';

interface Conversation {
  conversation_id: string;
  other_user_id: string;
  other_username: string;
  other_full_name: string;
  other_avatar_url?: string;
  other_is_verified?: boolean;
  last_message?: string;
  updated_at: string;
  unread_count: number;
  status: string;
  category_ids?: string[]; // Add category IDs array
}

interface Category {
  id: string;
  name: string;
  color?: string;
}

interface ConversationsContextType {
  conversations: Conversation[];
  categories: Category[];
  loading: boolean;
  activeTab: string;
  searchQuery: string;
  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
  refetchConversations: () => Promise<void>;
  filteredConversations: Conversation[];
}

const ConversationsContext = createContext<ConversationsContextType | null>(null);

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [conversationCategories, setConversationCategories] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchConversations = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/conversations?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      } else {
        console.error('Failed to fetch conversations:', response.status);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/chat-categories?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchConversationCategories = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/conversation-categories?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        
        // Transform the data into a map of conversation_id -> [category_ids]
        const mappings: Record<string, string[]> = {};
        data.forEach((item: any) => {
          if (!mappings[item.conversation_id]) {
            mappings[item.conversation_id] = [];
          }
          mappings[item.conversation_id].push(item.category_id);
        });
        
        setConversationCategories(mappings);
      }
    } catch (error) {
      console.error('Error fetching conversation categories:', error);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    const fetchAllData = async () => {
      await Promise.all([
        fetchConversations(),
        fetchCategories(),
        fetchConversationCategories()
      ]);
      setLoading(false);
    };
    
    fetchAllData();
  }, [user?.id]);

  // Filter conversations by search query and active category
  const filteredConversations = conversations.filter(conv => {
    // Search filter
    const matchesSearch = 
      conv.other_full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.other_username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.last_message?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Category filter
    let matchesCategory = true;
    if (activeTab === 'all') {
      matchesCategory = true;
    } else {
      // Check if this conversation belongs to the selected category
      const conversationCategoryIds = conversationCategories[conv.conversation_id] || [];
      matchesCategory = conversationCategoryIds.includes(activeTab);
    }
    
    return matchesSearch && matchesCategory;
  });

  const refetchConversations = async () => {
    setLoading(true);
    await fetchConversations();
  };

  const value: ConversationsContextType = {
    conversations,
    categories,
    loading,
    activeTab,
    searchQuery,
    setActiveTab,
    setSearchQuery,
    refetchConversations,
    filteredConversations,
  };

  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations() {
  const context = useContext(ConversationsContext);
  if (!context) {
    throw new Error('useConversations must be used within a ConversationsProvider');
  }
  return context;
}