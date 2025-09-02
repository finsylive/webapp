"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  reply_to_id?: string;
}

interface VirtualizedMessage extends Message {
  index: number;
  height: number;
  top: number;
}

interface UseVirtualizedMessagesOptions {
  messages: Message[];
  containerHeight: number;
  itemHeight: number; // average item height
  overscan?: number; // number of items to render outside visible area
}

export function useVirtualizedMessages({
  messages,
  containerHeight,
  itemHeight,
  overscan = 5
}: UseVirtualizedMessagesOptions) {
  const [scrollTop, setScrollTop] = useState(0);
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});

  // Calculate virtual items with positions
  const virtualItems = useMemo(() => {
    const items: VirtualizedMessage[] = [];
    let top = 0;

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const height = measuredHeights[message.id] || itemHeight;
      
      items.push({
        ...message,
        index: i,
        height,
        top
      });

      top += height;
    }

    return items;
  }, [messages, measuredHeights, itemHeight]);

  // Calculate total height
  const totalHeight = useMemo(() => {
    return virtualItems.reduce((sum, item) => sum + item.height, 0);
  }, [virtualItems]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const start = Math.max(0, 
      virtualItems.findIndex(item => item.top + item.height >= scrollTop) - overscan
    );
    const end = Math.min(virtualItems.length - 1,
      virtualItems.findIndex(item => item.top > scrollTop + containerHeight) + overscan
    );

    return { start, end: end === -1 ? virtualItems.length - 1 : end };
  }, [virtualItems, scrollTop, containerHeight, overscan]);

  // Get visible items
  const visibleItems = useMemo(() => {
    return virtualItems.slice(visibleRange.start, visibleRange.end + 1);
  }, [virtualItems, visibleRange]);

  // Measure item height
  const measureItem = useCallback((messageId: string, height: number) => {
    setMeasuredHeights(prev => ({
      ...prev,
      [messageId]: height
    }));
  }, []);

  // Handle scroll
  const handleScroll = useCallback((newScrollTop: number) => {
    setScrollTop(newScrollTop);
  }, []);

  // Get offset for first visible item
  const offsetY = visibleItems.length > 0 ? visibleItems[0].top : 0;

  return {
    virtualItems: visibleItems,
    totalHeight,
    offsetY,
    visibleRange,
    measureItem,
    handleScroll,
    scrollTop
  };
}

// Performance optimization hook for message rendering
export function useMessageOptimization(messages: Message[]) {
  // Memoize grouped messages to prevent unnecessary recalculations
  const groupedMessages = useMemo(() => {
    const groups: Record<string, Message[]> = {};
    messages.forEach(msg => {
      const date = new Date(msg.created_at).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  }, [messages]);

  // Memoize message grouping logic
  const messageGroupInfo = useMemo(() => {
    const info: Record<string, { isGrouped: boolean; isLastInGroup: boolean }> = {};
    
    Object.entries(groupedMessages).forEach(([date, msgs]) => {
      msgs.forEach((message, index) => {
        const prevMessage = index > 0 ? msgs[index - 1] : null;
        const nextMessage = index < msgs.length - 1 ? msgs[index + 1] : null;
        
        const shouldGroup = prevMessage && 
          prevMessage.sender_id === message.sender_id &&
          new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() < 300000; // 5 minutes

        const isLastInGroup = !nextMessage || 
          nextMessage.sender_id !== message.sender_id ||
          new Date(nextMessage.created_at).getTime() - new Date(message.created_at).getTime() > 300000;

        info[message.id] = {
          isGrouped: shouldGroup,
          isLastInGroup
        };
      });
    });

    return info;
  }, [groupedMessages]);

  // Debounced scroll handler
  const createDebouncedScroll = useCallback((callback: (scrollTop: number) => void, delay: number = 16) => {
    let timeoutId: NodeJS.Timeout;
    
    return (scrollTop: number) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => callback(scrollTop), delay);
    };
  }, []);

  return {
    groupedMessages,
    messageGroupInfo,
    createDebouncedScroll
  };
}