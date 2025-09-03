import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import type { Message, PaginatedMessages, SendMessageRequest } from '@/types/messaging';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useMessages(conversationId: string, userId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);

  // Keep track of the subscription to avoid duplicates
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchMessages = useCallback(async (beforeMessageId?: string) => {
    if (!conversationId) return;

    const isLoadingMore = !!beforeMessageId;
    if (isLoadingMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const params = new URLSearchParams({
        conversationId,
        limit: '20'
      });

      if (beforeMessageId) {
        params.set('beforeMessageId', beforeMessageId);
      }

      const response = await fetch(`/api/messages?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch messages');
      }

      const data: PaginatedMessages = await response.json();

      if (isLoadingMore) {
        // Prepend older messages
        setMessages(prev => [...data.messages, ...prev]);
      } else {
        // Set initial messages
        setMessages(data.messages);
      }

      setHasMore(data.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching messages:', err);
    } finally {
      if (isLoadingMore) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [conversationId]);

  const loadMoreMessages = useCallback(() => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    
    const oldestMessage = messages[0];
    if (oldestMessage) {
      fetchMessages(oldestMessage.id);
    }
  }, [fetchMessages, hasMore, loadingMore, messages]);

  const markAsRead = useCallback(async (messageIds?: string[]) => {
    if (!conversationId) return;

    try {
      const response = await fetch('/api/messages/read', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message_ids: messageIds
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark messages as read');
      }

      // Update local state
      setMessages(prev => prev.map(msg => {
        if (msg.sender_id !== userId && (!messageIds || messageIds.includes(msg.id))) {
          return { ...msg, is_read: true, read_at: new Date().toISOString() };
        }
        return msg;
      }));

      return data;
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  }, [conversationId, userId]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!conversationId) return;

    fetchMessages();

    // Clean up existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Subscribe to new messages in this conversation
    channelRef.current = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          console.log('New message received:', newMessage);

          // Add the new message to the end of the list
          setMessages(prev => [...prev, newMessage]);

          // Auto-mark as read if it's from the other user and user is viewing
          if (newMessage.sender_id !== userId && document.visibilityState === 'visible') {
            markAsRead([newMessage.id]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          console.log('Message updated:', updatedMessage);

          // Update the message in the list
          setMessages(prev => prev.map(msg => 
            msg.id === updatedMessage.id ? updatedMessage : msg
          ));
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, userId, fetchMessages, markAsRead]);

  const sendMessage = useCallback(async (request: Omit<SendMessageRequest, 'conversation_id'>) => {
    if (!conversationId || !request.content.trim()) return;

    setSending(true);
    setError(null);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId, // Assuming this is how auth is handled
        },
        body: JSON.stringify({
          ...request,
          conversation_id: conversationId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // Message will be added via real-time subscription
      return data.message;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      console.error('Error sending message:', err);
      throw err;
    } finally {
      setSending(false);
    }
  }, [conversationId, userId]);

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': userId,
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete message');
      }

      // Remove from local state
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (err) {
      console.error('Error deleting message:', err);
      throw err;
    }
  }, [userId]);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ content: newContent })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to edit message');
      }

      // Update will come via real-time subscription
      return data.message;
    } catch (err) {
      console.error('Error editing message:', err);
      throw err;
    }
  }, [userId]);

  return {
    messages,
    loading,
    loadingMore,
    error,
    hasMore,
    sending,
    refetch: () => fetchMessages(),
    loadMoreMessages,
    sendMessage,
    markAsRead,
    deleteMessage,
    editMessage
  };
}