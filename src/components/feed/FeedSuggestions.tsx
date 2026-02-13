"use client";

import Link from 'next/link';
import { UserPlus, BadgeCheck } from 'lucide-react';
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
  if (!isLoading && users.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-4 overflow-hidden">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
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
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
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
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                      {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="text-center min-w-0 w-full">
                    <p className="text-sm font-medium text-foreground truncate flex items-center justify-center gap-1">
                      {user.full_name}
                      {user.is_verified && (
                        <BadgeCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      @{user.username}
                    </p>
                    {user.tagline && (
                      <p className="text-[11px] text-muted-foreground/70 line-clamp-2 leading-tight mt-0.5">
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
      )}
    </div>
  );
}
