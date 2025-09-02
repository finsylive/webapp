"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import Image from 'next/image';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Loader2, User, Diamond, Zap, Building2, BadgeCheck, Pencil } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/theme/ThemeContext';
import { toProxyUrl } from '@/utils/imageUtils';

// Public profile page routed via /profile/[username]
export default function PublicProfilePage() {
  const routeParams = useParams() as { username?: string };
  const username = (routeParams?.username || '').toString().trim();

  if (!username) {
    notFound();
  }

  const { user: viewer, isLoading: authLoading } = useAuth();
  const viewerId = viewer?.id ?? null;

  type ExperienceRow = {
    id: string;
    title?: string | null;
    role?: string | null;
    company?: string | null;
    company_name?: string | null;
    is_current?: boolean | null;
    start_date?: string | null;
    end_date?: string | null;
    description?: string | null;
  };

  type ProfileData = {
    user: {
      id: string;
      username: string;
      full_name?: string | null;
      avatar_url?: string | null;
      cover_url?: string | null;
      tagline?: string | null;
      current_city?: string | null;
      user_type?: string | null;
      is_verified?: boolean | null;
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

  const [data, setData] = useState<ProfileData>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followPending, setFollowPending] = useState(false);
  const { isDarkMode } = useTheme();

  const avatarUrl = useMemo(() => data?.user?.avatar_url || null, [data?.user?.avatar_url]);
  const coverUrl = useMemo(() => data?.user?.cover_url || null, [data?.user?.cover_url]);

  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const qs = new URLSearchParams();
        if (viewerId) qs.set('viewerId', viewerId);
        const res = await fetch(`/api/users/${encodeURIComponent(username)}/profile?${qs.toString()}`);
        if (!res.ok) throw new Error('Failed to load profile');
        const json = await res.json();
        if (!cancelled) setData(json?.data ?? null);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load profile';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProfile();
    return () => { cancelled = true; };
  }, [username, viewerId]);

  const handleToggleFollow = async () => {
    if (!viewerId || !data?.user?.id) return;
    setFollowPending(true);
    try {
      const follow = !(data.viewer?.is_following ?? false);
      const res = await fetch(`/api/users/${encodeURIComponent(data.user.username || username)}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId: viewerId, follow }),
      });
      if (!res.ok) throw new Error('Failed to update follow');
      setData((prev) => {
        if (!prev) return prev;
        const wasFollowing = prev.viewer.is_following;
        const nextFollowing = follow;
        const delta = wasFollowing === nextFollowing ? 0 : (nextFollowing ? 1 : -1);
        return {
          ...prev,
          counts: { ...prev.counts, followers: Math.max(0, (prev.counts?.followers ?? 0) + delta) },
          viewer: { ...prev.viewer, is_following: nextFollowing },
        };
      });
    } catch {
      // no-op, keep UI unchanged
    } finally {
      setFollowPending(false);
    }
  };

  const fullName = data?.user?.full_name || username;
  const bio = data?.user?.bio || '';

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
            <div className={`${isDarkMode ? 'bg-[#181f2a] border-gray-800' : 'bg-white border-gray-200'} rounded-xl shadow-sm border mt-0 mb-8`}>
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
                {data?.user?.user_type && (
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm mt-1`}>
                    {data?.user?.user_type}
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
                    <Button size="sm" className="rounded-full">
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Profile
                    </Button>
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
            <div className={`${isDarkMode ? 'bg-[#181f2a] border-gray-800' : 'bg-white border-gray-200'} rounded-xl shadow-sm border mb-8`}>
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
            <div className={`${isDarkMode ? 'bg-[#181f2a] border-gray-800' : 'bg-white border-gray-200'} rounded-xl shadow-sm border mb-8`}>
              <div className="flex border-b border-gray-200">
                {[{ id: 'about', label: 'About' }, { id: 'posts', label: 'Posts' }, { id: 'replies', label: 'Replies' }].map((tab) => (
                  <button
                    key={tab.id}
                    className={`px-6 py-4 font-medium border-b-2 transition-colors ${'about' === tab.id
                      ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                    // static selected "About" for now
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="p-8">
                {/* Bio Section */}
                <div className="space-y-8">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <User className="h-5 w-5 text-emerald-600" />
                      Bio
                    </h2>
                    {loading ? <p className="text-gray-500">Loading...</p> : <p className="text-gray-700">{bio || 'No bio yet.'}</p>}
                  </div>

                  {/* Showcase Section */}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                      <Diamond className="h-5 w-5 text-emerald-600" />
                      Showcase
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Link href={`/profile/${encodeURIComponent(username)}/portfolios`} className={`border-2 rounded-xl p-8 text-center transition-colors cursor-pointer border-blue-200 bg-blue-50 hover:bg-blue-100 text-gray-900`}>
                        <div className="text-4xl font-bold text-gray-400 mb-4">{loading ? '—' : data?.counts?.portfolios ?? 0}</div>
                        <div className="p-3 bg-blue-200 rounded-lg inline-flex mb-4">
                          <Diamond className="h-6 w-6 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Portfolio</h3>
                      </Link>
                      <Link href={`/profile/${encodeURIComponent(username)}/projects`} className={`border-2 rounded-xl p-8 text-center transition-colors cursor-pointer border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-gray-900`}>
                        <div className="text-4xl font-bold text-gray-400 mb-4">{loading ? '—' : data?.counts?.projects ?? 0}</div>
                        <div className="p-3 bg-emerald-200 rounded-lg inline-flex mb-4">
                          <Zap className="h-6 w-6 text-emerald-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Projects</h3>
                      </Link>
                    </div>
                  </div>

                  {/* Experience Section */}
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-emerald-600" />
                        Experience
                      </h2>
                    </div>
                    <div className="space-y-6">
                      {loading ? (
                        <p className="text-gray-500">Loading...</p>
                      ) : data?.experiences && data.experiences.length > 0 ? (
                        data.experiences.map((exp, index) => {
                          const title = exp.title || exp.role || 'Experience';
                          const company = exp.company || exp.company_name || '';
                          const isCurrent = Boolean(exp.is_current) || (!exp.end_date && exp.start_date);
                          const start = exp.start_date ? new Date(exp.start_date) : null;
                          const end = exp.end_date ? new Date(exp.end_date) : null;
                          const formatMonthYear = (d: Date | null) => d ? d.toLocaleString(undefined, { month: 'short', year: 'numeric' }) : '—';
                          return (
                            <div key={exp.id} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className="p-3 bg-emerald-100 rounded-lg">
                                  <Building2 className="h-5 w-5 text-emerald-600" />
                                </div>
                                {index < (data.experiences.length - 1) && (
                                  <div className="w-px h-16 bg-gray-200 mt-4"></div>
                                )}
                              </div>
                              <div className="flex-1 pb-8">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                      {title}
                                      {company && <span className="text-sm text-gray-500">• {company}</span>}
                                    </h3>
                                  </div>
                                  <div className="text-right">
                                    {isCurrent && (
                                      <div className="inline-flex items-center px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">Current</div>
                                    )}
                                  </div>
                                </div>
                                {(start || end) && (
                                  <p className="text-gray-600 text-sm mb-2">{formatMonthYear(start)} — {isCurrent && !end ? 'Present' : formatMonthYear(end)}</p>
                                )}
                                {exp.description && <p className="text-gray-700">{exp.description}</p>}
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
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">{error}</div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}