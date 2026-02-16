"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';
import { ArrowLeft, Share2, Users, Clock, MapPin, ExternalLink, ChevronDown, Calendar, User, CheckCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toProxyUrl } from '@/utils/imageUtils';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/context/AuthContext';

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
};

// Resolve a banner URL that might be a storage path
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
  if (/^https?:\/\//i.test(raw)) return toProxyUrl(raw);
  const buckets = ['media', 'public', 'banners', 'images'];
  for (const bucket of buckets) {
    try {
      const path = raw.startsWith(bucket + '/') ? raw.slice(bucket.length + 1) : raw;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (data?.publicUrl) return toProxyUrl(data.publicUrl);
    } catch {}
  }
  if (raw.startsWith('/storage/v1/object/public/')) {
    const full = `${location.origin}${raw}`;
    return toProxyUrl(full);
  }
  return null;
}

const eventTypeLabels: Record<string, string> = {
  online: 'Online',
  'in-person': 'In-Person',
  hybrid: 'Hybrid',
};

const eventTypeColors: Record<string, string> = {
  online: 'text-blue-700 dark:text-blue-300 bg-blue-400/10 border-blue-500/30 dark:border-blue-400/30',
  'in-person': 'text-purple-700 dark:text-purple-300 bg-purple-400/10 border-purple-500/30 dark:border-purple-400/30',
  hybrid: 'text-amber-700 dark:text-amber-300 bg-amber-400/10 border-amber-500/30 dark:border-amber-400/30',
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
  const [organizerName, setOrganizerName] = useState<string | null>(null);

  // Join state
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [checkingJoin, setCheckingJoin] = useState(true);

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

        // Fetch organizer name
        if (json.data?.created_by) {
          try {
            const userRes = await fetch(`/api/users/by-id/${encodeURIComponent(json.data.created_by)}`, { cache: 'no-store' });
            const userJson = await userRes.json();
            if (!cancelled && userJson?.data) {
              setOrganizerName(userJson.data.full_name || userJson.data.username || null);
            }
          } catch {}
        }
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

  // Check if user already joined this event
  useEffect(() => {
    if (!id || !user) {
      setCheckingJoin(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setCheckingJoin(true);
      try {
        const { data } = await supabase
          .from('event_participants')
          .select('id')
          .eq('event_id', id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled) setJoined(!!data);
      } catch {
        // Silently fail — user just won't see "Joined" state
      } finally {
        if (!cancelled) setCheckingJoin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, user]);

  const bannerUrl = useMemo(() => resolveBannerUrl(event?.banner_image_url), [event?.banner_image_url]);

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
        setJoinError(json.error || 'Failed to join');
      }
    } catch {
      setJoinError('Network error. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const share = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      navigator.share({ title: event?.title || 'Event', url }).catch(() => {});
    } else if (url) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  const isPast = event?.event_date ? Date.parse(event.event_date) < Date.now() : false;

  return (
    <DashboardLayout>
      <div className="flex flex-col flex-1 w-full h-full min-h-[calc(100vh-4rem)] py-4 md:py-6 px-4 sm:px-6 lg:px-8">
        {/* Header actions */}
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" className="rounded-xl bg-accent/30 hover:bg-accent/60 border border-border/50" onClick={() => router.back()} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
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
              <div className="relative p-5 md:p-8 flex items-end min-h-[160px] md:min-h-[220px]">
                <div>
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white drop-shadow max-w-3xl">{event.title}</h1>
                  {event.event_type && (
                    <span className={`inline-block mt-2 text-[11px] md:text-xs font-semibold px-2.5 py-0.5 rounded-full border ${eventTypeColors[event.event_type] || ''}`}>
                      {eventTypeLabels[event.event_type] || event.event_type}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats & CTA row */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {isPast ? (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full border text-amber-600 dark:text-amber-300 bg-amber-400/10 border-amber-500/30 dark:border-amber-400/30">
                    Past Event
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full border text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 border-emerald-500/30 dark:border-emerald-400/30">
                    Upcoming
                  </span>
                )}
                <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-card/70 border border-border/60">
                  <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                  <span>Participants: {participants}</span>
                </span>
                {event.event_date && (
                  <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-card/70 border border-border/60">
                    <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    <span>{format(new Date(event.event_date), 'dd MMM yyyy, hh:mm a')}</span>
                  </span>
                )}
                {event.location && (
                  <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-card/70 border border-border/60">
                    <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    <span>{event.location}</span>
                  </span>
                )}
                {organizerName && (
                  <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-card/70 border border-border/60">
                    <User className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    <span>Organizer: {organizerName}</span>
                  </span>
                )}
              </div>

              {/* Join / Visit button */}
              <div className="flex items-center gap-3">
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
                  <button
                    onClick={handleJoin}
                    disabled={joined || joining || checkingJoin || !user}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold px-5 py-3 transition active:scale-95 border ${
                      joined
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400/40 cursor-default'
                        : 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500/90 dark:hover:bg-emerald-500 text-white border-emerald-400/40 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                    title={!user ? 'Sign in to join' : undefined}
                  >
                    {checkingJoin ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : joined ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Joined
                      </>
                    ) : joining ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      'Join Event'
                    )}
                  </button>
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
