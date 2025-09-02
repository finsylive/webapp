"use client";

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { supabase } from '@/utils/supabase';
import { extractCleanUsername } from '@/utils/username';
import { toProxyUrl } from '@/utils/imageUtils';

type User = {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
};

type MentionDropdownProps = {
  searchTerm: string;
  onSelectUser: (user: User) => void;
  position: { top: number; left: number };
  isVisible: boolean;
};

export function MentionDropdown({ searchTerm, onSelectUser, position, isVisible }: MentionDropdownProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  console.log('[MentionDropdown] Render - isVisible:', isVisible, 'searchTerm:', searchTerm, 'position:', position);

  useEffect(() => {
    if (!isVisible) {
      setUsers([]);
      return;
    }

    const searchUsers = async () => {
      console.log('[MentionDropdown] Searching users with term:', searchTerm);
      setLoading(true);
      try {
        // Show all users if no search term, otherwise filter
        let query = supabase
          .from('users')
          .select('id, username, email, avatar_url');
        
        if (searchTerm) {
          // Case-insensitive search on username and email
          query = query.or(`username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }
        
        const { data, error } = await query
          .limit(8) // Show more suggestions
          .order('username', { ascending: true });

        if (error) throw error;
        console.log('[MentionDropdown] Found users:', data?.length || 0);
        console.log('[MentionDropdown] User data sample:', data?.[0]);
        setUsers(data || []);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Error searching users:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    // Reduce debounce time for faster response
    const debounceTimer = setTimeout(searchUsers, 150);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, users.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && users[selectedIndex]) {
        e.preventDefault();
        onSelectUser(users[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onSelectUser(null as any);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, users, selectedIndex, onSelectUser]);

  if (!isVisible) return null;

  // Use portal to render dropdown at document body level
  if (typeof document === 'undefined') return null;
  
  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-[9999] bg-background dark:bg-gray-900 border border-border dark:border-gray-700 rounded-lg shadow-2xl py-1 max-h-80 overflow-y-auto min-w-[250px] max-w-[350px]"
      style={{ 
        top: `${position.top}px`, 
        left: `${position.left}px`,
        display: isVisible ? 'block' : 'none'
      }}
    >
      {loading ? (
        <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
          <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Searching users...</span>
        </div>
      ) : users.length > 0 ? (
        users.map((user, index) => (
          <button
            key={user.id}
            type="button"
            className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left ${
              index === selectedIndex ? 'bg-primary/10 border-l-2 border-primary' : ''
            }`}
            onClick={() => onSelectUser(user)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
              {user.avatar_url ? (
                <Image
                  src={toProxyUrl(user.avatar_url, { width: 32, quality: 82 })}
                  alt={user.username || user.email}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  sizes="32px"
                  loading="lazy"
                  unoptimized
                />
              ) : (
                <div className="text-sm font-semibold text-muted-foreground">
                  {(user.username || user.email)?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                @{extractCleanUsername(user)}
              </div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>
          </button>
        ))
      ) : (
        <div className="px-4 py-3 text-sm text-muted-foreground">
          {searchTerm ? `No users found matching "${searchTerm}"` : 'Start typing to search users'}
        </div>
      )}
    </div>,
    document.body
  );
}