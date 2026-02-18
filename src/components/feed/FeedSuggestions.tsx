"use client";

import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { UserPlus, BadgeCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { toProxyUrl } from '@/utils/imageUtils';

interface SuggestedUser {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  tagline: string | null;
  is_verified: boolean;
}

interface FeedSuggestionsProps {
  users: SuggestedUser[];
  isLoading: boolean;
  onFollow: (username: string, userId: string) => void;
}

export function FeedSuggestions({ users, isLoading, onFollow }: FeedSuggestionsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, users]);

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = 176; // ~card width + gap
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }, []);

  if (!isLoading && users.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-4 overflow-hidden">
      <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Suggested for you
      </h3>

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex-shrink-0 w-40 animate-pulse">
              <div className="rounded-xl border border-border bg-muted/10 p-3 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-muted/30" />
                <div className="h-3 bg-muted/30 rounded w-20" />
                <div className="h-2 bg-muted/30 rounded w-16" />
                <div className="h-7 bg-muted/30 rounded w-full mt-1" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative">
          {/* Left arrow */}
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background border border-border rounded-full w-8 h-8 flex items-center justify-center shadow-md transition-all duration-200"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Right arrow */}
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background border border-border rounded-full w-8 h-8 flex items-center justify-center shadow-md transition-all duration-200"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
          >
            {users.map(user => (
              <div
                key={user.id}
                className="flex-shrink-0 w-40 snap-start"
              >
                <div className="rounded-xl border border-border bg-card hover:bg-accent/30 transition-colors p-3 flex flex-col items-center gap-2 h-full">
                  <Link href={`/profile/${user.username}`} className="flex flex-col items-center gap-1.5">
                    {user.avatar_url ? (
                      <img
                        src={toProxyUrl(user.avatar_url, { width: 96, quality: 80 })}
                        alt={user.full_name}
                        className="w-12 h-12 rounded-full object-cover"
                        onError={(e) => {
                          const el = e.target as HTMLImageElement;
                          el.style.display = 'none';
                          if (el.nextElementSibling?.classList.contains('avatar-fallback')) return;
                          const fallback = document.createElement('div');
                          fallback.className = 'avatar-fallback w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg';
                          fallback.textContent = user.full_name?.charAt(0)?.toUpperCase() || '?';
                          el.parentElement?.insertBefore(fallback, el.nextSibling);
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                        {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="text-center min-w-0 w-full">
                      <p className="text-base font-medium text-foreground truncate flex items-center justify-center gap-1">
                        {user.full_name}
                        {user.is_verified && (
                          <BadgeCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        @{user.username}
                      </p>
                      {user.tagline && (
                        <p className="text-xs text-muted-foreground/70 line-clamp-2 leading-tight mt-0.5">
                          {user.tagline}
                        </p>
                      )}
                    </div>
                  </Link>
                  <button
                    onClick={() => onFollow(user.username, user.id)}
                    className="mt-auto w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <UserPlus className="w-3 h-3" />
                    Follow
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
