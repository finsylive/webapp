"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Search, Clock, Smile, Heart, ThumbsUp, Laugh, Package } from 'lucide-react';
import { useTheme } from '@/context/theme/ThemeContext';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}

const EMOJI_CATEGORIES = {
  recent: {
    name: 'Recent',
    icon: Clock,
    emojis: ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '💯']
  },
  smileys: {
    name: 'Smileys & People',
    icon: Smile,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
      '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖',
      '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯',
      '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔',
      '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦'
    ]
  },
  hearts: {
    name: 'Hearts',
    icon: Heart,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️'
    ]
  },
  gestures: {
    name: 'Hand Signs',
    icon: ThumbsUp,
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
      '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐', '✋', '🖖', '👏',
      '🙌', '👐', '🤲', '🙏', '✍️', '💅', '🤳', '💪', '👊', '✊'
    ]
  },
  nature: {
    name: 'Animals & Nature',
    icon: Laugh,
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
      '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇'
    ]
  },
  objects: {
    name: 'Objects',
    icon: Package,
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🎣', '🤿', '🎽',
      '🎿', '🛷', '🥌', '🎯', '🪁', '🎱', '🔮', '🪄', '🧿', '🎮'
    ]
  }
};

export default function EmojiPicker({ onEmojiSelect, onClose, className = '' }: EmojiPickerProps) {
  const { isDarkMode } = useTheme();
  const [activeCategory, setActiveCategory] = useState('recent');
  const [searchTerm, setSearchTerm] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>(['👍', '❤️', '😂', '😮', '😢', '🔥']);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Load recent emojis from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentEmojis');
    if (saved) {
      try {
        setRecentEmojis(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse recent emojis:', error);
      }
    }
  }, []);

  // Save emoji to recent
  const saveToRecent = (emoji: string) => {
    setRecentEmojis(prev => {
      const filtered = prev.filter(e => e !== emoji);
      const newRecent = [emoji, ...filtered].slice(0, 20);
      localStorage.setItem('recentEmojis', JSON.stringify(newRecent));
      return newRecent;
    });
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    saveToRecent(emoji);
    onEmojiSelect(emoji);
    onClose();
  };

  // Filter emojis based on search
  const getFilteredEmojis = () => {
    if (!searchTerm) {
      return activeCategory === 'recent' 
        ? recentEmojis 
        : EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES]?.emojis || [];
    }

    // Search through all categories
    const allEmojis = Object.values(EMOJI_CATEGORIES).flatMap(cat => cat.emojis);
    return allEmojis.filter(() => {
      // This is a simple search - in a real app, you might want to search by emoji names/keywords
      return true; // For now, show all emojis when searching
    });
  };

  const filteredEmojis = getFilteredEmojis();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      {/* Emoji Picker */}
      <div className={`absolute bottom-full right-0 mb-2 w-[calc(100vw-2rem)] sm:w-80 max-w-80 h-72 sm:h-96 rounded-xl shadow-2xl border z-50 flex flex-col ${
        isDarkMode
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
      } ${className} animate-in slide-in-from-bottom-2 duration-200`}>
        
        {/* Header */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search emojis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>
          
          {/* Category tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => {
              const IconComponent = category.icon;
              return (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                    activeCategory === key
                      ? 'bg-emerald-500 text-white'
                      : isDarkMode
                        ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                  title={category.name}
                >
                  <IconComponent className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Emoji Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-7 sm:grid-cols-8 gap-0.5">
            {filteredEmojis.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                onClick={() => handleEmojiSelect(emoji)}
                className={`p-1.5 rounded-lg text-xl leading-none hover:scale-110 transition-transform ${
                  isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
          
          {filteredEmojis.length === 0 && (
            <div className={`text-center py-8 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <Smile className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No emojis found</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}