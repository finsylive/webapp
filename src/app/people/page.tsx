'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Users, Search, BadgeCheck, UserPlus, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { toProxyUrl } from '@/utils/imageUtils';

interface SuggestedUser {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  tagline: string | null;
  is_verified: boolean;
}

export default function PeoplePage() {
  const { user } = useAuth();
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<SuggestedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [loadingFollow, setLoadingFollow] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/recommendations?limit=50');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setSuggestedUsers(data.suggestedUsers || []);
        setFilteredUsers(data.suggestedUsers || []);
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(suggestedUsers);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFilteredUsers(
      suggestedUsers.filter(
        u =>
          u.full_name?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q) ||
          u.tagline?.toLowerCase().includes(q)
      )
    );
  }, [searchQuery, suggestedUsers]);

  const handleFollow = useCallback(async (username: string, userId: string) => {
    if (!user || loadingFollow.has(userId)) return;

    setLoadingFollow(prev => new Set(prev).add(userId));
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId: user.id, follow: true }),
      });
      if (res.ok) {
        setFollowingSet(prev => new Set(prev).add(userId));
      }
    } catch {
      // ignore
    } finally {
      setLoadingFollow(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  }, [user, loadingFollow]);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Recommended People</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Discover and connect with people you might know
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-accent/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
          />
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {searchQuery ? 'No people match your search.' : 'No recommendations available yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((person) => (
              <div
                key={person.id}
                className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-5 hover:shadow-md hover:border-border/80 transition-all duration-200"
              >
                <div className="flex flex-col items-center text-center">
                  <Link href={`/profile/${encodeURIComponent(person.username)}`}>
                    {person.avatar_url ? (
                      <Image
                        src={toProxyUrl(person.avatar_url, { width: 80, quality: 80 })}
                        alt={person.full_name || person.username}
                        width={80}
                        height={80}
                        className="w-20 h-20 rounded-full object-cover mb-3"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-medium bg-primary/10 text-primary mb-3">
                        {(person.full_name || person.username || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>

                  <Link href={`/profile/${encodeURIComponent(person.username)}`} className="mb-1">
                    <h3 className="font-semibold text-foreground flex items-center gap-1 justify-center">
                      {person.full_name || person.username}
                      {person.is_verified && <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0" />}
                    </h3>
                  </Link>
                  <p className="text-xs text-muted-foreground mb-1">@{person.username}</p>
                  {person.tagline && (
                    <p className="text-xs text-muted-foreground/80 line-clamp-2 mb-3">
                      {person.tagline}
                    </p>
                  )}

                  {followingSet.has(person.id) ? (
                    <span className="text-xs text-muted-foreground px-4 py-2 rounded-xl border border-border font-medium">
                      Following
                    </span>
                  ) : (
                    <button
                      onClick={() => handleFollow(person.username, person.id)}
                      disabled={loadingFollow.has(person.id)}
                      className="flex items-center justify-center gap-1.5 text-sm bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl transition-colors font-medium disabled:opacity-50"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {loadingFollow.has(person.id) ? '...' : 'Follow'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
