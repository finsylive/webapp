"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Share2, Users, MapPin, ExternalLink, ChevronDown,
  Calendar, CheckCircle, Loader2, LogOut, Bookmark, BookmarkCheck, Star,
  Trophy, Wallet, TrendingUp, Store, IndianRupee, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { toProxyUrl } from '@/utils/imageUtils';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/context/AuthContext';
import { StallQRCode } from '@/components/arena/StallQRCode';

type UserStartup = {
  id: string;
  brand_name: string;
  description: string | null;
  stage: string;
  logo_url: string | null;
  elevator_pitch: string | null;
  categories: string[];
};

type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
  event_url: string | null;
  banner_image_url: string | null;
  event_type: 'online' | 'in-person' | 'hybrid';
  created_by: string;
  created_at: string;
  is_active: boolean;
  // Extended fields
  tags?: string[];
  is_featured?: boolean;
  organizer_name?: string | null;
  category?: string | null;
  // Arena fields
  arena_enabled?: boolean;
  entry_type?: 'startup' | 'project' | null;
  arena_round?: 'registration' | 'investment' | 'completed' | null;
  virtual_fund_amount?: number;
};

type Stall = {
  id: string;
  stall_name: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  category: string | null;
  startup_id: string | null;
  startup?: { id: string; brand_name: string; logo_url: string | null; stage: string; website: string | null } | null;
  total_funding?: number;
  investor_count?: number;
};

type LeaderboardEntry = {
  id: string;
  stall_name: string;
  tagline: string | null;
  logo_url: string | null;
  category: string | null;
  total_funding: number;
  investor_count: number;
};

function resolveBannerUrl(raw?: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('s3://')) {
    const withoutScheme = raw.slice('s3://'.length);
    const slashIdx = withoutScheme.indexOf('/');
    if (slashIdx > 0) {
      const bucket = withoutScheme.slice(0, slashIdx);
      const key = withoutScheme.slice(slashIdx + 1);
      return toProxyUrl(`https://${bucket}.s3.amazonaws.com/${key}`);
    }
  }
  if (raw.includes('/storage/v1/object/public/')) return raw;
  if (raw.startsWith('http')) return toProxyUrl(raw);
  try {
    const { data } = supabase.storage.from('media').getPublicUrl(raw);
    if (data?.publicUrl) return data.publicUrl;
  } catch { }
  return null;
}

const eventTypeLabels: Record<string, string> = {
  online: 'Online',
  'in-person': 'In-Person',
  hybrid: 'Hybrid',
};


const categoryLabels: Record<string, string> = {
  event: 'Event', meetup: 'Meetup', workshop: 'Workshop', conference: 'Conference', seminar: 'Seminar',
};

export default function EventDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [participants, setParticipants] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(true);

  // Join state
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [unjoining, setUnjoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [checkingJoin, setCheckingJoin] = useState(true);

  // Bookmark state
  const [saved, setSaved] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);

  // Arena state
  const [isStallOwner, setIsStallOwner] = useState(false);
  const [myStallId, setMyStallId] = useState<string | null>(null);
  const [isAudience, setIsAudience] = useState(false);
  const [virtualBalance, setVirtualBalance] = useState(0);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [arenaStats, setArenaStats] = useState({ total_stalls: 0, total_audience: 0, total_invested: 0 });

  // Stall registration form
  const [stallForm, setStallForm] = useState({ stall_name: '', tagline: '', description: '', startup_id: '', category: '' });
  const [registeringStall, setRegisteringStall] = useState(false);
  const [stallError, setStallError] = useState<string | null>(null);
  const [userStartups, setUserStartups] = useState<UserStartup[]>([]);
  const [loadingStartups, setLoadingStartups] = useState(false);

  // Audience registration
  const [joiningAudience, setJoiningAudience] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);

  // Stall detail modal & investment state
  const [openStallId, setOpenStallId] = useState<string | null>(null);
  const [investAmounts, setInvestAmounts] = useState<Record<string, string>>({});
  const [investingStall, setInvestingStall] = useState<string | null>(null);
  const [investError, setInvestError] = useState<string | null>(null);


  // Fetch event details
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/events/${encodeURIComponent(id)}`, { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        setEvent(json.data || null);
        setParticipants(json.participants || 0);
      } catch (e) {
        console.error('Failed to load event details', e);
        if (!cancelled) {
          setEvent(null);
          setParticipants(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Check join + saved state
  useEffect(() => {
    if (!id || !user) { setCheckingJoin(false); return; }
    let cancelled = false;
    (async () => {
      setCheckingJoin(true);
      try {
        const [participantRes, savedRes] = await Promise.all([
          supabase
            .from('event_participants')
            .select('user_id')
            .eq('event_id', id)
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('saved_events')
            .select('id')
            .eq('event_id', id)
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);
        if (!cancelled) {
          setJoined(!!participantRes.data);
          setSaved(!!savedRes.data);
        }
      } catch { }
      if (!cancelled) setCheckingJoin(false);
    })();
    return () => { cancelled = true; };
  }, [id, user]);

  // Fetch arena data when event is loaded and arena is enabled
  useEffect(() => {
    if (!event?.arena_enabled || !id) return;
    // Fetch leaderboard and stalls
    const fetchArena = async () => {
      try {
        const [leaderRes, stallsRes] = await Promise.all([
          fetch(`/api/events/${encodeURIComponent(id)}/leaderboard`),
          fetch(`/api/events/${encodeURIComponent(id)}/stalls`),
        ]);
        const leaderJson = await leaderRes.json();
        const stallsJson = await stallsRes.json();
        if (leaderJson.leaderboard) setLeaderboard(leaderJson.leaderboard);
        if (stallsJson.stalls) setStalls(stallsJson.stalls);
        setArenaStats({
          total_stalls: leaderJson.total_stalls ?? 0,
          total_audience: leaderJson.total_audience ?? 0,
          total_invested: leaderJson.total_invested ?? 0,
        });
      } catch { }
    };
    fetchArena();
    // Poll leaderboard every 15s during investment round
    if (event.arena_round === 'investment') {
      const interval = setInterval(fetchArena, 15000);
      return () => clearInterval(interval);
    }
  }, [event?.arena_enabled, event?.arena_round, id]);

  // Check user's arena role
  useEffect(() => {
    if (!event?.arena_enabled || !id || !user) return;
    (async () => {
      try {
        const [audienceRes, stallRes] = await Promise.all([
          fetch(`/api/events/${encodeURIComponent(id)}/audience`),
          supabase
            .from('event_stalls')
            .select('id')
            .eq('event_id', id)
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);
        const json = await audienceRes.json();
        setIsStallOwner(json.isStallOwner ?? false);
        if (json.audience) {
          setIsAudience(true);
          setVirtualBalance(json.audience.virtual_balance ?? 0);
        }
        if (stallRes.data) {
          setMyStallId(stallRes.data.id);
        }
      } catch { }
    })();
  }, [event?.arena_enabled, id, user]);

  // Fetch user's startups for stall registration
  useEffect(() => {
    if (!event?.arena_enabled || event.arena_round !== 'registration' || !user || isStallOwner) return;
    setLoadingStartups(true);
    (async () => {
      try {
        // Get startups where user is owner
        const { data: owned } = await supabase
          .from('startup_profiles')
          .select('id, brand_name, description, stage, logo_url, elevator_pitch, categories')
          .eq('owner_id', user.id);

        // Get startups where user is a founder
        const { data: founderLinks } = await supabase
          .from('startup_founders')
          .select('startup_id')
          .eq('user_id', user.id)
          .eq('status', 'accepted');

        const founderStartupIds = (founderLinks ?? [])
          .map((f: { startup_id: string }) => f.startup_id)
          .filter((id: string) => !(owned ?? []).some((o: { id: string }) => o.id === id));

        let founderStartups: UserStartup[] = [];
        if (founderStartupIds.length > 0) {
          const { data } = await supabase
            .from('startup_profiles')
            .select('id, brand_name, description, stage, logo_url, elevator_pitch, categories')
            .in('id', founderStartupIds);
          founderStartups = (data ?? []) as UserStartup[];
        }

        setUserStartups([...((owned ?? []) as UserStartup[]), ...founderStartups]);
      } catch { }
      setLoadingStartups(false);
    })();
  }, [event?.arena_enabled, event?.arena_round, user, isStallOwner]);

  // Auto-fill stall form when a startup is selected
  const handleStartupSelect = (startupId: string) => {
    setStallForm(prev => ({ ...prev, startup_id: startupId }));
    if (!startupId) return;
    const startup = userStartups.find(s => s.id === startupId);
    if (startup) {
      setStallForm(prev => ({
        ...prev,
        startup_id: startupId,
        stall_name: prev.stall_name || startup.brand_name,
        tagline: prev.tagline || startup.elevator_pitch || '',
        description: prev.description || startup.description || '',
        category: prev.category || (startup.categories?.[0] ?? ''),
      }));
    }
  };

  // Arena handlers
  const handleRegisterStall = async () => {
    if (!user || !event) return;
    setRegisteringStall(true);
    setStallError(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}/stalls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stallForm),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setIsStallOwner(true);
        setMyStallId(json.stall?.id ?? null);
        setStalls(prev => [...prev, json.stall]);
        setStallForm({ stall_name: '', tagline: '', description: '', startup_id: '', category: '' });
      } else {
        setStallError(json.error || 'Failed to register stall');
      }
    } catch {
      setStallError('Network error');
    }
    setRegisteringStall(false);
  };

  const handleJoinAudience = async () => {
    if (!user || !event) return;
    setJoiningAudience(true);
    setAudienceError(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}/audience`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setIsAudience(true);
        setVirtualBalance(json.audience?.virtual_balance ?? event.virtual_fund_amount ?? 1000000);
      } else {
        setAudienceError(json.error || 'Failed to join');
      }
    } catch {
      setAudienceError('Network error');
    }
    setJoiningAudience(false);
  };

  const handleInvest = async (stallId: string) => {
    if (!user || !event) return;
    const amount = Number(investAmounts[stallId]);
    if (!amount || amount <= 0 || amount > virtualBalance) {
      setInvestError('Invalid amount');
      return;
    }
    setInvestingStall(stallId);
    setInvestError(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stall_id: stallId, amount }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setVirtualBalance(prev => prev - amount);
        setInvestAmounts(prev => ({ ...prev, [stallId]: '' }));
        // Refresh leaderboard
        const lbRes = await fetch(`/api/events/${encodeURIComponent(event.id)}/leaderboard`);
        if (lbRes.ok) {
          const lbJson = await lbRes.json();
          setLeaderboard(lbJson.leaderboard || []);
        }
      } else {
        setInvestError(json.error || 'Investment failed');
      }
    } catch {
      setInvestError('Network error');
    }
    setInvestingStall(null);
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    return amount.toLocaleString('en-IN');
  };

  const bannerUrl = useMemo(() => resolveBannerUrl(event?.banner_image_url), [event?.banner_image_url]);
  const isPast = event?.event_date ? Date.parse(event.event_date) < Date.now() : false;
  const isArena = event?.arena_enabled ?? false;

  const handleJoin = async () => {
    if (!user || !event) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setJoined(true);
        setParticipants(p => p + 1);
      } else if (json.alreadyJoined) {
        setJoined(true);
      } else {
        setJoinError(json.error || 'Failed to register');
      }
    } catch {
      setJoinError('Network error. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!user || !event) return;
    setUnjoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}/join`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setJoined(false);
        setParticipants(p => Math.max(0, p - 1));
      } else {
        setJoinError(json.error || 'Failed to leave');
      }
    } catch {
      setJoinError('Network error. Please try again.');
    } finally {
      setUnjoining(false);
    }
  };

  const handleToggleSave = async () => {
    if (!user || !event) return;
    setSavingBookmark(true);
    try {
      if (saved) {
        await supabase
          .from('saved_events')
          .delete()
          .eq('event_id', event.id)
          .eq('user_id', user.id);
        setSaved(false);
      } else {
        await supabase
          .from('saved_events')
          .insert({ event_id: event.id, user_id: user.id });
        setSaved(true);
      }
    } catch { }
    setSavingBookmark(false);
  };

  const share = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      navigator.share({ title: event?.title || 'Event', url }).catch(() => { });
    } else if (url) {
      navigator.clipboard.writeText(url).catch(() => { });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col flex-1 w-full h-full min-h-[calc(100vh-4rem)] py-4 md:py-6 px-4 sm:px-6 lg:px-8">
        {/* Header actions */}
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" className="rounded-xl bg-accent/30 hover:bg-accent/60 border border-border/50" onClick={() => router.back()} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          {user && (
            <Button
              variant="ghost" size="icon"
              className={`rounded-xl border border-border/50 transition-colors ${saved ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-300' : 'bg-accent/30 hover:bg-accent/60'}`}
              onClick={handleToggleSave}
              disabled={savingBookmark}
              aria-label={saved ? 'Unsave' : 'Save'}
            >
              {saved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="rounded-xl bg-accent/30 hover:bg-accent/60 border border-border/50" onClick={share} aria-label="Share">
            <Share2 className="h-5 w-5" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="animate-pulse h-48 md:h-56 rounded-2xl bg-muted/20 border border-border/60" />
            <div className="animate-pulse h-16 rounded-2xl bg-muted/20 border border-border/60" />
            <div className="animate-pulse h-32 rounded-2xl bg-muted/20 border border-border/60" />
          </div>
        ) : !event ? (
          <div className="text-center py-20 text-muted-foreground">Event not found.</div>
        ) : (
          <>
            {/* Banner */}
            <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-[160px] md:min-h-[220px]">
              {bannerUrl && (
                <Image src={bannerUrl} alt={event.title} fill className="object-cover" priority sizes="(max-width: 768px) 100vw, 1024px" />
              )}
              <div className="absolute inset-0 bg-black/35" />
              <div className="relative p-5 md:p-8">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {isArena && (
                    <span className="flex items-center gap-1 text-xs font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      <Trophy className="h-3 w-3 fill-current" /> Investment Arena
                    </span>
                  )}
                  {event.is_featured && (
                    <span className="flex items-center gap-1 text-xs font-bold bg-foreground text-background px-2 py-0.5 rounded-full">
                      <Star className="h-3 w-3 fill-current" /> Featured
                    </span>
                  )}
                  {event.category && (
                    <span className="text-xs font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full">
                      {categoryLabels[event.category] ?? event.category}
                    </span>
                  )}
                  {event.event_type && (
                    <span className="inline-block text-[11px] md:text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-muted/40 text-muted-foreground border-border">
                      {eventTypeLabels[event.event_type] || event.event_type}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white drop-shadow max-w-3xl">{event.title}</h1>
                {event.organizer_name && (
                  <p className="text-white/70 text-sm mt-1">by {event.organizer_name}</p>
                )}
                {(event.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(event.tags ?? []).slice(0, 5).map((tag) => (
                      <span key={tag} className="text-[10px] font-medium bg-white/10 text-white/80 px-1.5 py-0.5 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stats & CTA row */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {isPast ? (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full border text-rose-600 dark:text-rose-300 bg-rose-400/10 border-rose-500/30 dark:border-rose-400/30">
                    Past Event
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full border bg-muted/40 text-muted-foreground border-border">
                    Upcoming
                  </span>
                )}
                <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-card/70 border border-border/60">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Attendees: {participants}</span>
                </span>
                {event.event_date && (
                  <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-card/70 border border-border/60">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(event.event_date), 'dd MMM yyyy, hh:mm a')}</span>
                  </span>
                )}
                {event.location && (
                  <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-card/70 border border-border/60">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{event.location}</span>
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {event.event_url && (
                  <a
                    href={event.event_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-transparent text-foreground font-semibold px-5 py-3 transition active:scale-95 hover:bg-accent/60"
                  >
                    Visit Link
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                {!isPast && (
                  <>
                    {joined ? (
                      <>
                        <span className="inline-flex items-center gap-2 rounded-xl font-semibold px-5 py-3 border bg-muted/30 text-foreground border-border">
                          <CheckCircle className="h-4 w-4" />
                          Registered
                        </span>
                        <button
                          onClick={handleLeave}
                          disabled={unjoining}
                          className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold px-4 py-3 transition active:scale-95 border border-red-400/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"
                          title="Leave event"
                        >
                          {unjoining ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <LogOut className="h-4 w-4" />
                          )}
                          {unjoining ? 'Leaving...' : 'Leave'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleJoin}
                        disabled={joining || checkingJoin}
                        className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold px-5 py-3 transition active:scale-95 border bg-primary hover:bg-primary/90 text-primary-foreground border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {checkingJoin ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : joining ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Registering...
                          </>
                        ) : (
                          'Register for Event'
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {joinError && (
              <p className="mt-2 text-sm text-red-500">{joinError}</p>
            )}

            {/* About section */}
            <div className="mt-6 rounded-2xl border border-border/60 bg-card/70 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold"
                onClick={() => setAboutOpen(o => !o)}
              >
                <span>About this event</span>
                <ChevronDown className={`h-5 w-5 transition-transform ${aboutOpen ? 'rotate-180' : ''}`} />
              </button>
              {aboutOpen && (
                <div className="px-5 pb-5 text-muted-foreground whitespace-pre-wrap">
                  {event.description || 'No description provided.'}
                </div>
              )}
            </div>

            {/* ─── Investment Arena ─── */}
            {isArena && (
              <div className="mt-6 space-y-6">
                {/* Arena Header */}
                <div className="rounded-2xl border-2 border-border bg-muted/20 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-lg font-bold">Startup Investment Arena</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {event.arena_round === 'registration' && (
                      <>Round 1 is open — {event.entry_type === 'startup' ? 'Startups' : 'Project creators'} can register their stalls!</>
                    )}
                    {event.arena_round === 'investment' && (
                      <>Round 2 is live — Audience members can invest virtual funds in their favorite stalls!</>
                    )}
                    {event.arena_round === 'completed' && (
                      <>The arena has concluded! Check out the final results below.</>
                    )}
                  </p>

                  {/* Arena Stats */}
                  <div className="flex flex-wrap gap-3 mt-3">
                    <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-muted/30 text-muted-foreground border border-border">
                      <Store className="h-3.5 w-3.5" /> {arenaStats.total_stalls} Stalls
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      <Users className="h-3.5 w-3.5" /> {arenaStats.total_audience} Investors
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      <IndianRupee className="h-3.5 w-3.5" /> {formatCurrency(arenaStats.total_invested)} Invested
                    </span>
                  </div>
                </div>

                {/* Round 1: Stall Registration */}
                {event.arena_round === 'registration' && user && !isStallOwner && (
                  <div className="rounded-2xl border border-border/60 bg-card/70 p-5">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground" />
                      Register Your {event.entry_type === 'startup' ? 'Startup' : 'Project'} Stall
                    </h3>
                    <div className="space-y-3">
                      <input
                        placeholder={event.entry_type === 'startup' ? 'Startup Name' : 'Project Name'}
                        value={stallForm.stall_name}
                        onChange={e => setStallForm(prev => ({ ...prev, stall_name: e.target.value }))}
                        className="w-full rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
                      />
                      <input
                        placeholder="One-line tagline"
                        value={stallForm.tagline}
                        onChange={e => setStallForm(prev => ({ ...prev, tagline: e.target.value }))}
                        className="w-full rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
                      />
                      <textarea
                        placeholder="Describe your idea, product, and market opportunity..."
                        value={stallForm.description}
                        onChange={e => setStallForm(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className="w-full rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm outline-none focus:border-primary resize-none"
                      />
                      {/* Link to existing startup */}
                      {event.entry_type === 'startup' && (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Link Your Startup</label>
                          {loadingStartups ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                              <Loader2 className="h-4 w-4 animate-spin" /> Loading your startups...
                            </div>
                          ) : userStartups.length > 0 ? (
                            <select
                              value={stallForm.startup_id}
                              onChange={e => handleStartupSelect(e.target.value)}
                              className="w-full rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
                            >
                              <option value="">Select your startup (auto-fills details)</option>
                              {userStartups.map(s => (
                                <option key={s.id} value={s.id}>{s.brand_name} — {s.stage}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-xs text-muted-foreground py-1">No startups found on your profile. Fill in the details manually below.</p>
                          )}
                        </div>
                      )}

                      <select
                        value={stallForm.category}
                        onChange={e => setStallForm(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
                      >
                        <option value="">Select Category</option>
                        <option value="fintech">FinTech</option>
                        <option value="ai">AI / ML</option>
                        <option value="healthtech">HealthTech</option>
                        <option value="edtech">EdTech</option>
                        <option value="climatetech">ClimateTech</option>
                        <option value="ecommerce">E-Commerce</option>
                        <option value="saas">SaaS</option>
                        <option value="social">Social</option>
                        <option value="other">Other</option>
                      </select>
                      {stallError && <p className="text-sm text-red-500">{stallError}</p>}
                      <button
                        onClick={handleRegisterStall}
                        disabled={registeringStall || !stallForm.stall_name.trim()}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 py-2.5 text-sm transition disabled:opacity-50"
                      >
                        {registeringStall ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
                        {registeringStall ? 'Registering...' : 'Register Stall'}
                      </button>
                    </div>
                  </div>
                )}

                {event.arena_round === 'registration' && isStallOwner && (
                  <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-muted-foreground" />
                      <p className="font-semibold text-foreground">
                        Your stall is registered! Wait for Round 2 (Investment) to begin.
                      </p>
                    </div>
                    {myStallId && (
                      <div className="pt-1">
                        <p className="text-xs text-muted-foreground mb-2">Your QR code is ready. Audience can scan it to invest once Round 2 starts.</p>
                        <StallQRCode eventId={event.id} stallId={myStallId} stallName={stalls.find(s => s.id === myStallId)?.stall_name || 'My Stall'} startupId={stalls.find(s => s.id === myStallId)?.startup_id} />
                      </div>
                    )}
                  </div>
                )}

                {/* Round 2: Audience Investment */}
                {event.arena_round === 'investment' && user && !isStallOwner && !isAudience && (
                  <div className="rounded-2xl border border-border/60 bg-card/70 p-5 text-center">
                    <Wallet className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    <h3 className="font-semibold mb-1">Join as Investor</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Receive <strong>₹{(event.virtual_fund_amount ?? 1000000).toLocaleString('en-IN')}</strong> virtual cash and invest in your favorite {event.entry_type === 'startup' ? 'startups' : 'projects'}!
                    </p>
                    {audienceError && <p className="text-sm text-red-500 mb-2">{audienceError}</p>}
                    <button
                      onClick={handleJoinAudience}
                      disabled={joiningAudience}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 text-sm transition disabled:opacity-50"
                    >
                      {joiningAudience ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                      {joiningAudience ? 'Joining...' : 'Join & Get Virtual Cash'}
                    </button>
                  </div>
                )}

                {event.arena_round === 'investment' && isStallOwner && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-5 space-y-3">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      <strong>Investment round is live!</strong> Show your QR code to the audience so they can scan and invest in your stall!
                    </p>
                    {myStallId && (
                      <StallQRCode eventId={event.id} stallId={myStallId} stallName={stalls.find(s => s.id === myStallId)?.stall_name || 'My Stall'} startupId={stalls.find(s => s.id === myStallId)?.startup_id} />
                    )}
                  </div>
                )}

                {/* Investor Balance (shown during investment round for audience) */}
                {event.arena_round === 'investment' && isAudience && (
                  <div className="space-y-4">
                    {/* Balance Card */}
                    <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Your Virtual Balance</p>
                          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <IndianRupee className="h-5 w-5" />
                            {virtualBalance.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <Wallet className="h-8 w-8 text-emerald-500/50" />
                      </div>
                      {virtualBalance === 0 && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">You have invested all your funds!</p>
                      )}
                    </div>

                    {investError && <p className="text-sm text-red-500">{investError}</p>}

                    {/* Stall Browse Cards — click to open detail */}
                    <h3 className="font-semibold flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      Browse {event.entry_type === 'startup' ? 'Startup' : 'Project'} Stalls — Tap to explore & invest
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {stalls.map(stall => {
                        const stallFunding = leaderboard.find(l => l.id === stall.id);
                        return (
                          <button
                            key={stall.id}
                            type="button"
                            onClick={() => setOpenStallId(stall.id)}
                            className="rounded-2xl border border-border/60 bg-card/70 p-4 text-left transition hover:border-emerald-500/50 hover:shadow-md active:scale-[0.98] space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-foreground">{stall.stall_name}</h4>
                              {stall.category && (
                                <span className="text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full capitalize">
                                  {stall.category}
                                </span>
                              )}
                            </div>
                            {stall.tagline && <p className="text-xs text-muted-foreground">{stall.tagline}</p>}
                            {stall.startup && (
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                Linked: {stall.startup.brand_name} ({stall.startup.stage})
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs pt-1">
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                ₹{formatCurrency(stallFunding?.total_funding ?? 0)} funded
                              </span>
                              <span className="text-muted-foreground">
                                {stallFunding?.investor_count ?? 0} investors
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* ── Stall Detail Modal ── */}
                    {openStallId && (() => {
                      const stall = stalls.find(s => s.id === openStallId);
                      if (!stall) return null;
                      const stallFunding = leaderboard.find(l => l.id === stall.id);
                      return (
                        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                          {/* Backdrop */}
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpenStallId(null)} />

                          {/* Modal */}
                          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-border/60 bg-background shadow-2xl mx-auto">
                            {/* Header */}
                            <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/40 px-5 py-4 flex items-center justify-between z-10">
                              <h3 className="text-lg font-bold text-foreground truncate pr-4">{stall.stall_name}</h3>
                              <button onClick={() => setOpenStallId(null)} className="shrink-0 rounded-full p-1.5 hover:bg-muted/20 transition">
                                <X className="h-5 w-5" />
                              </button>
                            </div>

                            <div className="px-5 py-4 space-y-5">
                              {/* Category & Startup badge */}
                              <div className="flex flex-wrap items-center gap-2">
                                {stall.category && (
                                  <span className="text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full capitalize">
                                    {stall.category}
                                  </span>
                                )}
                                {stall.startup && (
                                  <a
                                    href={`/startups/${stall.startup.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full hover:underline"
                                  >
                                    <Store className="h-3 w-3" />
                                    {stall.startup.brand_name} — {stall.startup.stage}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>

                              {/* Tagline */}
                              {stall.tagline && (
                                <p className="text-sm font-medium text-foreground/80 italic">&ldquo;{stall.tagline}&rdquo;</p>
                              )}

                              {/* Full description */}
                              {stall.description && (
                                <div>
                                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">About</h4>
                                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{stall.description}</p>
                                </div>
                              )}

                              {/* Startup website link */}
                              {stall.startup?.website && (
                                <a
                                  href={stall.startup.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" /> Visit Website
                                </a>
                              )}

                              {/* Funding stats */}
                              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
                                <div className="grid grid-cols-2 gap-4 text-center">
                                  <div>
                                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                      ₹{formatCurrency(stallFunding?.total_funding ?? 0)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Total Funding</p>
                                  </div>
                                  <div>
                                    <p className="text-2xl font-bold text-foreground">
                                      {stallFunding?.investor_count ?? 0}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Investors</p>
                                  </div>
                                </div>
                              </div>

                              {/* Investment section */}
                              {virtualBalance > 0 ? (
                                <div className="rounded-xl border border-border/60 bg-card/70 p-4 space-y-3">
                                  <h4 className="text-sm font-semibold">Invest in this {event.entry_type === 'startup' ? 'startup' : 'project'}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    Your balance: <strong className="text-emerald-600 dark:text-emerald-400">₹{virtualBalance.toLocaleString('en-IN')}</strong>
                                  </p>

                                  {/* Quick amount buttons */}
                                  <div className="flex flex-wrap gap-2">
                                    {[50000, 100000, 200000, 500000].filter(a => a <= virtualBalance).map(amount => (
                                      <button
                                        key={amount}
                                        type="button"
                                        onClick={() => setInvestAmounts(prev => ({ ...prev, [stall.id]: String(amount) }))}
                                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                          investAmounts[stall.id] === String(amount)
                                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                            : 'border-border/60 text-muted-foreground hover:border-emerald-500/50'
                                        }`}
                                      >
                                        ₹{formatCurrency(amount)}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => setInvestAmounts(prev => ({ ...prev, [stall.id]: String(virtualBalance) }))}
                                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                        investAmounts[stall.id] === String(virtualBalance)
                                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                          : 'border-border/60 text-muted-foreground hover:border-amber-500/50'
                                      }`}
                                    >
                                      All In
                                    </button>
                                  </div>

                                  {/* Custom amount input */}
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-2.5">
                                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                                      <input
                                        type="number"
                                        placeholder="Enter custom amount"
                                        value={investAmounts[stall.id] || ''}
                                        onChange={e => setInvestAmounts(prev => ({ ...prev, [stall.id]: e.target.value }))}
                                        min={1}
                                        max={virtualBalance}
                                        className="flex-1 bg-transparent text-sm outline-none"
                                      />
                                    </div>
                                    <button
                                      onClick={() => {
                                        handleInvest(stall.id);
                                      }}
                                      disabled={investingStall === stall.id || !investAmounts[stall.id]}
                                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 text-sm transition disabled:opacity-50 whitespace-nowrap flex items-center gap-2"
                                    >
                                      {investingStall === stall.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <IndianRupee className="h-4 w-4" />
                                      )}
                                      {investingStall === stall.id ? 'Investing...' : 'Invest Now'}
                                    </button>
                                  </div>
                                  {investError && <p className="text-xs text-red-500">{investError}</p>}
                                </div>
                              ) : (
                                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 text-center">
                                  <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                                    You have invested all your virtual funds!
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Live Leaderboard — cards are clickable, link to startup profile with arena context */}
                {leaderboard.length > 0 && (event.arena_round === 'investment' || event.arena_round === 'completed') && (
                  <div className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden">
                    <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-emerald-500" />
                      <h3 className="font-semibold">
                        {event.arena_round === 'completed' ? 'Final Results' : 'Live Funding Leaderboard'}
                      </h3>
                      {event.arena_round === 'investment' && isAudience && (
                        <span className="ml-auto text-xs text-muted-foreground">Tap to view & invest</span>
                      )}
                    </div>
                    <div className="divide-y divide-border/40">
                      {leaderboard.map((entry, i) => {
                        const linkedStall = stalls.find(s => s.id === entry.id);
                        const startupId = linkedStall?.startup_id || linkedStall?.startup?.id;
                        const href = startupId
                          ? `/startups/${startupId}?fromArena=1&eventId=${encodeURIComponent(event.id)}&stallId=${encodeURIComponent(entry.id)}`
                          : null;

                        const inner = (
                          <>
                            <span className={`text-lg font-bold w-8 text-center shrink-0 ${i === 0 ? 'text-emerald-500' : i === 1 ? 'text-emerald-400' : i === 2 ? 'text-emerald-300' : 'text-muted-foreground'}`}>
                              {i + 1}
                            </span>
                            {entry.logo_url ? (
                              <div className="h-10 w-10 shrink-0 rounded-xl overflow-hidden border border-border/40 bg-muted/10">
                                <Image src={resolveBannerUrl(entry.logo_url) || entry.logo_url} alt={entry.stall_name} width={40} height={40} className="h-full w-full object-cover" />
                              </div>
                            ) : (
                              <div className="h-10 w-10 shrink-0 rounded-xl border border-border/40 bg-muted/10 flex items-center justify-center">
                                <Store className="h-5 w-5 text-muted-foreground/50" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground truncate">{entry.stall_name}</p>
                              {entry.tagline && <p className="text-xs text-muted-foreground truncate">{entry.tagline}</p>}
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-foreground">
                                ₹{formatCurrency(entry.total_funding)}
                              </p>
                              <p className="text-xs text-muted-foreground">{entry.investor_count} investors</p>
                            </div>
                          </>
                        );

                        return href ? (
                          <Link
                            key={entry.id}
                            href={href}
                            className={`flex items-center gap-4 px-5 py-3 transition hover:bg-accent/40 active:scale-[0.99] cursor-pointer ${i === 0 ? 'bg-emerald-500/5' : ''}`}
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div key={entry.id} className={`flex items-center gap-4 px-5 py-3 ${i === 0 ? 'bg-emerald-500/5' : ''}`}>
                            {inner}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Stalls List (visible during registration round) */}
                {event.arena_round === 'registration' && stalls.length > 0 && (
                  <div className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden">
                    <div className="px-5 py-4 border-b border-border/60">
                      <h3 className="font-semibold">Registered Stalls ({stalls.length})</h3>
                    </div>
                    <div className="divide-y divide-border/40">
                      {stalls.map(stall => (
                        <div key={stall.id} className="px-5 py-3 flex items-center gap-3">
                          <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground truncate">{stall.stall_name}</p>
                            {stall.tagline && <p className="text-xs text-muted-foreground truncate">{stall.tagline}</p>}
                          </div>
                          {stall.category && (
                            <span className="text-[10px] font-medium bg-muted/20 text-muted-foreground px-2 py-0.5 rounded-full">
                              {stall.category}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Attendees count card */}
            <div className="mt-6">
              <h3 className="text-lg md:text-xl font-bold">Attendees ({participants})</h3>
              {participants === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">Be the first to register for this event!</p>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
