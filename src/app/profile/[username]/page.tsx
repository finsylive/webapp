"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Loader2, User, Diamond, Rocket, Building2, BadgeCheck, Pencil, Plus, MapPin, MessageCircle, Zap, GraduationCap, Target, TrendingUp, Github, Globe, Youtube, Linkedin, ExternalLink } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/theme/ThemeContext';
import { UserActivityFeed } from '@/components/posts/UserActivityFeed';
import { toProxyUrl } from '@/utils/imageUtils';
import { DribbbleIcon, BehanceIcon, FigmaIcon, SubstackIcon, InstagramIcon } from '@/components/ui/SocialIcons';

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
  logo_url: string | null;
  stage: string | null;
  elevator_pitch: string | null;
  is_actively_raising: boolean | null;
};

type EducationRow = {
  id: string;
  institution_name: string;
  institution_domain?: string | null;
  degree?: string | null;
  field_of_study?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  sort_order?: number | null;
};

type ProjectRow = {
  id: string;
  title: string | null;
  tagline: string | null;
  cover_url: string | null;
  logo_url: string | null;
  url: string | null;
  created_at: string | null;
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
    skills?: string[] | null;
    looking_for?: string[] | null;
    investor_status?: string | null;
    linkedin?: string | null;
    social_links?: Record<string, string> | null;
    show_projects?: boolean | null;
    show_startups?: boolean | null;
  };
  counts: {
    followers: number;
    following: number;
    projects: number;
    portfolios: number;
    startups: number;
  };
  experiences: ExperienceRow[];
  education: EducationRow[];
  startups: StartupRow[];
  projects?: ProjectRow[];
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
  const [activeTab, setActiveTab] = useState<'about' | 'posts' | 'replies' | 'bookmarks'>('about');
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
  const education = useMemo(() => data?.education ?? [], [data?.education]);
  const startups = useMemo(() => data?.startups ?? [], [data?.startups]);
  const projects = useMemo(() => data?.projects ?? [], [data?.projects]);
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

          {/* Cover + Info — single continuous card, mobile app style */}
          <div className="relative mb-6">
            {/* Cover image — top portion */}
            <div className="relative h-36 sm:h-44 md:h-52 w-full rounded-2xl overflow-hidden">
              {coverUrl && !imgError.cover ? (
                <img
                  src={coverUrl}
                  alt="Cover image"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                  onError={() => setImgError(prev => ({ ...prev, cover: true }))}
                />
              ) : (
                <div className="h-full w-full bg-emerald-600" />
              )}
            </div>

            {/* Info section — bottom card with gap */}
            <div className="relative px-4 sm:px-6 pt-3 pb-5 mt-[7px] bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl">
              {/* Avatar — overlapping the boundary between cover and info */}
              <div className="absolute -top-14 sm:-top-16 right-5 sm:right-8 z-10">
                <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden ring-4 ${isDarkMode ? 'ring-[hsl(var(--card))]' : 'ring-white'} bg-card shadow-xl`}>
                  {avatarUrl && !imgError.avatar ? (
                    <img
                      src={avatarUrl}
                      alt={fullName}
                      className="w-full h-full object-cover"
                      onError={() => setImgError(prev => ({ ...prev, avatar: true }))}
                    />
                  ) : (
                    <div className="w-full h-full bg-emerald-600 flex items-center justify-center">
                      <User className="h-12 w-12 text-white" />
                    </div>
                  )}
                </div>
              </div>

              {/* Name + username + tagline — left side, room for avatar on right */}
              <div className="pr-28 sm:pr-36">
                <h1 className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center gap-2 leading-tight`}>
                  <span className="truncate">{fullName}</span>
                  {data?.user?.is_verified && (
                    <BadgeCheck className="text-blue-500 h-5 w-5 flex-shrink-0" />
                  )}
                </h1>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  @{data?.user?.username || username}
                </span>
                {data?.user?.tagline && (
                  <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {data.user.tagline}
                  </p>
                )}
              </div>

              {/* Location + social icons */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                {city && (
                  <p className={`text-sm flex items-center gap-1.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <MapPin className="h-3.5 w-3.5" />
                    {city}
                  </p>
                )}
                {(() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const links: { url: string; icon: any; label: string }[] = [];
                  const sl = data?.user?.social_links;
                  const li = data?.user?.linkedin;
                  if (li) links.push({ url: li, icon: Linkedin, label: 'LinkedIn' });
                  if (sl?.github) links.push({ url: sl.github, icon: Github, label: 'GitHub' });
                  if (sl?.instagram) links.push({ url: sl.instagram, icon: InstagramIcon, label: 'Instagram' });
                  if (sl?.website) links.push({ url: sl.website, icon: Globe, label: 'Website' });
                  if (sl?.youtube) links.push({ url: sl.youtube, icon: Youtube, label: 'YouTube' });
                  if (sl?.dribbble) links.push({ url: sl.dribbble, icon: DribbbleIcon, label: 'Dribbble' });
                  if (sl?.behance) links.push({ url: sl.behance, icon: BehanceIcon, label: 'Behance' });
                  if (sl?.figma) links.push({ url: sl.figma, icon: FigmaIcon, label: 'Figma' });
                  if (sl?.substack) links.push({ url: sl.substack, icon: SubstackIcon, label: 'Substack' });
                  if (links.length === 0) return null;
                  return (
                    <div className="flex items-center gap-1">
                      {links.map(({ url, icon: Icon, label }) => (
                        <a
                          key={label}
                          href={url.startsWith('http') ? url : `https://${url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={label}
                          className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                        >
                          <Icon className="h-4 w-4" />
                        </a>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Edit / Follow / Message + Follower stats — same row */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3 sm:gap-5">
                  <Link
                    href={`/profile/${encodeURIComponent(username)}/followers`}
                    className={`text-sm hover:underline ${isDarkMode ? 'hover:text-white' : 'hover:text-gray-900'}`}
                  >
                    <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {loading ? '—' : data?.counts?.followers ?? 0}
                    </span>
                    <span className={`ml-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Followers</span>
                  </Link>
                  <Link
                    href={`/profile/${encodeURIComponent(username)}/following`}
                    className={`text-sm hover:underline ${isDarkMode ? 'hover:text-white' : 'hover:text-gray-900'}`}
                  >
                    <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {loading ? '—' : data?.counts?.following ?? 0}
                    </span>
                    <span className={`ml-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Following</span>
                  </Link>
                </div>

                <div className="flex items-center gap-2">
                  {authLoading || loading ? (
                    <Button disabled size="sm" className="rounded-full">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </Button>
                  ) : isOwnProfile ? (
                    <Link href="/profile/edit">
                      <Button size="sm" variant="outline" className="rounded-full border-border/60">
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit Profile
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
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl shadow-sm mb-6">
            <div className={`flex border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              {[
                { id: 'about', label: 'About' },
                { id: 'posts', label: 'Posts' },
                { id: 'replies', label: 'Replies' },
                ...(isOwnProfile ? [{ id: 'bookmarks', label: 'Saved' }] : []),
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={`px-3 py-3 sm:px-5 sm:py-3.5 text-sm font-medium border-b-2 transition-colors ${activeTab === (tab.id as typeof activeTab)
                    ? 'border-emerald-500 text-emerald-500'
                    : `border-transparent ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-900'}`
                    }`}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-6">
              {/* ── About Tab ── */}
              {activeTab === 'about' && (
                <div className="space-y-8">

                  {/* Profile Completion — only shown to profile owner, above bio */}
                  {isOwnProfile && !loading && (() => {
                    const fields = [
                      { label: 'Full Name', done: !!data?.user?.full_name },
                      { label: 'Avatar', done: !!data?.user?.avatar_url },
                      { label: 'Cover Image', done: !!(data?.user?.banner_image || data?.user?.cover_url) },
                      { label: 'Tagline', done: !!data?.user?.tagline },
                      { label: 'Bio', done: !!(data?.user?.about || data?.user?.bio) },
                      { label: 'City', done: !!data?.user?.current_city },
                      { label: 'Skills', done: !!(data?.user?.skills && data.user.skills.length > 0) },
                      { label: 'Experience', done: experiences.length > 0 },
                      { label: 'Education', done: education.length > 0 },
                    ];
                    const completed = fields.filter(f => f.done).length;
                    const total = fields.length;
                    const percent = Math.round((completed / total) * 100);
                    if (percent === 100) return null;

                    const missing = fields.filter(f => !f.done);

                    return (
                      <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-gray-800/50 border-gray-700/50' : 'bg-gray-50 border-gray-200/60'}`}>
                        <div className="flex items-center justify-between mb-2.5">
                          <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Profile completion
                          </span>
                          <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {completed}/{total}
                          </span>
                        </div>
                        <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        {missing.length > 0 && (
                          <p className={`text-[11px] mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            Missing: {missing.map(f => f.label).join(', ')}
                          </p>
                        )}
                      </div>
                    );
                  })()}

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
                  {(isOwnProfile || data?.user?.show_startups !== false) && (startups.length > 0 || isOwnProfile) && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                          <Rocket className="h-4 w-4 text-emerald-500" />
                          Startups
                        </h2>
                        {isOwnProfile && (
                          <Link
                            href="/startups/create"
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${isDarkMode
                              ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10'
                              : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                              }`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add
                          </Link>
                        )}
                      </div>

                      <div className="space-y-3">
                        {loading ? (
                          <p className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>Loading...</p>
                        ) : startups.length > 0 ? (
                          startups.map((startup) => (
                            <Link
                              key={startup.id}
                              href={`/startups/${startup.id}`}
                              className={`flex items-center gap-4 p-3.5 rounded-2xl border transition-all group ${isDarkMode
                                ? 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {startup.logo_url ? (
                                <img
                                  src={startup.logo_url}
                                  alt={startup.brand_name}
                                  className="h-11 w-11 rounded-xl object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                                  <Rocket className="h-5 w-5 text-emerald-500" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className={`text-sm font-semibold truncate group-hover:underline ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {startup.brand_name}
                                  </h3>
                                  {startup.is_actively_raising && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-md font-bold flex-shrink-0 dark:bg-green-500/10 dark:text-green-400">
                                      Raising
                                    </span>
                                  )}
                                </div>
                                {startup.elevator_pitch && (
                                  <p className={`text-xs truncate mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {startup.elevator_pitch}
                                  </p>
                                )}
                              </div>
                              {startup.stage && (
                                <span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium flex-shrink-0 capitalize ${isDarkMode
                                  ? 'bg-gray-800 text-gray-400 border border-gray-700'
                                  : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {startup.stage}
                                </span>
                              )}
                            </Link>
                          ))
                        ) : (
                          <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No startups added yet.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Projects — inline cards */}
                  {(isOwnProfile || data?.user?.show_projects !== false) && (projects.length > 0 || isOwnProfile) && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                          <Diamond className="h-4 w-4 text-emerald-500" />
                          Projects
                        </h2>
                        <div className="flex items-center gap-2">
                          {projects.length > 3 && (
                            <Link
                              href={`/profile/${encodeURIComponent(username)}/projects`}
                              className={`text-xs font-medium transition-colors ${isDarkMode ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}
                            >
                              View all
                            </Link>
                          )}
                          {isOwnProfile && (
                            <Link
                              href={`/profile/${encodeURIComponent(username)}/projects`}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${isDarkMode
                                ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10'
                                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                }`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add
                            </Link>
                          )}
                        </div>
                      </div>

                      {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[1, 2].map((i) => (
                            <div key={i} className={`rounded-xl border ${isDarkMode ? 'border-gray-800' : 'border-gray-200'} p-3 animate-pulse`}>
                              <div className={`h-28 rounded-lg mb-3 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
                              <div className={`h-4 rounded w-3/4 mb-2 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
                              <div className={`h-3 rounded w-1/2 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
                            </div>
                          ))}
                        </div>
                      ) : projects.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {projects.slice(0, 4).map((project) => (
                            <Link
                              key={project.id}
                              href={`/profile/${encodeURIComponent(username)}/projects/${project.id}`}
                              className={`group rounded-xl border overflow-hidden transition-all hover:shadow-md ${isDarkMode
                                ? 'border-gray-800 hover:border-emerald-500/40 bg-card/50'
                                : 'border-gray-200 hover:border-emerald-300 bg-card/50'
                                }`}
                            >
                              {/* Cover image */}
                              <div className={`relative h-28 w-full ${isDarkMode ? 'bg-emerald-500/5' : 'bg-emerald-50/50'}`}>
                                {project.cover_url ? (
                                  <img
                                    src={toProxyUrl(project.cover_url, { width: 400, quality: 75 })}
                                    alt={project.title || 'Project'}
                                    className="w-full h-full object-cover"
                                  />
                                ) : project.logo_url ? (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <img
                                      src={toProxyUrl(project.logo_url, { width: 96, quality: 80 })}
                                      alt={project.title || 'Project'}
                                      className="h-12 w-12 object-contain"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Rocket className="h-8 w-8 text-emerald-500/40" />
                                  </div>
                                )}
                              </div>
                              {/* Info */}
                              <div className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <h3 className={`text-sm font-semibold truncate group-hover:underline ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                      {project.title || 'Untitled'}
                                    </h3>
                                    {project.tagline && (
                                      <p className={`text-xs mt-0.5 line-clamp-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {project.tagline}
                                      </p>
                                    )}
                                  </div>
                                  {project.url && (
                                    <ExternalLink className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                                  )}
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No projects yet.</p>
                      )}
                    </div>
                  )}

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
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${isDarkMode
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
                                <div className={`h-10 w-10 rounded-xl ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'} overflow-hidden flex items-center justify-center`}>
                                  {exp.domain ? (
                                    <img
                                      src={`https://www.google.com/s2/favicons?domain=${exp.domain}&sz=64`}
                                      alt={exp.company_name}
                                      className="h-7 w-7 object-contain"
                                      onError={(e) => {
                                        const el = e.target as HTMLImageElement;
                                        el.style.display = 'none';
                                        if (el.nextElementSibling) return;
                                        const fallback = document.createElement('span');
                                        fallback.className = 'h-7 w-7 flex items-center justify-center';
                                        fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 2v4"/><path d="M2 10h20"/></svg>';
                                        el.parentElement?.appendChild(fallback);
                                      }}
                                    />
                                  ) : (
                                    <Building2 className="h-5 w-5 text-emerald-500" />
                                  )}
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
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode
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

                  {/* Education */}
                  {(education.length > 0 || isOwnProfile) && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                          <GraduationCap className="h-4 w-4 text-emerald-500" />
                          Education
                        </h2>
                        {isOwnProfile && (
                          <Link
                            href={`/profile/${encodeURIComponent(username)}/education/edit`}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${isDarkMode
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
                        ) : education.length > 0 ? (
                          education.map((ed, index) => {
                            const edStart = ed.start_date ? new Date(ed.start_date) : null;
                            const edEnd = ed.end_date ? new Date(ed.end_date) : null;
                            const edIsCurrent = !ed.end_date && !!ed.start_date;
                            const formatMonthYear = (d: Date | null) => d ? d.toLocaleString(undefined, { month: 'short', year: 'numeric' }) : '—';
                            const edDuration = formatDuration(ed.start_date, ed.end_date);

                            return (
                              <div key={ed.id} className="flex gap-3">
                                <div className="flex flex-col items-center pt-1">
                                  <div className={`h-10 w-10 rounded-xl ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'} overflow-hidden flex items-center justify-center`}>
                                    {ed.institution_domain ? (
                                      <img
                                        src={`https://www.google.com/s2/favicons?domain=${ed.institution_domain}&sz=64`}
                                        alt={ed.institution_name}
                                        className="h-7 w-7 object-contain"
                                        onError={(e) => {
                                          const el = e.target as HTMLImageElement;
                                          el.style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <GraduationCap className="h-5 w-5 text-emerald-500" />
                                    )}
                                  </div>
                                  {index < (education.length - 1) && (
                                    <div className={`w-px flex-1 mt-2 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
                                  )}
                                </div>

                                <div className="flex-1 pb-6">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        {ed.degree || 'Education'}
                                        {ed.field_of_study && (
                                          <span className={`font-normal ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                            {' '}in {ed.field_of_study}
                                          </span>
                                        )}
                                      </h3>
                                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {ed.institution_name}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {edDuration && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                          : 'bg-emerald-50 text-emerald-700'
                                          }`}>
                                          {edDuration}
                                        </span>
                                      )}
                                      {edIsCurrent && (
                                        <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                                          Current
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {(edStart || edEnd) && (
                                    <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                      {formatMonthYear(edStart)} — {edIsCurrent && !edEnd ? 'Present' : formatMonthYear(edEnd)}
                                    </p>
                                  )}
                                  {ed.description && (
                                    <p className={`text-sm mt-2 leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                      {ed.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No education added.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Skills */}
                  {(data?.user?.skills && data.user.skills.length > 0) && (
                    <div>
                      <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-3 flex items-center gap-2`}>
                        <Zap className="h-4 w-4 text-emerald-500" />
                        Skills
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {data.user.skills.map((skill) => (
                          <span
                            key={skill}
                            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${isDarkMode
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Looking For — additive section, shown when array is non-empty */}
                  {(data?.user?.looking_for && data.user.looking_for.length > 0) && (
                    <div>
                      <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-3 flex items-center gap-2`}>
                        <Target className="h-4 w-4 text-emerald-500" />
                        Looking for
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {data.user.looking_for.map((item) => (
                          <span
                            key={item}
                            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${isDarkMode
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                          >
                            {item.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Investor Info — additive section, shown only for verified investors */}
                  {data?.user?.investor_status === 'verified' && (
                    <div>
                      <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-3 flex items-center gap-2`}>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        Investor
                        <span className={`ml-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDarkMode
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-emerald-50 text-emerald-700'
                          }`}>
                          Verified
                        </span>
                      </h2>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Verified investor on Ments
                      </p>
                    </div>
                  )}
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

              {/* ── Saved / Bookmarks Tab ── */}
              {activeTab === 'bookmarks' && isOwnProfile && (
                <div>
                  {loading || !data?.user?.id ? (
                    <div className="text-center text-sm text-muted-foreground py-8">Loading saved posts...</div>
                  ) : (
                    <UserActivityFeed userId={data.user.id} type="bookmarks" />
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
