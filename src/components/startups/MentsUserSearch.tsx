"use client";

import { useState, useEffect, useRef } from 'react';
import { Search, X, Check, Copy, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

type MentsUser = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  tagline: string | null;
  is_verified: boolean;
};

type Props = {
  /** Currently linked user (if any) */
  linkedUser: { user_id: string; ments_username: string; avatar_url?: string } | null;
  /** Called when a user is selected */
  onSelect: (user: { user_id: string; ments_username: string; full_name: string; avatar_url: string | null }) => void;
  /** Called when unlinked */
  onUnlink: () => void;
  /** Placeholder for the search input */
  placeholder?: string;
};

export function MentsUserSearch({ linkedUser, onSelect, onUnlink, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MentsUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      setShowInvite(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        const data = (json.data || []) as MentsUser[];
        setResults(data);
        setShowDropdown(true);
        setShowInvite(data.length === 0);
      } catch {
        setResults([]);
        setShowInvite(true);
        toast.error('Search failed. Please try again.');
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setShowInvite(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (user: MentsUser) => {
    onSelect({
      user_id: user.id,
      ments_username: user.username,
      full_name: user.full_name || user.username,
      avatar_url: user.avatar_url,
    });
    setQuery('');
    setShowDropdown(false);
    setShowInvite(false);
  };

  const handleCopyInvite = async () => {
    const inviteText = `Hey! Join me on Ments — a platform for founders, builders and creators. Sign up here: ${window.location.origin}`;
    try {
      await navigator.clipboard.writeText(inviteText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // If already linked, show the linked state
  if (linkedUser) {
    return (
      <div className="flex items-center gap-3 px-3.5 py-2.5 bg-primary/5 border border-primary/15 rounded-xl">
        {linkedUser.avatar_url ? (
          <img src={linkedUser.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
            {linkedUser.ments_username.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-primary">@{linkedUser.ments_username}</span>
          <span className="text-xs text-muted-foreground ml-1.5">on Ments</span>
        </div>
        <button
          type="button"
          onClick={onUnlink}
          className="p-1 rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.length >= 2) setShowDropdown(true); }}
          placeholder={placeholder || "Search Ments profile..."}
          className="w-full pl-9 pr-4 py-2.5 bg-background border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-colors"
        />
        {isSearching && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <span className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin block" />
          </div>
        )}
      </div>

      {/* Results Dropdown */}
      {showDropdown && (results.length > 0 || showInvite) && (
        <div className="absolute z-50 w-full mt-1.5 bg-card border border-border/60 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {results.length > 0 && (
            <div className="p-1">
              {results.slice(0, 6).map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelect(user)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/40 transition-colors text-left"
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {(user.full_name || user.username).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground truncate">
                        {user.full_name || user.username}
                      </span>
                      {user.is_verified && (
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary">
                          <Check className="h-2 w-2 text-primary-foreground" />
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">@{user.username}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No results — invite */}
          {showInvite && (
            <div className="p-3 border-t border-border/30">
              <div className="flex items-center gap-2 mb-2.5">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Not on Ments yet?</span>
              </div>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Invite link copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy invite link
                  </>
                )}
              </button>
              <p className="text-[10px] text-muted-foreground/60 text-center mt-1.5">
                Share the link so they can join and be linked to your startup
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
