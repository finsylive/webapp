"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Loader2, User, Diamond, Rocket, Building2, BadgeCheck, Pencil, Plus, MapPin, MessageCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/theme/ThemeContext';
import { UserActivityFeed } from '@/components/posts/UserActivityFeed';
import { toProxyUrl } from '@/utils/imageUtils';

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

type StartupRow = {
  id: string;
  brand_name: string;
  stage: string | null;
  is_actively_raising: boolean | null;
};

type ProfileData = {
  user: {
    id: string;
    username: string;
    full_name?: string | null;
    avatar_url?: string | null;
    banner_image?: string | null;
    cover_url?: string | null;
    tagline?: string | null;
    current_city?: string | null;
    user_type?: string | null;
    is_verified?: boolean | null;
    about?: string | null;
    bio?: string | null;
  };
  counts: {
    followers: number;
    following: number;
    projects: number;
    portfolios: number;
    startups: number;
  };
  experiences: ExperienceRow[];
  startups: StartupRow[];
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
  const router = useRouter();

  const { user: viewer, isLoading: authLoading } = useAuth();
  const viewerId = viewer?.id ?? null;
  const abortControllerRef = useRef<AbortController | null>(null);

  const [data, setData] = useState<ProfileData>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followPending, setFollowPending] = useState(false);
  const [messagePending, setMessagePending] = useState(false);
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<'about' | 'posts' | 'replies'>('about');
  const [imgError, setImgError] = useState<{ avatar?: boolean; cover?: boolean }>({});

  const avatarUrl = useMemo(() => {
    const raw = data?.user?.avatar_url || null;
    return raw ? toProxyUrl(raw, { width: 256, quality: 82 }) : null;
  }, [data?.user?.avatar_url]);
  const coverUrl = useMemo(() => {
    const raw = data?.user?.banner_image || data?.user?.cover_url || null;
    return raw ? toProxyUrl(raw, { width: 1200, quality: 82 }) : null;
  }, [data?.user?.banner_image, data?.user?.cover_url]);

  const getCacheKey = (uname: string, vid: string | null) => {
    return `${uname}-${vid || 'anonymous'}`;
  };

  const isCacheValid = (cacheEntry: { expiry: number }) => {
    return Date.now() < cacheEntry.expiry;
  };

  const getFromCache = useCallback((cacheKey: string) => {
    const cacheEntry = profileCache.get(cacheKey);
    if (cacheEntry && isCacheValid(cacheEntry)) {
      return cacheEntry.data;
    }
    return null;
  }, []);

  const setInCache = (cacheKey: string, cacheData: ProfileData) => {
    profileCache.set(cacheKey, {
      data: cacheData,
      timestamp: Date.now(),
      expiry: Date.now() + CACHE_DURATION
    });
  };

  const cleanExpiredCache = () => {
    const now = Date.now();
    for (const [key, entry] of profileCache.entries()) {
      if (now >= entry.expiry) {
        profileCache.delete(key);
      }
    }
  };

  useEffect(() => {
    if (!username) return;

    cleanExpiredCache();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const cacheKey = getCacheKey(username, viewerId);
    const cachedData = getFromCache(cacheKey);

    if (cachedData) {
      setData(cachedData);
      setLoading(false);
      setError(null);
      return;
    }

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

        if (profileData) {
          setInCache(cacheKey, profileData);
        }

        setData(profileData);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') {
          return;
        }
        const msg = e instanceof Error ? e.message : 'Failed to load profile';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [username, viewerId, getFromCache]);

  const handleToggleFollow = async () => {
    if (!viewerId || !data?.user?.id) return;
    if (followPending) return;

    setFollowPending(true);

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

      const cacheKey = getCacheKey(username, viewerId);
      profileCache.delete(cacheKey);
    } catch {
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

  const handleMessage = async () => {
    if (!viewerId || !data?.user?.id) return;
    setMessagePending(true);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user1_id: viewerId, user2_id: data.user.id }),
      });
      if (!res.ok) throw new Error('Failed to create conversation');
      const json = await res.json();
      const convId = json?.conversation?.id;
      if (convId) {
        router.push(`/messages/${convId}`);
      }
    } catch (e) {
      console.error('Message error:', e);
    } finally {
      setMessagePending(false);
    }
  };

  const fullName = data?.user?.full_name || username;
  const bio = data?.user?.about || data?.user?.bio || '';
  const city = data?.user?.current_city || '';
  const experiences = useMemo(() => data?.experiences ?? [], [data?.experiences]);
  const startups = useMemo(() => data?.startups ?? [], [data?.startups]);
  const isOwnProfile = viewerId && data?.user?.id && viewerId === data.user.id;

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

  if (!username || (loading && !data)) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !data) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <p className="text-red-500">{error}</p>
          <Button onClick={() => window.location.reload()} size="sm">Retry</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">

          {/* Cover image — using <img> to bypass Next.js Image restrictions */}
          <div className="rounded-2xl overflow-hidden">
            <div className="relative h-44 sm:h-52 w-full">
              {coverUrl && !imgError.cover ? (
                 
                <img
                  src={coverUrl}
                  alt="Cover image"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                  onError={() => setImgError(prev => ({ ...prev, cover: true }))}
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-emerald-600 via-teal-500 to-cyan-500" />
              )}
            </div>
          </div>

          {/* Avatar overlapping cover bottom */}
          <div className="relative -mt-14 ml-5 mb-3 z-10">
            <div className={`w-28 h-28 rounded-full overflow-hidden ring-4 ${isDarkMode ? 'ring-[#0f1318]' : 'ring-white'} bg-card shadow-lg`}>
              {avatarUrl && !imgError.avatar ? (
                 
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(prev => ({ ...prev, avatar: true }))}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                  <User className="h-12 w-12 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Profile info card */}
          <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl shadow-sm -mt-2 mb-6">
            <div className="px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                    <span className="truncate">{fullName}</span>
                    {data?.user?.is_verified && (
                      <BadgeCheck className="text-blue-500 h-5 w-5 flex-shrink-0" />
                    )}
                  </h1>
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    @{data?.user?.username || username}
                  </span>
                  {data?.user?.tagline && (
                    <p className={`text-sm mt-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {data.user.tagline}
                    </p>
                  )}
                  {city && (
                    <p className={`text-sm mt-1 flex items-center gap-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      <MapPin className="h-3.5 w-3.5" />
                      {city}
                    </p>
                  )}
                </div>

                {/* Edit / Follow / Message */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {authLoading || loading ? (
                    <Button disabled size="sm" className="rounded-full">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </Button>
                  ) : isOwnProfile ? (
                    <Link href="/profile/edit">
                      <Button size="sm" className="rounded-full">
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </Link>
                  ) : viewerId && data?.user?.id ? (
                    <>
                      <Button onClick={handleToggleFollow} size="sm" disabled={followPending} className="rounded-full">
                        {followPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        {data?.viewer?.is_following ? 'Following' : 'Follow'}
                      </Button>
                      <Button onClick={handleMessage} size="sm" disabled={messagePending} variant="outline" className="rounded-full">
                        {messagePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Follower / Following stats */}
              <div className="flex items-center gap-5 mt-4">
                <Link
                  href={`/profile/${encodeURIComponent(username)}/followers`}
                  className={`text-sm hover:underline ${isDarkMode ? 'hover:text-white' : 'hover:text-gray-900'}`}
                >
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {loading ? '—' : data?.counts?.followers ?? 0}
                  </span>
                  <span className={`ml-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Followers</span>
                </Link>
                <Link
                  href={`/profile/${encodeURIComponent(username)}/following`}
                  className={`text-sm hover:underline ${isDarkMode ? 'hover:text-white' : 'hover:text-gray-900'}`}
                >
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {loading ? '—' : data?.counts?.following ?? 0}
                  </span>
                  <span className={`ml-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Following</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl shadow-sm mb-6">
            <div className={`flex border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              {[
                { id: 'about', label: 'About' },
                { id: 'posts', label: 'Posts' },
                { id: 'replies', label: 'Replies' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === (tab.id as typeof activeTab)
                      ? 'border-emerald-500 text-emerald-500'
                      : `border-transparent ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-900'}`
                  }`}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* ── About Tab ── */}
              {activeTab === 'about' && (
                <div className="space-y-8">

                  {/* Bio */}
                  <div>
                    <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-3 flex items-center gap-2`}>
                      <User className="h-4 w-4 text-emerald-500" />
                      Bio
                    </h2>
                    {loading ? (
                      <p className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>Loading...</p>
                    ) : (
                      <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {bio || 'No bio yet.'}
                      </p>
                    )}
                  </div>

                  {/* Startups Section — timeline style like Experience */}
                  {(startups.length > 0 || isOwnProfile) && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                          <Rocket className="h-4 w-4 text-orange-500" />
                          Startups
                        </h2>
                        {isOwnProfile && (
                          <Link
                            href="/startups/create"
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              isDarkMode
                                ? 'border-orange-500/30 text-orange-300 hover:bg-orange-500/10'
                                : 'border-orange-300 text-orange-700 hover:bg-orange-50'
                            }`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add
                          </Link>
                        )}
                      </div>

                      <div className="space-y-1">
                        {loading ? (
                          <p className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>Loading...</p>
                        ) : startups.length > 0 ? (
                          startups.map((startup, index) => (
                            <Link key={startup.id} href={`/startups/${startup.id}`} className="flex gap-3 group">
                              {/* Timeline */}
                              <div className="flex flex-col items-center pt-1">
                                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
                                  <Rocket className="h-4 w-4 text-orange-500" />
                                </div>
                                {index < (startups.length - 1) && (
                                  <div className={`w-px flex-1 mt-2 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex-1 pb-6">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <h3 className={`text-sm font-semibold group-hover:underline ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                      {startup.brand_name}
                                    </h3>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {startup.stage && (
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        isDarkMode
                                          ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                          : 'bg-orange-50 text-orange-700'
                                      }`}>
                                        {startup.stage}
                                      </span>
                                    )}
                                    {startup.is_actively_raising && (
                                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                                        Raising
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </Link>
                          ))
                        ) : (
                          <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No startups added yet.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Showcase (Portfolio + Projects) */}
                  <div>
                    <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4 flex items-center gap-2`}>
                      <Diamond className="h-4 w-4 text-emerald-500" />
                      Showcase
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Portfolio */}
                      <Link
                        href={isOwnProfile ? `/profile/${encodeURIComponent(username)}/portfolios/edit` : `/profile/${encodeURIComponent(username)}/portfolios`}
                        className={`group relative overflow-hidden rounded-xl border ${
                          isDarkMode ? 'border-teal-500/30 hover:border-teal-500/50' : 'border-teal-300 hover:border-teal-400'
                        } bg-card/50 p-5 transition-all hover:shadow-md`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {loading ? '—' : data?.counts?.portfolios ?? 0}
                            </div>
                            <h3 className={`text-sm font-medium mt-1 ${isDarkMode ? 'text-teal-300' : 'text-teal-700'}`}>
                              Portfolio
                            </h3>
                          </div>
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-teal-500/10' : 'bg-teal-50'}`}>
                            <Image src="/icons/project.svg" alt="Portfolio" width={24} height={24} />
                          </div>
                        </div>
                      </Link>

                      {/* Projects */}
                      <Link
                        href={`/profile/${encodeURIComponent(username)}/projects`}
                        className={`group relative overflow-hidden rounded-xl border ${
                          isDarkMode ? 'border-emerald-500/30 hover:border-emerald-500/50' : 'border-emerald-300 hover:border-emerald-400'
                        } bg-card/50 p-5 transition-all hover:shadow-md`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {loading ? '—' : data?.counts?.projects ?? 0}
                            </div>
                            <h3 className={`text-sm font-medium mt-1 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                              Projects
                            </h3>
                          </div>
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                            <Rocket className="h-5 w-5 text-emerald-500" />
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>

                  {/* Experience */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                        <Building2 className="h-4 w-4 text-emerald-500" />
                        Experience
                      </h2>
                      {isOwnProfile && (
                        <Link
                          href={`/profile/${encodeURIComponent(username)}/experiences/edit`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            isDarkMode
                              ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10'
                              : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </Link>
                      )}
                    </div>

                    <div className="space-y-1">
                      {loading ? (
                        <p className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>Loading...</p>
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
                            <div key={exp.id} className="flex gap-3">
                              {/* Timeline */}
                              <div className="flex flex-col items-center pt-1">
                                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                                  <Building2 className="h-4 w-4 text-emerald-500" />
                                </div>
                                {index < (experiences.length - 1) && (
                                  <div className={`w-px flex-1 mt-2 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex-1 pb-6">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                      {title}
                                      {company && (
                                        <span className={`font-normal ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                          {' '}at {company}
                                        </span>
                                      )}
                                    </h3>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {duration && (
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        isDarkMode
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                          : 'bg-emerald-50 text-emerald-700'
                                      }`}>
                                        {duration}
                                      </span>
                                    )}
                                    {isCurrent && (
                                      <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                                        Current
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {(start || end) && (
                                  <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {formatMonthYear(start)} — {isCurrent && !end ? 'Present' : formatMonthYear(end)}
                                  </p>
                                )}
                                {primaryPosition?.description && (
                                  <p className={`text-sm mt-2 leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {primaryPosition.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No experiences added.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Posts Tab ── */}
              {activeTab === 'posts' && (
                <div>
                  {loading || !data?.user?.id ? (
                    <div className="text-center text-sm text-muted-foreground py-8">Loading posts...</div>
                  ) : (
                    <UserActivityFeed userId={data.user.id} type="posts" />
                  )}
                </div>
              )}

              {/* ── Replies Tab ── */}
              {activeTab === 'replies' && (
                <div>
                  {loading || !data?.user?.id ? (
                    <div className="text-center text-sm text-muted-foreground py-8">Loading replies...</div>
                  ) : (
                    <UserActivityFeed userId={data.user.id} type="replies" />
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
