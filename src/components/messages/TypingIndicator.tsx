"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

interface TypingIndicatorProps {
  isTyping: boolean;
  senderName?: string;
  senderAvatar?: string;
}

export default function TypingIndicator({ isTyping, senderName, senderAvatar }: TypingIndicatorProps) {
  const [dots, setDots] = useState('');

  // Animate typing dots
  useEffect(() => {
    if (!isTyping) return;

    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isTyping]);

  // Get proxied image URL — only proxy s3:// URLs, pass through HTTPS directly
  function getProxiedImageUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('s3://')) {
      const base = 'https://lrgwsbslfqiwoazmitre.supabase.co/functions/v1/get-image?url=';
      return `${base}${encodeURIComponent(url)}`;
    }
    return url;
  }

  if (!isTyping) return null;

  return (
    <div className="flex items-end justify-start mt-4 px-2 py-1 -mx-2 animate-in fade-in duration-300">
      {/* Avatar */}
      <div className="mr-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/60 flex items-center justify-center text-primary-foreground text-xs">
          {(() => {
            const src = getProxiedImageUrl(senderAvatar ?? null);
            return src ? (
              <Image
                src={src}
                alt={senderName || 'Avatar'}
                width={32}
                height={32}
                className="object-cover"
              />
            ) : (
              <span>{(senderName || 'U').charAt(0).toUpperCase()}</span>
            );
          })()}
        </div>
      </div>

      {/* Typing bubble */}
      <div className="max-w-[70%] min-w-0">
        <div className="px-4 py-3 rounded-2xl rounded-bl-md shadow-sm bg-card border border-border">
          {/* Sender name */}
          {senderName && (
            <div className="text-xs font-medium text-primary mb-1">
              {senderName}
            </div>
          )}

          {/* Typing animation */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-current rounded-full typing-dot" />
                <div className="w-2 h-2 bg-current rounded-full typing-dot" />
                <div className="w-2 h-2 bg-current rounded-full typing-dot" />
              </div>
              <span className="text-xs ml-2">typing{dots}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
