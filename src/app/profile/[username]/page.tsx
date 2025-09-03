"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import Image from 'next/image';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useMemo, useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Loader2, User, Diamond, Rocket, Building2, BadgeCheck, Pencil } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/theme/ThemeContext';
import { toProxyUrl } from '@/utils/imageUtils';
import { UserActivityFeed } from '@/components/posts/UserActivityFeed';

  type PositionRow = {
    id: string;
    experience_id: string;
    position: string;
    start_date: string | null;
    end_date: string | null;
    description: string | null;
    sort_order: number | null;
  };

  type ExperienceRow = {
    id: string;
    user_id?: string;
    company_name: string;
    domain?: string | null;
    sort_order?: number | null;
    positions: PositionRow[];
  };

  type ProfileData = {
    user: {
      id: string;
      username: string;
      full_name?: string | null;
      avatar_url?: string | null;
      banner_image?: string | null;
      // legacy fallback fields possibly returned by API
      cover_url?: string | null;
      tagline?: string | null;
      current_city?: string | null;
      user_type?: string | null;
      is_verified?: boolean | null;
      about?: string | null;
      // legacy fallback
      bio?: string | null;
    };
    counts: {
      followers: number;
      following: number;
      projects: number;
      portfolios: number;
    };
    experiences: ExperienceRow[];
    viewer: { is_following: boolean };
  } | null;

// Simple in-memory cache
const profileCache = new Map<string, {
  data: ProfileData;
  timestamp: number;
  expiry: number;
}>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Public profile page routed via /profile/[username]
export default function PublicProfilePage() {
  const routeParams = useParams() as { username?: string };
  const username = (routeParams?.username || '').toString().trim();

  if (!username) {
    notFound();
  }

  const { user: viewer, isLoading: authLoading } = useAuth();
  const viewerId = viewer?.id ?? null;
  const abortControllerRef = useRef<AbortController | null>(null);

 

  const [data, setData] = useState<ProfileData>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followPending, setFollowPending] = useState(false);
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<'about' | 'posts' | 'replies'>('about');

  const avatarUrl = useMemo(() => data?.user?.avatar_url || null, [data?.user?.avatar_url]);
  const coverUrl = useMemo(() => data?.user?.banner_image || data?.user?.cover_url || null, [data?.user?.banner_image, data?.user?.cover_url]);

  // Generate cache key
  const getCacheKey = (username: string, viewerId: string | null) => {
    return `${username}-${viewerId || 'anonymous'}`;
  };

  // Check if cache entry is valid
  const isCacheValid = (cacheEntry: any) => {
    return Date.now() < cacheEntry.expiry;
  };

  // Get data from cache
  const getFromCache = (cacheKey: string) => {
    const cacheEntry = profileCache.get(cacheKey);
    if (cacheEntry && isCacheValid(cacheEntry)) {
      return cacheEntry.data;
    }
    return null;
  };

  // Set data in cache
  const setInCache = (cacheKey: string, data: ProfileData) => {
    profileCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + CACHE_DURATION
    });
  };

  // Clear expired cache entries periodically
  const cleanExpiredCache = () => {
    const now = Date.now();
    for (const [key, entry] of profileCache.entries()) {
      if (now >= entry.expiry) {
        profileCache.delete(key);
      }
    }
  };

  useEffect(() => {
    // Cleanup expired cache entries
    cleanExpiredCache();

    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const cacheKey = getCacheKey(username, viewerId);
    const cachedData = getFromCache(cacheKey);

    if (cachedData) {
      // Use cached data
      setData(cachedData);
      setLoading(false);
      setError(null);
      return;
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const qs = new URLSearchParams();
        if (viewerId) qs.set('viewerId', viewerId);
        
        const res = await fetch(
          `/api/users/${encodeURIComponent(username)}/profile?${qs.toString()}`,
          { signal: abortControllerRef.current?.signal }
        );
        
        if (!res.ok) throw new Error('Failed to load profile');
        const json = await res.json();
        const profileData = json?.data ?? null;
        
        // Cache the response
        if (profileData) {
          setInCache(cacheKey, profileData);
        }
        
        setData(profileData);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') {
          // Request was aborted, don't update state
          return;
        }
        const msg = e instanceof Error ? e.message : 'Failed to load profile';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [username, viewerId]);

  const handleToggleFollow = async () => {
    if (!viewerId || !data?.user?.id) return;
    
    // Prevent multiple simultaneous follow requests
    if (followPending) return;
    
    setFollowPending(true);
    
    // Optimistic update
    const wasFollowing = data.viewer?.is_following ?? false;
    const willFollow = !wasFollowing;
    
    setData((prev) => {
      if (!prev) return prev;
      const delta = wasFollowing === willFollow ? 0 : (willFollow ? 1 : -1);
      return {
        ...prev,
        counts: { ...prev.counts, followers: Math.max(0, (prev.counts?.followers ?? 0) + delta) },
        viewer: { ...prev.viewer, is_following: willFollow },
      };
    });

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(data.user.username || username)}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId: viewerId, follow: willFollow }),
      });
      
      if (!res.ok) throw new Error('Failed to update follow');
      
      // Invalidate cache after successful follow/unfollow
      const cacheKey = getCacheKey(username, viewerId);
      profileCache.delete(cacheKey);
      
    } catch (error) {
      // Revert optimistic update on error
      setData((prev) => {
        if (!prev) return prev;
        const delta = wasFollowing === !willFollow ? 0 : (!wasFollowing ? 1 : -1);
        return {
          ...prev,
          counts: { ...prev.counts, followers: Math.max(0, (prev.counts?.followers ?? 0) + delta) },
          viewer: { ...prev.viewer, is_following: wasFollowing },
        };
      });
    } finally {
      setFollowPending(false);
    }
  };

  const fullName = data?.user?.full_name || username;
  const bio = data?.user?.about || data?.user?.bio || '';
  const experiences = useMemo(() => data?.experiences ?? [], [data?.experiences]);

  // --- Utilities: duration formatting for experience badges ---
  const diffInMonths = (start: Date, end: Date) => {
    return Math.max(
      0,
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    );
  };

  const formatDuration = (startISO?: string | null, endISO?: string | null) => {
    if (!startISO) return null;
    const start = new Date(startISO);
    const end = endISO ? new Date(endISO) : new Date();
    const months = diffInMonths(start, end);
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    const parts: string[] = [];
    if (years) parts.push(`${years} yr${years > 1 ? 's' : ''}`);
    if (remMonths || !years) parts.push(`${remMonths} month${remMonths === 1 ? '' : 's'}`);
    return parts.join(' ');
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header group wrapper to position avatar between cards */}
          <div className="relative">
            {/* Poster (cover) area - no surrounding card/border */}
            <div className={`rounded-xl overflow-hidden mb-2`}>
              {/* Cover Image */}
              <div className="relative h-40 w-full">
                {coverUrl ? (
                  <Image
                    src={toProxyUrl(coverUrl, { width: 1200, quality: 85 })}
                    alt="Cover image"
                    fill
                    className="object-cover object-center"
                    priority
                    sizes="(max-width: 768px) 100vw, 1200px"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-r from-purple-400 to-pink-500" />
                )}
              </div>
            </div>

            {/* Avatar placed between the two cards on the right */}
            <div className="absolute right-6 top-28 z-20">
              <div className={`w-24 h-24 rounded-full overflow-hidden shadow-xl ring-4 ${isDarkMode ? 'ring-[#10141a]' : 'ring-white'} bg-white`}>
                {avatarUrl ? (
                  <Image
                    src={toProxyUrl(avatarUrl, { width: 96, quality: 90 })}
                    alt={fullName}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                    sizes="96px"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                    <User className="h-10 w-10 text-white" />
                  </div>
                )}
              </div>
            </div>

            {/* Data card below */}
            <div className={`bg-card/50 border border-border/50 rounded-xl shadow-sm mt-0 mb-8`}>
              <div className="px-6 py-6 pr-32">
                <h1 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {fullName}
                </h1>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${isDarkMode ? 'text-emerald-300' : 'text-emerald-600'}`}>@{data?.user?.username || username}</span>
                  {data?.user?.is_verified && (
                    <BadgeCheck className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'} h-4 w-4`} />
                  )}
                </div>
                {data?.user?.tagline && (
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm mt-1`}>
                    {data.user.tagline}
                  </p>
                )}

                {/* Edit or Follow Button */}
                <div className="mt-4">
                  {authLoading || loading ? (
                    <Button disabled size="sm" className="rounded-full">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading
                    </Button>
                  ) : viewerId && data?.user?.id && viewerId === data.user.id ? (
                    <Link href="/profile/edit">
                      <Button size="sm" className="rounded-full">
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Profile
                      </Button>
                    </Link>
                  ) : viewerId && data?.user?.id ? (
                    <Button onClick={handleToggleFollow} size="sm" disabled={followPending} className="rounded-full">
                      {followPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {data?.viewer?.is_following ? 'Following' : 'Follow'}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Followers / Following - separate card */}
            <div className={`bg-card/50 border border-border/50 rounded-xl shadow-sm mb-8`}>
              <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-800">
                <Link href={`/profile/${encodeURIComponent(username)}/followers`} className="flex flex-col items-center justify-center py-4">
                  <div className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {loading ? '—' : data?.counts?.followers ?? 0}
                  </div>
                  <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>Followers</div>
                </Link>
                <Link href={`/profile/${encodeURIComponent(username)}/following`} className="flex flex-col items-center justify-center py-4">
                  <div className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {loading ? '—' : data?.counts?.following ?? 0}
                  </div>
                  <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>Following</div>
                </Link>
              </div>
            </div>

            {/* Tabs */}
            <div className={`bg-card/50 border border-border/50 rounded-xl shadow-sm mb-8`}>
              <div className="flex border-b border-gray-200 dark:border-gray-800">
                {[{ id: 'about', label: 'About' }, { id: 'posts', label: 'Posts' }, { id: 'replies', label: 'Replies' }].map((tab) => (
                  <button
                    key={tab.id}
                    className={`px-6 py-4 font-medium border-b-2 transition-colors ${activeTab === (tab.id as typeof activeTab)
                      ? 'border-emerald-500 text-emerald-400 bg-transparent'
                      : `${isDarkMode ? 'border-transparent text-gray-400 hover:text-gray-200' : 'border-transparent text-gray-600 hover:text-gray-900'}`}`}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="p-8">
                {activeTab === 'about' && (
                  <div className="space-y-8">
                    {/* Bio Section */}
                    <div>
                      <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4 flex items-center gap-2`}>
                        <User className="h-5 w-5 text-emerald-600" />
                        Bio
                      </h2>
                      {loading ? <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</p> : <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{bio || 'No bio yet.'}</p>}
                    </div>

                    {/* Showcase Section */}
                    <div>
                      <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-6 flex items-center gap-2`}>
                        <Diamond className="h-5 w-5 text-emerald-600" />
                        Showcase
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Portfolio Tile */}
                        <Link
                          href={`/profile/${encodeURIComponent(username)}/portfolios/edit`}
                          className={`group relative overflow-hidden rounded-2xl border-2 ${isDarkMode ? 'border-teal-500/40' : 'border-teal-400'} bg-card/50 p-6 transition-colors`}>
                          {/* Grid background */}
                          <div
                            className="pointer-events-none absolute inset-0 opacity-30"
                            style={{
                              backgroundImage:
                                'linear-gradient(rgba(45,212,191,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.06) 1px, transparent 1px)',
                              backgroundSize: '22px 22px'
                            }}
                          />
                          {/* Neon border glow */}
                          <div className="pointer-events-none absolute -inset-1 rounded-2xl ring-1 ring-teal-400/15 blur-md" />

                          {/* Content */}
                          <div className="relative h-40 sm:h-44">
                            {/* Count top-left */}
                            <div className={`absolute left-4 top-4 text-6xl leading-none font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {loading ? '—' : data?.counts?.portfolios ?? 0}
                            </div>
                            {/* Icon with glow bottom-right */}
                            <div className="absolute right-4 bottom-12 h-12 w-12 rounded-lg bg-teal-400/10 ring-1 ring-teal-400/30 flex items-center justify-center">
                              <div className="absolute inset-0 rounded-lg blur-lg bg-teal-400/20" />
                              <img src="/icons/project.svg" alt="Portfolio" className="relative h-8 w-8" />
                            </div>
                            {/* Label directly below icon */}
                            <h3 className={`absolute right-4 bottom-2 text-2xl font-semibold ${isDarkMode ? 'text-teal-300' : 'text-teal-700'}`}>Portfolio</h3>
                          </div>
                        </Link>

                        {/* Projects Tile */}
                        <Link
                          href={`/profile/${encodeURIComponent(username)}/projects`}
                          className={`group relative overflow-hidden rounded-2xl border-2 ${isDarkMode ? 'border-emerald-500/40' : 'border-emerald-400'} bg-card/50 p-6 transition-colors`}>
                          {/* Grid background */}
                          <div
                            className="pointer-events-none absolute inset-0 opacity-30"
                            style={{
                              backgroundImage:
                                'linear-gradient(rgba(16,185,129,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.06) 1px, transparent 1px)',
                              backgroundSize: '22px 22px'
                            }}
                          />
                          {/* Neon border glow */}
                          <div className="pointer-events-none absolute -inset-1 rounded-2xl ring-1 ring-emerald-400/15 blur-md" />

                          {/* Content */}
                          <div className="relative h-40 sm:h-44">
                            {/* Count top-left */}
                            <div className={`absolute left-4 top-4 text-6xl leading-none font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {loading ? '—' : data?.counts?.projects ?? 0}
                            </div>
                            {/* Icon with glow bottom-right */}
                            <div className="absolute right-4 bottom-12 h-12 w-12 rounded-lg bg-emerald-400/10 ring-1 ring-emerald-400/30 flex items-center justify-center">
                              <div className="absolute inset-0 rounded-lg blur-lg bg-emerald-400/20" />
                              <Rocket className="relative h-8 w-8 text-emerald-400" />
                            </div>
                            {/* Label directly below icon */}
                            <h3 className={`absolute right-4 bottom-2 text-2xl font-semibold ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>Projects</h3>
                          </div>
                        </Link>
                      </div>
                    </div>

                    {/* Experience Section */}
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                          <Building2 className="h-5 w-5 text-emerald-600" />
                          Experience
                        </h2>
                      </div>
                      <div className="space-y-6">
                        {loading ? (
                          <p className="text-gray-500">Loading...</p>
                        ) : experiences.length > 0 ? (
                          experiences.map((exp, index) => {
                            const expPositions = Array.isArray(exp.positions) ? exp.positions : [];
                            const primaryPosition = expPositions.find(p => !p.end_date) ||
                              [...expPositions].sort((a, b) => {
                                const sa = a.start_date ? new Date(a.start_date).getTime() : 0;
                                const sb = b.start_date ? new Date(b.start_date).getTime() : 0;
                                return sb - sa;
                              })[0];

                            const title = primaryPosition?.position || 'Experience';
                            const company = exp.company_name || '';
                            const inferredStartISO = primaryPosition?.start_date || null;
                            const inferredEndISO = primaryPosition?.end_date || null;
                            const isCurrent = !inferredEndISO && !!inferredStartISO;
                            const start = inferredStartISO ? new Date(inferredStartISO) : null;
                            const end = inferredEndISO ? new Date(inferredEndISO) : null;
                            const formatMonthYear = (d: Date | null) => d ? d.toLocaleString(undefined, { month: 'short', year: 'numeric' }) : '—';
                            const duration = formatDuration(inferredStartISO, inferredEndISO);
                            return (
                              <div key={exp.id} className={`flex gap-4 ${isDarkMode ? '' : ''}`}>
                                <div className="flex flex-col items-center">
                                  <div className="p-3 bg-emerald-100 rounded-lg">
                                    <Building2 className="h-5 w-5 text-emerald-600" />
                                  </div>
                                  {index < (experiences.length - 1) && (
                                    <div className={`w-px h-16 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} mt-4`}></div>
                                  )}
                                </div>
                                <div className="flex-1 pb-8">
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                                        {title}
                                        {company && <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>• {company}</span>}
                                      </h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {duration && (
                                        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-900/20 text-emerald-400 border border-emerald-700/30">
                                          {duration}
                                        </div>
                                      )}
                                      {isCurrent && (
                                        <div className="inline-flex items-center px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">Current</div>
                                      )}
                                    </div>
                                  </div>
                                  {(start || end) && (
                                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm mb-2`}>
                                      {formatMonthYear(start)} — {isCurrent && !end ? 'Present' : formatMonthYear(end)}
                                    </p>
                                  )}
                                  {primaryPosition?.description && (
                                    <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                      {primaryPosition.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-gray-500">No experiences added.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'posts' && (
                  <div>
                    {loading || !data?.user?.id ? (
                      <div className="text-center text-sm text-muted-foreground">Loading posts…</div>
                    ) : (
                      <UserActivityFeed userId={data.user.id} type="posts" />
                    )}
                  </div>
                )}

                {activeTab === 'replies' && (
                  <div>
                    {loading || !data?.user?.id ? (
                      <div className="text-center text-sm text-muted-foreground">Loading replies…</div>
                    ) : (
                      <UserActivityFeed userId={data.user.id} type="replies" />
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}