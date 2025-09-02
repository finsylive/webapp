'use client';

import { useState, KeyboardEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, MapPin, User } from 'lucide-react';
import { useTheme } from '@/context/theme/ThemeContext';
import { toProxyUrl } from '@/utils/imageUtils';

type UserProfile = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  tagline: string | null;
  current_city: string | null;
  user_type: string;
  is_verified: boolean;
};

export default function SearchPage() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const searchUsers = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    
    // cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q,
      });

      const response = await fetch(`/api/users/search?${params.toString()}`, { signal: controller.signal });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const { data } = await response.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      const name = (error as { name?: string } | null)?.name;
      if (name !== 'AbortError') {
        console.error('Error searching users:', error);
        setUsers([]);
      }
    } finally {
      // Only clear loading if this controller is the latest one
      if (abortRef.current === controller) {
        setIsLoading(false);
        abortRef.current = null;
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      searchUsers();
    }
  };

  // Live search with debounce
  useEffect(() => {
    const q = searchQuery.trim();
    // If input cleared, reset state and cancel any ongoing request
    if (!q) {
      setUsers([]);
      setIsLoading(false);
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      return;
    }

    const id = setTimeout(() => {
      // Minimum characters to start searching; adjust if needed
      if (q.length >= 2) {
        searchUsers();
      }
    }, 400);

    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  return (
    <DashboardLayout>
      <div className={`flex flex-col flex-1 w-full h-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8`}>
        <div className="max-w-4xl mx-auto w-full">
          <h1 className={`text-2xl font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Search Users</h1>
          
          <div className="flex flex-col space-y-4 mb-8">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name, username, or tagline..."
                  className="pl-10 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <Button onClick={searchUsers} disabled={isLoading || !searchQuery.trim()}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Search
              </Button>
            </div>
            
            
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : users.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={`${isDarkMode ? 'bg-[#181f2a] border-gray-800' : 'bg-white border-gray-200'} relative rounded-xl border hover:shadow-lg transition cursor-pointer`}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/profile/${encodeURIComponent(u.username)}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') router.push(`/profile/${encodeURIComponent(u.username)}`);
                  }}
                >
                  {/* Avatar placed on the right, similar to profile layout */}
                  <div className="absolute right-4 top-4 z-20">
                    <div className={`w-16 h-16 rounded-full overflow-hidden shadow-xl ring-4 ${isDarkMode ? 'ring-[#10141a]' : 'ring-white'} bg-white`}>
                      {u.avatar_url ? (
                        <Image
                          src={toProxyUrl(u.avatar_url, { width: 64, quality: 85 })}
                          alt={u.username}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                          sizes="64px"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                          <User className="h-8 w-8 text-white" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content with padding-right to avoid the avatar */}
                  <div className="px-5 py-5 pr-24">
                    <div className="flex items-start gap-4">
                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`text-lg font-semibold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{u.full_name || u.username}</h3>
                          <Badge
                            variant={u.user_type === 'mentor' ? 'default' : 'outline'}
                            className="ml-auto text-xs"
                          >
                            {u.user_type === 'mentor' ? 'Mentor' : 'User'}
                          </Badge>
                        </div>
                        <p className={`text-sm ${isDarkMode ? 'text-emerald-300' : 'text-emerald-600'}`}>@{u.username}</p>
                        {u.tagline && <p className={`mt-1 text-sm line-clamp-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{u.tagline}</p>}
                        {u.current_city && (
                          <div className={`flex items-center mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <MapPin className="h-3.5 w-3.5 mr-1.5" />
                            <span>{u.current_city}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : searchQuery ? (
            <div className="text-center py-12">
              <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-white">No users found</h3>
              <p className="text-muted-foreground mt-1">
                Try adjusting your search to find what you&apos;re looking for.
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-white">Search for users</h3>
              <p className="text-muted-foreground mt-1">
                Find people by name, username, or tagline.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

