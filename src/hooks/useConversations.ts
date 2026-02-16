import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import type { EnrichedConversation, ConversationFilter } from '@/types/messaging';

export function useConversations(userId: string, filter: ConversationFilter = 'all') {
  const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        userId,
        limit: '20'
      });

      // Apply filters
      if (filter === 'unread') {
        params.set('hasUnread', 'true');
      } else if (filter === 'pending') {
        params.set('status', 'pending');
      } else if (filter !== 'all' && filter !== 'archived') {
        // Assuming it's a category ID
        params.set('categoryId', filter);
      }

      const response = await fetch(`/api/conversations?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch conversations');
      }

      setConversations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, filter]);

  // Real-time subscription for conversation updates
  useEffect(() => {
    if (!userId) return;

    fetchConversations();

    // Subscribe to conversation changes
    const conversationChannel = supabase
      .channel(`conversations:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `or(user1_id.eq.${userId},user2_id.eq.${userId})`
        },
        (payload) => {
          console.log('Conversation changed:', payload);
          // Refetch conversations when they change
          fetchConversations();
        }
      )
      .subscribe();

    // Subscribe to new messages (to update last_message and unread counts)
    const messageChannel = supabase
      .channel(`messages:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          const newMessage = payload.new;
          console.log('New message received:', newMessage);

          // Update the conversation with new last message
          setConversations(prev => prev.map(conv => {
            if (conv.conversation_id === newMessage.conversation_id) {
              const isFromOther = newMessage.sender_id !== userId;
              return {
                ...conv,
                last_message: newMessage.content,
                updated_at: newMessage.created_at,
                unread_count: isFromOther ? conv.unread_count + 1 : conv.unread_count
              };
            }
            return conv;
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [userId, fetchConversations]);

  const createConversation = useCallback(async (otherUserId: string, initialMessage?: string) => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user1_id: userId,
          user2_id: otherUserId,
          initial_message: initialMessage
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create conversation');
      }

      // Refresh conversations list
      await fetchConversations();

      return data.conversation;
    } catch (err) {
      console.error('Error creating conversation:', err);
      throw err;
    }
  }, [userId, fetchConversations]);

  const updateConversationStatus = useCallback(async (conversationId: string, status: 'approved' | 'rejected') => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: conversationId,
          status
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update conversation');
      }

      // Update local state
      setConversations(prev => prev.map(conv => 
        conv.conversation_id === conversationId 
          ? { ...conv, status }
          : conv
      ));

      return data;
    } catch (err) {
      console.error('Error updating conversation:', err);
      throw err;
    }
  }, []);

  const clearUnreadCount = useCallback((conversationId: string) => {
    setConversations(prev => prev.map(conv =>
      conv.conversation_id === conversationId
        ? { ...conv, unread_count: 0 }
        : conv
    ));
  }, []);

  return {
    conversations,
    loading,
    error,
    refetch: fetchConversations,
    createConversation,
    updateConversationStatus,
    clearUnreadCount
  };
}