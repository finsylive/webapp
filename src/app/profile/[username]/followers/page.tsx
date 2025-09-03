"use client";

import { use, useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toProxyUrl } from '@/utils/imageUtils';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Search, Users, BadgeCheck } from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function FollowersPage({ params }: { params: Promise<{ username?: string }> }) {
  const resolved = use(params);
  const username = (resolved?.username || '').trim();
  const router = useRouter();

  if (!username) notFound();

  type Row = {
    id: string;
    username: string;
    full_name?: string | null;
    avatar_url?: string | null;
    is_verified?: boolean | null;
    is_following?: boolean;
    bio?: string | null;
    followers_count?: number;
  };

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followPending, setFollowPending] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  
  const { user: viewer } = useAuth();
  const viewerId = viewer?.id ?? null;

  // Memoized filtered and sorted list
  const filteredList = useMemo(() => {
    let filtered = rows;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = rows.filter(user => 
        user.username.toLowerCase().includes(query) ||
        (user.full_name?.toLowerCase() || '').includes(query)
      );
    }
    
    return filtered
      .slice()
      .sort((a, b) => {
        // Prioritize verified users
        if (a.is_verified !== b.is_verified) {
          return a.is_verified ? -1 : 1;
        }
        // Then sort by name
        return (a.full_name || a.username).localeCompare(b.full_name || b.username);
      });
  }, [rows, searchQuery]);

  // Enhanced data fetching with retry logic
  const fetchFollowers = useCallback(async (retryAttempt = 0) => {
    try {
      setLoading(true);
      setError(null);
      
      const qs = new URLSearchParams();
      if (viewerId) qs.set('viewerId', viewerId);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const res = await fetch(
        `/api/users/${encodeURIComponent(username)}/followers?${qs.toString()}`,
        { 
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
          }
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('User not found');
        } else if (res.status >= 500 && retryAttempt < 2) {
          // Retry on server errors
          setTimeout(() => fetchFollowers(retryAttempt + 1), 1000 * (retryAttempt + 1));
          return;
        }
        throw new Error(`Failed to load followers (${res.status})`);
      }
      
      const json = await res.json();
      setRows(Array.isArray(json?.data) ? json.data : []);
      setRetryCount(0);
      
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        const msg = e instanceof Error ? e.message : 'Failed to load followers';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [username, viewerId]);

  useEffect(() => {
    fetchFollowers();
  }, [fetchFollowers]);

  // Enhanced follow/unfollow with optimistic updates
  const handleFollowToggle = useCallback(async (user: Row, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!viewerId || followPending[user.id]) return;
    
    const newFollowState = !user.is_following;
    
    // Optimistic update
    setRows(prev => prev.map(row => 
      row.id === user.id ? { ...row, is_following: newFollowState } : row
    ));
    
    setFollowPending(prev => ({ ...prev, [user.id]: true }));
    
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.username)}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId: viewerId, follow: newFollowState }),
      });
      
      if (!res.ok) throw new Error('Failed to update follow');
      
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      // Revert optimistic update on error
      setRows(prev => prev.map(row => 
        row.id === user.id ? { ...row, is_following: !newFollowState } : row
      ));
    } finally {
      setFollowPending(prev => ({ ...prev, [user.id]: false }));
    }
  }, [viewerId]);

  // Retry handler
  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    fetchFollowers();
  }, [fetchFollowers]);

  // Memoized user item component for better performance
  const UserItem = useCallback(({ user }: { user: Row }) => {
    const img = user.avatar_url
      ? toProxyUrl(user.avatar_url, { width: 48, quality: 82 })
      : undefined;
    
    const initials = (user.full_name || user.username)
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    
    const isOwnProfile = viewerId === user.id;
    const isPending = followPending[user.id];

    return (
      <li key={user.id} className="group hover:bg-muted/50 transition-colors">
        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <Link 
              href={`/profile/${encodeURIComponent(user.username)}`} 
              className="flex items-center gap-3 flex-1 min-w-0 group-hover:no-underline"
            >
              <div className="relative flex-shrink-0">
                <Avatar 
                  className="h-12 w-12 ring-2 ring-transparent group-hover:ring-border/50 transition-all" 
                  src={img} 
                  alt={user.username} 
                  fallback={
                    <span className="text-foreground font-semibold text-sm">
                      {initials}
                    </span>
                  } 
                />
                {user.is_verified && (
                  <BadgeCheck className="absolute -bottom-1 -right-1 h-4 w-4 text-blue-500" />
                )}
              </div>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-foreground font-medium truncate group-hover:text-primary transition-colors">
                    {user.full_name || user.username}
                  </div>
                </div>
                <div className="text-muted-foreground text-sm truncate">
                  @{user.username}
                </div>
                {user.bio && (
                  <div className="text-muted-foreground text-xs truncate mt-1">
                    {user.bio}
                  </div>
                )}
                {user.followers_count !== undefined && (
                  <div className="text-muted-foreground text-xs mt-1">
                    {user.followers_count.toLocaleString()} followers
                  </div>
                )}
              </div>
            </Link>
            
            {viewerId && !isOwnProfile && (
              <Button
                onClick={(e) => handleFollowToggle(user, e)}
                size="sm"
                variant={user.is_following ? "secondary" : "default"}
                disabled={isPending}
                className="rounded-full min-w-[80px] transition-all hover:scale-105"
              >
                {isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {user.is_following ? 'Following' : 'Follow'}
              </Button>
            )}
          </div>
        </div>
      </li>
    );
  }, [viewerId, followPending, handleFollowToggle]);

  const title = `Followers`;
  const hasResults = filteredList.length > 0;
  const showSearchResults = searchQuery.trim() && !loading;

  return (
    <DashboardLayout>
      <div className="flex-1 w-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto w-full">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => router.back()} 
              aria-label="Go back"
              className="hover:bg-muted/80"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl sm:text-2xl font-semibold text-white">
                {title}
              </h1>
            </div>
            
            <div className="ml-auto text-sm text-muted-foreground">
              @{username}
            </div>
          </div>

          {/* Search Bar */}
          {!loading && rows.length > 0 && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search followers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50 border-border/50 focus:bg-background"
              />
            </div>
          )}

          {/* Results Count */}
          {!loading && rows.length > 0 && (
            <div className="mb-4 text-sm text-muted-foreground">
              {showSearchResults ? (
                <>
                  {filteredList.length} of {rows.length} followers
                  {searchQuery.trim() && ` matching "${searchQuery}"`}
                </>
              ) : (
                `${rows.length} followers`
              )}
            </div>
          )}

          {/* Body */}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading followers...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
              <div className="text-destructive text-sm mb-3">{error}</div>
              <Button 
                onClick={handleRetry} 
                size="sm" 
                variant="outline"
                className="text-destructive border-destructive/40 hover:bg-destructive/10"
              >
                Try Again
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <div className="text-muted-foreground text-sm mb-2">No followers yet</div>
              <div className="text-muted-foreground/70 text-xs">
                When people follow @{username}, they'll appear here
              </div>
            </div>
          ) : !hasResults && showSearchResults ? (
            <div className="text-center py-12">
              <Search className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <div className="text-muted-foreground text-sm mb-2">
                No followers found matching "{searchQuery}"
              </div>
              <Button 
                onClick={() => setSearchQuery('')} 
                size="sm" 
                variant="ghost"
                className="text-primary hover:text-primary/80"
              >
                Clear search
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card/60 overflow-hidden">
              {filteredList.map((user) => (
                <UserItem key={user.id} user={user} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}