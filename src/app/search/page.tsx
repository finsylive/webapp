'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Search,
  Loader2,
  MapPin,
  User,
  Users,
  FileText,
  Trophy,
  Briefcase,
  Zap,
  Clock,
  DollarSign,
  BadgeCheck,
  ArrowRight,
  X,
  Heart,
  ChevronDown,
} from 'lucide-react';
import { toProxyUrl } from '@/utils/imageUtils';
import { format } from 'date-fns';

type SearchTab = 'users' | 'posts' | 'competitions' | 'jobs' | 'gigs';

const tabs: { key: SearchTab; label: string; icon: typeof Users }[] = [
  { key: 'users', label: 'People', icon: Users },
  { key: 'posts', label: 'Posts', icon: FileText },
  { key: 'competitions', label: 'Competitions', icon: Trophy },
  { key: 'jobs', label: 'Jobs', icon: Briefcase },
  { key: 'gigs', label: 'Gigs', icon: Zap },
];

type UserResult = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  tagline: string | null;
  current_city: string | null;
  user_type: string;
  is_verified: boolean;
};

type PostResult = {
  id: string;
  content: string;
  created_at: string;
  users: { username: string; full_name: string; avatar_url: string | null };
};

type CompetitionResult = {
  id: string;
  title: string;
  description?: string | null;
  deadline?: string | null;
  prize_pool?: string | null;
  banner_image_url?: string | null;
};

type JobResult = {
  id: string;
  title: string;
  company: string;
  location?: string | null;
  salary_range?: string | null;
  job_type: string;
  deadline?: string | null;
};

type GigResult = {
  id: string;
  title: string;
  description?: string | null;
  budget?: string | null;
  duration?: string | null;
  skills_required?: string[];
  deadline?: string | null;
};

function highlightMatch(text: string, query: string) {
  if (!query || !text) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-primary/20 text-primary rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

type SuggestedUser = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  tagline: string | null;
  is_verified: boolean;
};

type TrendingPost = {
  id: string;
  content: string;
  created_at: string;
  likes: number;
  author: { username: string; full_name: string; avatar_url: string | null };
};

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('users');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<SearchTab, unknown[]>>({
    users: [],
    posts: [],
    competitions: [],
    jobs: [],
    gigs: [],
  });
  const [hasSearched, setHasSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<JobResult[]>([]);
  const [recommendedGigs, setRecommendedGigs] = useState<GigResult[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [showAllGigs, setShowAllGigs] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchSuggestions() {
      try {
        const res = await fetch('/api/recommendations');
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          if (Array.isArray(json.suggestedUsers)) setSuggestedUsers(json.suggestedUsers);
          if (Array.isArray(json.trendingPosts)) setTrendingPosts(json.trendingPosts);
          if (Array.isArray(json.recommendedJobs)) setRecommendedJobs(json.recommendedJobs);
          if (Array.isArray(json.recommendedGigs)) setRecommendedGigs(json.recommendedGigs);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    }
    fetchSuggestions();
    return () => { cancelled = true; };
  }, []);

  const doSearch = useCallback(async (q: string, tab: SearchTab) => {
    if (!q.trim() || q.trim().length < 2) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q.trim())}&type=${tab}`,
        { signal: controller.signal }
      );
      const json = await res.json();
      if (abortRef.current === controller) {
        setResults((prev) => ({ ...prev, [tab]: Array.isArray(json.data) ? json.data : [] }));
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setResults((prev) => ({ ...prev, [tab]: [] }));
      }
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, []);

  // Debounced search on query change
  useEffect(() => {
    if (!query.trim()) {
      setResults({ users: [], posts: [], competitions: [], jobs: [], gigs: [] });
      setHasSearched(false);
      setLoading(false);
      return;
    }

    const id = setTimeout(() => {
      if (query.trim().length >= 2) doSearch(query, activeTab);
    }, 350);

    return () => clearTimeout(id);
  }, [query, activeTab, doSearch]);

  // Re-search when tab changes (if we have a query)
  function switchTab(tab: SearchTab) {
    setActiveTab(tab);
    if (query.trim().length >= 2 && !results[tab].length) {
      doSearch(query, tab);
    }
  }

  function clearSearch() {
    setQuery('');
    setResults({ users: [], posts: [], competitions: [], jobs: [], gigs: [] });
    setHasSearched(false);
    inputRef.current?.focus();
  }

  const currentResults = results[activeTab];
  const q = query.trim();

  return (
    <DashboardLayout>
      <div className="flex flex-col flex-1 w-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto w-full">
          {/* Search header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Search</h1>
            <p className="text-sm text-muted-foreground mt-1">Find people, posts, competitions, jobs, and gigs</p>
          </div>

          {/* Search input */}
          <div className="relative mb-5">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              autoFocus
              className="w-full h-12 pl-12 pr-10 rounded-xl border border-border bg-card text-foreground text-base placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 mb-6 scrollbar-none">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => switchTab(key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === key
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Searching...</p>
            </div>
          ) : hasSearched && currentResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Search className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-lg font-medium text-foreground">No results found</p>
              <p className="text-sm text-muted-foreground">Try a different search term or category</p>
            </div>
          ) : !hasSearched ? (
            <div>
              {loadingSuggestions ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Recommended People */}
                  {activeTab === 'users' && suggestedUsers.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Recommended People</h2>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {(showAllUsers ? suggestedUsers : suggestedUsers.slice(0, 4)).map((u) => (
                          <button
                            key={u.id}
                            onClick={() => router.push(`/profile/${encodeURIComponent(u.username)}`)}
                            className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all text-center group"
                          >
                            <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 bg-muted ring-2 ring-transparent group-hover:ring-primary/30 transition-all">
                              {u.avatar_url ? (
                                <Image
                                  src={toProxyUrl(u.avatar_url, { width: 64, quality: 85 })}
                                  alt={u.username}
                                  width={64}
                                  height={64}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center">
                                  <User className="h-7 w-7 text-white" />
                                </div>
                              )}
                            </div>
                            <div className="w-full min-w-0">
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-semibold text-sm text-foreground truncate">
                                  {u.full_name || u.username}
                                </span>
                                {u.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" />}
                              </div>
                              <p className="text-xs text-primary/80 truncate">@{u.username}</p>
                              {u.tagline && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                  {u.tagline}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                      {suggestedUsers.length > 4 && !showAllUsers && (
                        <button
                          onClick={() => setShowAllUsers(true)}
                          className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-muted/50 transition-all text-sm font-medium text-muted-foreground hover:text-foreground"
                        >
                          See more
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Trending Posts */}
                  {activeTab === 'posts' && trendingPosts.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <FileText className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Trending Posts</h2>
                      </div>
                      <div className="space-y-3">
                        {(showAllPosts ? trendingPosts : trendingPosts.slice(0, 3)).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => router.push(`/post/${encodeURIComponent(p.id)}`)}
                            className="w-full p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all text-left"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-muted shrink-0">
                                {p.author?.avatar_url ? (
                                  <Image
                                    src={toProxyUrl(p.author.avatar_url, { width: 32 })}
                                    alt={p.author.username}
                                    width={32}
                                    height={32}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center">
                                    <User className="h-4 w-4 text-white" />
                                  </div>
                                )}
                              </div>
                              <span className="text-sm font-medium text-foreground">
                                {p.author?.full_name || p.author?.username}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(p.created_at), 'MMM d, yyyy')}
                              </span>
                              <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                                <Heart className="h-3 w-3" />
                                {p.likes}
                              </div>
                            </div>
                            <p className="text-sm text-foreground line-clamp-3">{p.content}</p>
                          </button>
                        ))}
                      </div>
                      {trendingPosts.length > 3 && !showAllPosts && (
                        <button
                          onClick={() => setShowAllPosts(true)}
                          className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-muted/50 transition-all text-sm font-medium text-muted-foreground hover:text-foreground"
                        >
                          See more
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Recommended Jobs */}
                  {activeTab === 'jobs' && recommendedJobs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Briefcase className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Recommended Jobs</h2>
                      </div>
                      <div className="space-y-3">
                        {(showAllJobs ? recommendedJobs : recommendedJobs.slice(0, 4)).map((j) => (
                          <div
                            key={j.id}
                            className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <span className="font-semibold text-foreground">{j.title}</span>
                                <p className="text-sm text-muted-foreground mt-0.5">{j.company}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    {j.job_type}
                                  </span>
                                  {j.location && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {j.location}
                                    </span>
                                  )}
                                  {j.salary_range && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <DollarSign className="h-3 w-3" />
                                      {j.salary_range}
                                    </span>
                                  )}
                                  {j.deadline && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {format(new Date(j.deadline), 'MMM d')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {recommendedJobs.length > 4 && !showAllJobs && (
                        <button
                          onClick={() => setShowAllJobs(true)}
                          className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-muted/50 transition-all text-sm font-medium text-muted-foreground hover:text-foreground"
                        >
                          See more
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Recommended Gigs */}
                  {activeTab === 'gigs' && recommendedGigs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Zap className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Recommended Gigs</h2>
                      </div>
                      <div className="space-y-3">
                        {(showAllGigs ? recommendedGigs : recommendedGigs.slice(0, 4)).map((g) => (
                          <div
                            key={g.id}
                            className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <span className="font-semibold text-foreground">{g.title}</span>
                                {g.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{g.description}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {g.budget && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <DollarSign className="h-3 w-3" />
                                      {g.budget}
                                    </span>
                                  )}
                                  {g.duration && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {g.duration}
                                    </span>
                                  )}
                                </div>
                                {g.skills_required && g.skills_required.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {g.skills_required.slice(0, 5).map((skill) => (
                                      <span
                                        key={skill}
                                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                      >
                                        {skill}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {recommendedGigs.length > 4 && !showAllGigs && (
                        <button
                          onClick={() => setShowAllGigs(true)}
                          className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-muted/50 transition-all text-sm font-medium text-muted-foreground hover:text-foreground"
                        >
                          See more
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Competitions tab & empty fallback */}
                  {((activeTab === 'users' && suggestedUsers.length === 0) ||
                    (activeTab === 'posts' && trendingPosts.length === 0) ||
                    (activeTab === 'competitions') ||
                    (activeTab === 'jobs' && recommendedJobs.length === 0) ||
                    (activeTab === 'gigs' && recommendedGigs.length === 0)) && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Search className="h-8 w-8 text-primary" />
                      </div>
                      <p className="text-lg font-medium text-foreground">Discover Ments</p>
                      <p className="text-sm text-muted-foreground text-center max-w-sm">Search for people, posts, competitions, jobs, and gigs across the platform</p>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Users */}
              {activeTab === 'users' &&
                (currentResults as UserResult[]).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => router.push(`/profile/${encodeURIComponent(u.username)}`)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-muted">
                      {u.avatar_url ? (
                        <Image
                          src={toProxyUrl(u.avatar_url, { width: 48, quality: 85 })}
                          alt={u.username}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center">
                          <User className="h-6 w-6 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {highlightMatch(u.full_name || u.username, q)}
                        </span>
                        {u.is_verified && <BadgeCheck className="h-4 w-4 text-primary shrink-0" />}
                        {u.user_type === 'mentor' && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                            Mentor
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-primary/80">@{highlightMatch(u.username, q)}</p>
                      {u.tagline && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                          {highlightMatch(u.tagline, q)}
                        </p>
                      )}
                    </div>
                    {u.current_city && (
                      <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <MapPin className="h-3 w-3" />
                        {u.current_city}
                      </div>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </button>
                ))}

              {/* Posts */}
              {activeTab === 'posts' &&
                (currentResults as PostResult[]).map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-muted shrink-0">
                        {p.users?.avatar_url ? (
                          <Image
                            src={toProxyUrl(p.users.avatar_url, { width: 32 })}
                            alt={p.users.username}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => router.push(`/profile/${encodeURIComponent(p.users?.username)}`)}
                        className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {p.users?.full_name || p.users?.username}
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(p.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <p className="text-sm text-foreground line-clamp-3">
                      {highlightMatch(p.content, q)}
                    </p>
                  </div>
                ))}

              {/* Competitions */}
              {activeTab === 'competitions' &&
                (currentResults as CompetitionResult[]).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => router.push(`/hub/${encodeURIComponent(c.id)}`)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all text-left group"
                  >
                    {c.banner_image_url ? (
                      <div className="w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-muted">
                        <Image
                          src={c.banner_image_url.includes('/storage/v1/object/public/') ? c.banner_image_url : toProxyUrl(c.banner_image_url)}
                          alt={c.title}
                          width={64}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Trophy className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-foreground truncate block">
                        {highlightMatch(c.title, q)}
                      </span>
                      {c.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                          {highlightMatch(c.description, q)}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {c.deadline && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(c.deadline), 'MMM d, yyyy')}
                          </span>
                        )}
                        {c.prize_pool && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Trophy className="h-3 w-3" />
                            {c.prize_pool}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </button>
                ))}

              {/* Jobs */}
              {activeTab === 'jobs' &&
                (currentResults as JobResult[]).map((j) => (
                  <div
                    key={j.id}
                    className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-foreground">
                          {highlightMatch(j.title, q)}
                        </span>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {highlightMatch(j.company, q)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {j.job_type}
                          </span>
                          {j.location && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {j.location}
                            </span>
                          )}
                          {j.salary_range && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {j.salary_range}
                            </span>
                          )}
                          {j.deadline && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(j.deadline), 'MMM d')}
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        Apply
                      </button>
                    </div>
                  </div>
                ))}

              {/* Gigs */}
              {activeTab === 'gigs' &&
                (currentResults as GigResult[]).map((g) => (
                  <div
                    key={g.id}
                    className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-foreground">
                          {highlightMatch(g.title, q)}
                        </span>
                        {g.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {highlightMatch(g.description, q)}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {g.budget && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {g.budget}
                            </span>
                          )}
                          {g.duration && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {g.duration}
                            </span>
                          )}
                        </div>
                        {g.skills_required && g.skills_required.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {g.skills_required.slice(0, 5).map((skill) => (
                              <span
                                key={skill}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        Apply
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
