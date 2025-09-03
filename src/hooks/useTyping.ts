import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import type { TypingEvent } from '@/types/messaging';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useTyping(conversationId: string, userId: string, username: string) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Refs for cleanup and debouncing
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stopTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to typing events
  useEffect(() => {
    if (!conversationId || !userId) return;

    // Clean up existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`typing:${conversationId}`)
      .on('broadcast', { event: 'typing' }, (payload: { payload: TypingEvent }) => {
        const typingEvent = payload.payload;
        
        if (typingEvent.user_id === userId) {
          // Ignore our own typing events
          return;
        }

        console.log('Typing event received:', typingEvent);

        if (typingEvent.is_typing) {
          // Add user to typing list
          setTypingUsers(prev => {
            if (!prev.includes(typingEvent.username)) {
              return [...prev, typingEvent.username];
            }
            return prev;
          });

          // Auto-remove after 3 seconds if no stop event
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(user => user !== typingEvent.username));
          }, 3000);
        } else {
          // Remove user from typing list
          setTypingUsers(prev => prev.filter(user => user !== typingEvent.username));
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, userId]);

  const stopTyping = useCallback(() => {
    if (!conversationId || !isTyping) return;

    setIsTyping(false);

    // Send typing stop event
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          conversation_id: conversationId,
          user_id: userId,
          username: username,
          is_typing: false
        } as TypingEvent
      });
    }

    // Clear the auto-stop timeout
    if (stopTypingTimeoutRef.current) {
      clearTimeout(stopTypingTimeoutRef.current);
      stopTypingTimeoutRef.current = null;
    }
  }, [conversationId, userId, username, isTyping]);

  const startTyping = useCallback(() => {
    if (!conversationId || isTyping) return;

    setIsTyping(true);

    // Send typing start event
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          conversation_id: conversationId,
          user_id: userId,
          username: username,
          is_typing: true
        } as TypingEvent
      });
    }

    // Auto-stop typing after 2 seconds of inactivity
    if (stopTypingTimeoutRef.current) {
      clearTimeout(stopTypingTimeoutRef.current);
    }

    stopTypingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  }, [conversationId, userId, username, isTyping, stopTyping]);

  const handleTextChange = useCallback((text: string) => {
    if (!text.trim()) {
      stopTyping();
      return;
    }

    // Start typing if not already
    if (!isTyping) {
      startTyping();
    } else {
      // Reset the auto-stop timer
      if (stopTypingTimeoutRef.current) {
        clearTimeout(stopTypingTimeoutRef.current);
      }
      
      stopTypingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 2000);
    }
  }, [isTyping, startTyping, stopTyping]);

  const handleSendMessage = useCallback(() => {
    // Stop typing when message is sent
    stopTyping();
  }, [stopTyping]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    const typingTimeout = typingTimeoutRef.current;
    const stopTypingTimeout = stopTypingTimeoutRef.current;
    
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      if (stopTypingTimeout) {
        clearTimeout(stopTypingTimeout);
      }
    };
  }, []);

  return {
    typingUsers,
    isTyping,
    startTyping,
    stopTyping,
    handleTextChange,
    handleSendMessage
  };
}

// Hook for managing typing indicators in input fields
export function useTypingInput(
  conversationId: string, 
  userId: string, 
  username: string,
  onSendMessage?: () => void
) {
  const { typingUsers, isTyping, handleTextChange, handleSendMessage } = useTyping(
    conversationId, 
    userId, 
    username
  );

  const [inputValue, setInputValue] = useState('');

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    handleTextChange(value);
  }, [handleTextChange]);

  const handleSend = useCallback(() => {
    handleSendMessage();
    setInputValue('');
    onSendMessage?.();
  }, [handleSendMessage, onSendMessage]);

  const formatTypingMessage = useCallback(() => {
    if (typingUsers.length === 0) return '';
    
    if (typingUsers.length === 1) {
      return `${typingUsers[0]} is typing...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    } else {
      return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;
    }
  }, [typingUsers]);

  return {
    inputValue,
    setInputValue,
    typingUsers,
    isTyping,
    typingMessage: formatTypingMessage(),
    handleInputChange,
    handleSend
  };
}