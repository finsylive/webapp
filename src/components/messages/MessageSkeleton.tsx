"use client";

import React from 'react';
import { useTheme } from '@/context/theme/ThemeContext';

interface MessageSkeletonProps {
  isOwn?: boolean;
  count?: number;
}

const SingleMessageSkeleton = ({ isOwn = false, index = 0 }: { isOwn: boolean; index?: number }) => {
  const { isDarkMode } = useTheme();
  
  // Predefined widths to avoid hydration mismatch
  const widths = ['75%', '60%', '85%', '45%', '90%', '55%'];
  const secondWidths = ['40%', '30%', '50%', '35%', '45%'];
  const firstWidth = widths[index % widths.length];
  const secondWidth = secondWidths[index % secondWidths.length];
  const showSecondLine = index % 3 !== 0; // Show second line for 2/3 of messages
  const showReactions = index % 4 === 0; // Show reactions for 1/4 of messages

  return (
    <div className={`flex items-end ${isOwn ? 'justify-end' : 'justify-start'} mt-4 px-2 py-1 -mx-2`}>
      {/* Avatar skeleton for incoming messages */}
      {!isOwn && (
        <div className="mr-3 flex-shrink-0">
          <div className={`w-8 h-8 rounded-full animate-pulse ${
            isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
          }`} />
        </div>
      )}

      <div className={`max-w-[70%] space-y-2 min-w-0`}>
        {/* Message bubble skeleton */}
        <div className={`px-4 py-3 rounded-2xl ${
          isOwn ? 'rounded-br-md' : 'rounded-bl-md'
        } ${
          isDarkMode 
            ? 'bg-gray-800 border border-gray-700' 
            : 'bg-gray-100 border border-gray-200'
        }`}>
          {/* Sender name skeleton (for incoming messages) */}
          {!isOwn && (
            <div className={`w-20 h-3 rounded mb-2 animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
            }`} />
          )}
          
          {/* Message content skeleton */}
          <div className="space-y-2">
            <div className={`h-3 rounded animate-pulse ${
              isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
            }`} style={{ width: firstWidth }} />
            {showSecondLine && (
              <div className={`h-3 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
              }`} style={{ width: secondWidth }} />
            )}
          </div>
          
          {/* Timestamp skeleton */}
          <div className={`w-12 h-2 rounded mt-2 animate-pulse ${
            isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
          } ${isOwn ? 'ml-auto' : 'mr-auto'}`} />
        </div>

        {/* Reactions skeleton */}
        {showReactions && (
          <div className={`flex gap-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {Array.from({ length: (index % 2) + 1 }).map((_, i) => (
              <div
                key={i}
                className={`w-8 h-6 rounded-full animate-pulse ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function MessageSkeleton({ isOwn, count = 5 }: MessageSkeletonProps) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, index) => (
        <SingleMessageSkeleton 
          key={index} 
          index={index}
          isOwn={isOwn ?? (index % 3 === 0)} 
        />
      ))}
    </div>
  );
}