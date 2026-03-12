"use client";
import React, { Suspense } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import Image from 'next/image';
import { Users, Clock, Trophy, ArrowRight, MapPin, Briefcase, DollarSign, Zap, ExternalLink, Loader2, CheckCircle, Eye, Sparkles, Star, Search, SlidersHorizontal, X as XIcon, Package, FolderOpen, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase';
import { toProxyUrl } from '@/utils/imageUtils';

// Local util: determine if a competition/event has ended
function isEnded(c: { deadline?: string | null; event_date?: string | null }) {
  const raw = c?.deadline || c?.event_date;
  if (!raw) return false;
  const t = Date.parse(raw);
  return isFinite(t) && t < Date.now();
}

// --- Tab types ---
type TabKey = 'events' | 'jobs' | 'resources';

// Sub-category keys inside the Events tab
type EventCategoryKey = 'all' | 'competitions' | 'events' | 'meetups' | 'workshops';

const EVENT_CATEGORIES: { key: EventCategoryKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'competitions', label: 'Competitions' },
  { key: 'events', label: 'Events' },
  { key: 'meetups', label: 'Meetups' },
  { key: 'workshops', label: 'Workshops' },
];

// --- Data types ---
type CompetitionItem = {
  id: string;
  title: string;
  description?: string | null;
  deadline?: string | null;
  is_external?: boolean;
  external_url?: string | null;
  prize_pool?: string | null;
  banner_image_url?: string | null;
  // Extended fields
  tags?: string[];
  is_featured?: boolean;
  domain?: string | null;
  organizer_name?: string | null;
  participation_type?: string;
  team_size_min?: number;
  team_size_max?: number;
  participant_count?: number;
};

type EventItem = {
  id: string;
  title: string;
  description?: string | null;
  event_date?: string | null;
  location?: string | null;
  event_url?: string | null;
  banner_image_url?: string | null;
  event_type: string;
  category?: string | null; // 'event' | 'meetup' | 'workshop' | 'conference' | 'seminar'
  is_active: boolean;
  created_at: string;
  // Extended fields
  tags?: string[];
  is_featured?: boolean;
  organizer_name?: string | null;
};

type JobItem = {
  id: string;
  title: string;
  company: string;
  description?: string | null;
  location?: string | null;
  salary_range?: string | null;
  job_type: string;
  deadline?: string | null;
  is_active: boolean;
  created_at: string;
  visibility?: string | null;
  facilitator_id?: string | null;
};

type GigItem = {
  id: string;
  title: string;
  description?: string | null;
  budget?: string | null;
  duration?: string | null;
  skills_required?: string[];
  deadline?: string | null;
  is_active: boolean;
  created_at: string;
  visibility?: string | null;
  facilitator_id?: string | null;
};

type ResourceItem = {
  id: string;
  title: string;
  description?: string | null;
  url?: string | null;
  icon?: string | null;
  logo_url?: string | null;
  category: string;
  provider?: string | null;
  eligibility?: string | null;
  deadline?: string | null;
  tags?: string[];
  metadata?: Record<string, string>;
};

type OrganizationResourceItem = {
  id: string;
  slug: string;
  name: string;
  org_type: string;
  short_bio?: string | null;
  website?: string | null;
  logo_url?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  is_verified?: boolean;
  sectors?: string[];
  support_types?: string[];
};

const RESOURCE_CATEGORIES = [
  { key: 'All', label: 'All' },
  { key: 'Organizations', label: 'Startup Facilitators' },
  { key: 'accelerator_incubator', label: 'Accelerators' },
  { key: 'company_offer', label: 'Company Offers' },
  { key: 'tool', label: 'Tools' },
  { key: 'bank_offer', label: 'Bank Offers' },
  { key: 'scheme', label: 'Schemes' },
];

const categoryLabels: Record<string, string> = {
  govt_scheme: 'Govt Scheme',
  accelerator_incubator: 'Accelerator / Incubator',
  company_offer: 'Company Offer',
  tool: 'Tool',
  bank_offer: 'Bank Offer',
  scheme: 'Scheme',
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
  if (raw.includes('/storage/v1/object/public/')) return raw;
  if (raw.startsWith('http')) return toProxyUrl(raw);
  try {
    const { data } = supabase.storage.from('media').getPublicUrl(raw);
    if (data?.publicUrl) return data.publicUrl;
  } catch { }
  return null;
}

// --- Shared UI components ---

const PillTabs = ({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) => {
  const base = 'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap';
  const inactive = 'text-muted-foreground hover:text-accent-foreground hover:bg-accent/70';
  const activeCls = 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40 dark:border-emerald-400/30 shadow-[inset_0_0_0_1px_rgba(16,185,129,.3)]';
  return (
    <div className="inline-flex items-center gap-2 bg-card/60 border border-border/60 p-2 rounded-2xl backdrop-blur-sm overflow-x-auto">
      <button className={`${base} ${active === 'events' ? activeCls : inactive}`} onClick={() => onChange('events')}>Events</button>
      <button className={`${base} ${active === 'jobs' ? activeCls : inactive}`} onClick={() => onChange('jobs')}>Jobs & Gigs</button>
      <button className={`${base} ${active === 'resources' ? activeCls : inactive}`} onClick={() => onChange('resources')}>Resources</button>
    </div>
  );
};

const Stat = ({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-300/90" />
    <span>{children}</span>
  </div>
);

// --- Competition cards (updated with working Join + click navigation) ---

const domainLabels: Record<string, string> = {
  hackathon: 'Hackathon', case_study: 'Case Study', quiz: 'Quiz', design: 'Design',
  coding: 'Coding', business_plan: 'Business Plan', research: 'Research',
  marketing: 'Marketing', other: 'Other',
};

const FeaturedCompetitionCard = ({ c, user }: { c: CompetitionItem; user: { id: string } | null }) => {

  const ended = isEnded(c);
  const deadlineLabel = c.deadline ? (ended ? 'Ended' : format(new Date(c.deadline), 'dd MMM, yyyy')) : 'Open';

  const [joined, setJoined] = useState(false);
  const [checkingJoin, setCheckingJoin] = useState(true);
  const [participantCount, setParticipantCount] = useState<number | null>(c.participant_count ?? null);

  // Check if user already joined + get participant count
  useEffect(() => {
    if (!user) { setCheckingJoin(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [entryRes, countRes] = await Promise.all([
          supabase
            .from('competition_entries')
            .select('submitted_by')
            .eq('competition_id', c.id)
            .eq('submitted_by', user.id)
            .maybeSingle(),
          supabase
            .from('competition_entries')
            .select('*', { count: 'exact', head: true })
            .eq('competition_id', c.id),
        ]);
        if (!cancelled) {
          setJoined(!!entryRes.data);
          setParticipantCount(countRes.count ?? 0);
        }
      } catch { }
      if (!cancelled) setCheckingJoin(false);
    })();
    return () => { cancelled = true; };
  }, [c.id, user]);

  return (
    <Link href={`/hub/${encodeURIComponent(c.id)}`} className="block rounded-2xl overflow-hidden bg-card/70 border border-border/60 shadow-sm hover:shadow-md transition-shadow">
      {/* Banner */}
      <div className="relative h-44 sm:h-56 md:h-64 w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {(() => {
          const url = resolveBannerUrl(c.banner_image_url);
          return url ? (
            <Image src={url} alt={c.title} fill className="object-cover" priority sizes="(max-width: 768px) 100vw, 1024px" />
          ) : null;
        })()}
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex items-end md:items-center justify-start p-5 md:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {c.is_featured && (
                <span className="flex items-center gap-1 text-xs font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                  <Star className="h-3 w-3 fill-white" /> Featured
                </span>
              )}
              {c.domain && (
                <span className="text-xs font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full">
                  {domainLabels[c.domain] ?? c.domain}
                </span>
              )}
              {c.participation_type === 'team' && (
                <span className="text-xs font-semibold bg-emerald-500/70 text-white px-2 py-0.5 rounded-full">
                  Team ({c.team_size_min}–{c.team_size_max})
                </span>
              )}
            </div>
            <div className="text-white/95 text-xl md:text-2xl font-extrabold drop-shadow">{c.title}</div>
            {c.organizer_name && (
              <p className="text-slate-200/70 text-xs mt-0.5">by {c.organizer_name}</p>
            )}
            {c.description && (
              <p className="text-slate-200/80 text-xs md:text-sm mt-1 line-clamp-2 max-w-2xl">{c.description}</p>
            )}
            {(c.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(c.tags ?? []).slice(0, 4).map((tag) => (
                  <span key={tag} className="text-[10px] font-medium bg-white/10 text-white/80 px-1.5 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="absolute inset-0 ring-1 ring-white/10 rounded-b-2xl"></div>
      </div>
      {/* Content */}
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Stat icon={Users}>{participantCount !== null ? `${participantCount} participants` : '—'}</Stat>
          <Stat icon={Clock}>{deadlineLabel}</Stat>
          {c.prize_pool && <Stat icon={Trophy}>{c.prize_pool}</Stat>}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="flex-1 md:flex-none md:min-w-[120px] inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-transparent text-foreground px-4 py-2.5 text-sm font-semibold hover:bg-accent/60 active:scale-95 transition">
            Details
          </span>
          <span
            className={`flex-1 md:flex-none md:min-w-[120px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-95 transition ${joined
              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40'
              : ended
                ? 'bg-muted text-muted-foreground border border-border/60'
                : 'bg-emerald-600 dark:bg-emerald-500/90 text-white hover:bg-emerald-700 dark:hover:bg-emerald-500'
              }`}
          >
            {checkingJoin ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : joined ? (
              <><CheckCircle className="h-4 w-4" /> Joined</>
            ) : ended ? (
              <>Ended</>
            ) : (
              <>Join <ArrowRight className="h-4 w-4" /></>
            )}
          </span>
        </div>
      </div>

    </Link>
  );
};

const CompetitionRowCard = ({ c, user }: { c: CompetitionItem; user: { id: string } | null }) => {

  const ended = isEnded(c);

  const [joined, setJoined] = useState(false);
  const [checkingJoin, setCheckingJoin] = useState(true);

  useEffect(() => {
    if (!user) { setCheckingJoin(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('competition_entries')
          .select('submitted_by')
          .eq('competition_id', c.id)
          .eq('submitted_by', user.id)
          .maybeSingle();
        if (!cancelled) setJoined(!!data);
      } catch { }
      if (!cancelled) setCheckingJoin(false);
    })();
    return () => { cancelled = true; };
  }, [c.id, user]);

  return (
    <Link href={`/hub/${encodeURIComponent(c.id)}`} className="block rounded-2xl bg-card/70 border border-border/60 hover:bg-card/80 transition">
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative h-36 sm:h-24 w-full sm:w-32 rounded-xl overflow-hidden flex-shrink-0 bg-muted/40">
          {(() => {
            const url = resolveBannerUrl(c.banner_image_url);
            return url ? (
              <Image src={url} alt={c.title} fill className="object-cover" sizes="(max-width: 640px) 100vw, 160px" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/30"><Trophy className="h-5 w-5 text-muted-foreground/40" /></div>
            );
          })()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {c.is_featured && <Star className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500 shrink-0" />}
            <h4 className="text-base sm:text-lg font-semibold text-foreground truncate">{c.title}</h4>
            <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 bg-orange-400/10 border border-orange-500/30 dark:border-orange-400/30 px-2.5 py-0.5 rounded-full shrink-0">
              Competition
            </span>
            {c.domain && (
              <span className="text-xs font-medium bg-violet-400/10 text-violet-700 dark:text-violet-300 border border-violet-400/30 px-2 py-0.5 rounded-full shrink-0">
                {domainLabels[c.domain] ?? c.domain}
              </span>
            )}
            {ended ? (
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-300 bg-rose-400/10 border border-rose-500/30 dark:border-rose-400/30 px-2.5 py-0.5 rounded-full shrink-0">Ended</span>
            ) : (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 border border-emerald-500/30 dark:border-emerald-400/30 px-2.5 py-0.5 rounded-full shrink-0">Active</span>
            )}
          </div>
          {c.organizer_name && (
            <p className="text-xs text-muted-foreground mt-0.5">by {c.organizer_name}</p>
          )}
          {c.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{c.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 sm:gap-4">
            {c.deadline && (
              <Stat icon={Clock}>{ended ? 'Ended' : format(new Date(c.deadline), 'dd MMM, yyyy')}</Stat>
            )}
            {c.prize_pool && <Stat icon={Trophy}>{c.prize_pool}</Stat>}
            {c.participation_type === 'team' && (
              <Stat icon={Users}>Team ({c.team_size_min}–{c.team_size_max})</Stat>
            )}
          </div>
          {(c.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(c.tags ?? []).slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] font-medium bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex sm:flex-col gap-2 justify-center sm:justify-center">
          <span
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 sm:px-3 sm:py-2 text-sm font-semibold transition w-full sm:w-auto ${joined
              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40'
              : ended
                ? 'bg-muted text-muted-foreground border border-border/60'
                : 'bg-emerald-600 dark:bg-emerald-500/90 text-white'
              }`}
          >
            {checkingJoin ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : joined ? (
              <><CheckCircle className="h-4 w-4" /> Joined</>
            ) : ended ? (
              <>Ended</>
            ) : (
              <>Join <ArrowRight className="h-4 w-4" /></>
            )}
          </span>
        </div>
      </div>

    </Link>
  );
};

// --- Event row card ---

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  event: 'Event', meetup: 'Meetup', workshop: 'Workshop', conference: 'Conference', seminar: 'Seminar',
};

const EventRowCard = ({ event, user }: { event: EventItem; user: { id: string } | null }) => {

  const ended = isEnded(event);
  const categoryLabel = EVENT_CATEGORY_LABELS[event.category ?? 'event'] ?? 'Event';

  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [checkingJoin, setCheckingJoin] = useState(true);

  useEffect(() => {
    if (!user) { setCheckingJoin(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('event_participants')
          .select('user_id')
          .eq('event_id', event.id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled) setJoined(!!data);
      } catch { }
      if (!cancelled) setCheckingJoin(false);
    })();
    return () => { cancelled = true; };
  }, [event.id, user]);

  const handleJoin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || ended) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setJoined(true);
      } else if (json.alreadyJoined) {
        setJoined(true);
      }
    } catch { }
    setJoining(false);
  };

  return (
    <Link href={`/hub/event/${encodeURIComponent(event.id)}`} className="block rounded-2xl bg-card/70 border border-border/60 hover:bg-card/80 transition">
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative h-36 sm:h-24 w-full sm:w-32 rounded-xl overflow-hidden flex-shrink-0 bg-muted/40">
          {(() => {
            const url = resolveBannerUrl(event.banner_image_url);
            return url ? (
              <Image src={url} alt={event.title} fill className="object-cover" sizes="(max-width: 640px) 100vw, 160px" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/30"><Trophy className="h-5 w-5 text-muted-foreground/40" /></div>
            );
          })()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {event.is_featured && <Star className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500 shrink-0" />}
            <h4 className="text-base sm:text-lg font-semibold text-foreground truncate">{event.title}</h4>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 border border-emerald-500/30 dark:border-emerald-400/30 px-2.5 py-0.5 rounded-full shrink-0">
              {categoryLabel}
            </span>
            {ended ? (
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-300 bg-rose-400/10 border border-rose-500/30 dark:border-rose-400/30 px-2.5 py-0.5 rounded-full shrink-0">Ended</span>
            ) : (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 border border-emerald-500/30 dark:border-emerald-400/30 px-2.5 py-0.5 rounded-full shrink-0">Upcoming</span>
            )}
          </div>
          {event.organizer_name && (
            <p className="text-xs text-muted-foreground mt-0.5">by {event.organizer_name}</p>
          )}
          {event.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{event.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 sm:gap-4">
            {event.event_date && (
              <Stat icon={Clock}>{ended ? 'Ended' : format(new Date(event.event_date), 'dd MMM, yyyy')}</Stat>
            )}
            {event.location && <Stat icon={MapPin}>{event.location}</Stat>}
          </div>
          {(event.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(event.tags ?? []).slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] font-medium bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex sm:flex-col gap-2 justify-center sm:justify-center">
          <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-transparent text-foreground px-4 py-2.5 sm:px-3 sm:py-2 text-sm font-semibold hover:bg-accent/60 active:scale-95 transition w-full sm:w-auto">
            Details
          </span>
          <button
            onClick={handleJoin}
            disabled={joined || joining || checkingJoin || ended}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 sm:px-3 sm:py-2 text-sm font-semibold active:scale-95 transition w-full sm:w-auto ${joined
              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40'
              : 'bg-emerald-600 dark:bg-emerald-500/90 text-white hover:bg-emerald-700 dark:hover:bg-emerald-500 disabled:opacity-50'
              }`}
          >
            {checkingJoin ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : joined ? (
              <><CheckCircle className="h-4 w-4" /> Registered</>
            ) : joining ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>Register <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
          {event.event_url && (
            <a
              href={event.event_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-transparent text-muted-foreground px-4 py-2 sm:px-3 text-xs font-medium hover:bg-accent/60 active:scale-95 transition w-full sm:w-auto"
            >
              Visit site <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

    </Link>
  );
};

// --- Featured Event card (hero banner style, mirrors FeaturedCompetitionCard) ---

const EVENT_TYPE_PILL: Record<string, string> = {
  online: 'bg-sky-500/70',
  'in-person': 'bg-violet-500/70',
  hybrid: 'bg-amber-500/70',
};

const FeaturedEventCard = ({ event, user }: { event: EventItem; user: { id: string } | null }) => {
  const ended = isEnded(event);
  const categoryLabel = EVENT_CATEGORY_LABELS[event.category ?? 'event'] ?? 'Event';

  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [checkingJoin, setCheckingJoin] = useState(true);
  const [participantCount, setParticipantCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { setCheckingJoin(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [joinRes, countRes] = await Promise.all([
          supabase
            .from('event_participants')
            .select('user_id')
            .eq('event_id', event.id)
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('event_participants')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id),
        ]);
        if (!cancelled) {
          setJoined(!!joinRes.data);
          setParticipantCount(countRes.count ?? 0);
        }
      } catch { }
      if (!cancelled) setCheckingJoin(false);
    })();
    return () => { cancelled = true; };
  }, [event.id, user]);

  const handleJoin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || ended) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = await res.json();
      if (res.ok && json.success) setJoined(true);
      else if (json.alreadyJoined) setJoined(true);
    } catch { }
    setJoining(false);
  };

  return (
    <Link href={`/hub/event/${encodeURIComponent(event.id)}`} className="block rounded-2xl overflow-hidden bg-card/70 border border-border/60 shadow-sm hover:shadow-md transition-shadow">
      {/* Banner */}
      <div className="relative h-44 sm:h-56 md:h-64 w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {(() => {
          const url = resolveBannerUrl(event.banner_image_url);
          return url ? (
            <Image src={url} alt={event.title} fill className="object-cover" priority sizes="(max-width: 768px) 100vw, 1024px" />
          ) : null;
        })()}
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex items-end md:items-center justify-start p-5 md:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {event.is_featured && (
                <span className="flex items-center gap-1 text-xs font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                  <Star className="h-3 w-3 fill-white" /> Featured
                </span>
              )}
              <span className="text-xs font-semibold bg-blue-500/70 text-white px-2 py-0.5 rounded-full">
                {categoryLabel}
              </span>
              {event.event_type && (
                <span className={`text-xs font-semibold text-white px-2 py-0.5 rounded-full ${EVENT_TYPE_PILL[event.event_type] ?? 'bg-white/20'}`}>
                  {event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}
                </span>
              )}
            </div>
            <div className="text-white/95 text-xl md:text-2xl font-extrabold drop-shadow">{event.title}</div>
            {event.organizer_name && (
              <p className="text-slate-200/70 text-xs mt-0.5">by {event.organizer_name}</p>
            )}
            {event.description && (
              <p className="text-slate-200/80 text-xs md:text-sm mt-1 line-clamp-2 max-w-2xl">{event.description}</p>
            )}
            {(event.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(event.tags ?? []).slice(0, 4).map((tag) => (
                  <span key={tag} className="text-[10px] font-medium bg-white/10 text-white/80 px-1.5 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="absolute inset-0 ring-1 ring-white/10 rounded-b-2xl" />
      </div>

      {/* Content */}
      <div className="p-5 md:p-6">
        <div className="mt-1 flex flex-wrap items-center gap-4">
          {event.event_date && (
            <Stat icon={Clock}>{ended ? 'Ended' : format(new Date(event.event_date), 'dd MMM, yyyy')}</Stat>
          )}
          {event.location && <Stat icon={MapPin}>{event.location}</Stat>}
          {participantCount !== null && (
            <Stat icon={Users}>{participantCount} registered</Stat>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="flex-1 md:flex-none md:min-w-[140px] inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-transparent text-foreground px-4 py-2.5 text-sm font-semibold hover:bg-accent/60 active:scale-95 transition">
            View Details
          </span>
          <button
            onClick={handleJoin}
            disabled={joined || joining || checkingJoin || ended}
            className={`flex-1 md:flex-none md:min-w-[120px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-95 transition ${
              joined
                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40'
                : ended
                  ? 'bg-muted text-muted-foreground border border-border/60'
                  : 'bg-emerald-600 dark:bg-emerald-500/90 text-white hover:bg-emerald-700 dark:hover:bg-emerald-500 disabled:opacity-50'
            }`}
          >
            {checkingJoin ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : joined ? (
              <><CheckCircle className="h-4 w-4" /> Registered</>
            ) : ended ? (
              <>Ended</>
            ) : joining ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>Register <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
          {event.event_url && (
            <a
              href={event.event_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-transparent text-muted-foreground px-4 py-2 text-xs font-medium hover:bg-accent/60 active:scale-95 transition"
            >
              External Link <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </Link>
  );
};

// --- Jobs & Gigs cards (unchanged) ---

const jobTypeLabels: Record<string, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  'contract': 'Contract',
  'remote': 'Remote',
  'internship': 'Internship',
};

const JobRowCard = ({ job }: { job: JobItem }) => {
  const ended = isEnded(job);
  return (
    <Link href={`/hub/job/${encodeURIComponent(job.id)}`} className="block rounded-2xl bg-card/70 border border-border/60 p-4 sm:p-5 hover:bg-card/80 hover:shadow-md transition-all">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base sm:text-lg font-semibold text-foreground truncate">{job.title}</h4>
            {ended ? (
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-300 bg-rose-400/10 border border-rose-500/30 dark:border-rose-400/30 px-2.5 py-0.5 rounded-full shrink-0">Closed</span>
            ) : (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 border border-emerald-500/30 dark:border-emerald-400/30 px-2.5 py-0.5 rounded-full shrink-0">Open</span>
            )}
            {job.visibility && job.visibility !== 'public' && (
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-400/10 border border-purple-500/30 dark:border-purple-400/30 px-2.5 py-0.5 rounded-full shrink-0">Exclusive</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{job.company}</p>
          {job.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{job.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 border border-emerald-500/30 dark:border-emerald-400/30 px-2.5 py-0.5 rounded-full">
              {jobTypeLabels[job.job_type] || job.job_type}
            </span>
            {job.location && <Stat icon={MapPin}>{job.location}</Stat>}
            {job.salary_range && <Stat icon={DollarSign}>{job.salary_range}</Stat>}
            {job.deadline && (
              <Stat icon={Clock}>{ended ? 'Ended' : format(new Date(job.deadline), 'dd MMM, yyyy')}</Stat>
            )}
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 dark:bg-emerald-500/90 text-white px-4 py-2.5 sm:py-2 text-sm font-semibold hover:bg-emerald-700 dark:hover:bg-emerald-500 active:scale-95 transition w-full sm:w-auto">
          View
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
};

const GigRowCard = ({ gig }: { gig: GigItem }) => {
  const ended = isEnded(gig);
  return (
    <Link href={`/hub/gig/${encodeURIComponent(gig.id)}`} className="block rounded-2xl bg-card/70 border border-border/60 p-4 sm:p-5 hover:bg-card/80 hover:shadow-md transition-all">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base sm:text-lg font-semibold text-foreground truncate">{gig.title}</h4>
            {ended ? (
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-300 bg-rose-400/10 border border-rose-500/30 dark:border-rose-400/30 px-2.5 py-0.5 rounded-full shrink-0">Closed</span>
            ) : (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 border border-emerald-500/30 dark:border-emerald-400/30 px-2.5 py-0.5 rounded-full shrink-0">Open</span>
            )}
            {gig.visibility && gig.visibility !== 'public' && (
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-400/10 border border-purple-500/30 dark:border-purple-400/30 px-2.5 py-0.5 rounded-full shrink-0">Exclusive</span>
            )}
          </div>
          {gig.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{gig.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {gig.budget && <Stat icon={DollarSign}>{gig.budget}</Stat>}
            {gig.duration && <Stat icon={Clock}>{gig.duration}</Stat>}
            {gig.deadline && (
              <Stat icon={Clock}>{ended ? 'Ended' : format(new Date(gig.deadline), 'dd MMM, yyyy')}</Stat>
            )}
          </div>
          {gig.skills_required && gig.skills_required.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {gig.skills_required.map((skill) => (
                <span
                  key={skill}
                  className="text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-400/10 border border-purple-500/30 dark:border-purple-400/30 px-2 py-0.5 rounded-full"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 dark:bg-emerald-500/90 text-white px-4 py-2.5 sm:py-2 text-sm font-semibold hover:bg-emerald-700 dark:hover:bg-emerald-500 active:scale-95 transition w-full sm:w-auto">
          View
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
};

// --- Helper: get logo/favicon for a resource ---

function getResourceLogoUrl(resource: ResourceItem): string | null {
  if (resource.logo_url) return resource.logo_url;
  if (resource.url) {
    try {
      const domain = new URL(resource.url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch { }
  }
  return null;
}

// --- Resource card ---

const ResourceCard = ({ resource }: { resource: ResourceItem }) => {
  const ended = isEnded(resource);
  const logoUrl = getResourceLogoUrl(resource);

  return (
    <div
      className="group rounded-2xl bg-card/70 border border-border/60 p-4 sm:p-5 hover:bg-card/80 hover:border-primary/30 hover:shadow-lg transition-all duration-200"
    >
      <div className="flex items-start gap-4">
        {logoUrl ? (
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center overflow-hidden">
            <img src={logoUrl} alt="" className="w-10 h-10 object-contain" />
          </div>
        ) : (
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary/70" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{resource.title}</h4>
          </div>
          {resource.provider && (
            <p className="text-xs text-muted-foreground mt-0.5">{resource.provider}</p>
          )}
          {resource.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{resource.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-primary/80 dark:text-primary/70 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
              {categoryLabels[resource.category] || resource.category}
            </span>
            {resource.deadline && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ended ? 'text-rose-600 dark:text-rose-300 bg-rose-400/10 border border-rose-500/30' : 'text-emerald-600 dark:text-emerald-300 bg-emerald-400/10 border border-emerald-500/30'}`}>
                {ended ? 'Expired' : `Deadline: ${format(new Date(resource.deadline), 'dd MMM, yyyy')}`}
              </span>
            )}
          </div>
          {resource.tags && resource.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {resource.tags.map((tag) => (
                <span key={tag} className="text-[10px] font-medium text-muted-foreground bg-muted/40 border border-border px-1.5 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {/* Action buttons */}
          <div className="mt-3 flex items-center gap-2">
            <Link
              href={`/hub/resource/${encodeURIComponent(resource.id)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-transparent px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 active:scale-95 transition"
            >
              <Eye className="h-3.5 w-3.5" /> Details
            </Link>
            {resource.url && (
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 dark:bg-emerald-500/90 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700 dark:hover:bg-emerald-500 active:scale-95 transition"
              >
                Visit site <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function formatOrganizationLocation(org: OrganizationResourceItem): string {
  return [org.city, org.state, org.country].filter(Boolean).join(', ');
}

const OrganizationHubCard = ({ organization }: { organization: OrganizationResourceItem }) => {
  const location = formatOrganizationLocation(organization);

  return (
    <div className="group rounded-2xl bg-card/70 border border-border/60 p-4 sm:p-5 hover:bg-card/80 hover:border-primary/30 hover:shadow-lg transition-all duration-200">
      <div className="flex items-start gap-4">
        {organization.logo_url ? (
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center overflow-hidden border border-border/40">
            <img src={organization.logo_url} alt={organization.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Building2 className="h-6 w-6" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
              {organization.name}
            </h4>
            <span className="text-[11px] font-semibold text-primary/80 dark:text-primary/70 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
              {organization.org_type.replace(/_/g, ' ')}
            </span>
            {organization.is_verified && (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Verified
              </span>
            )}
          </div>
          {organization.short_bio && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{organization.short_bio}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {location && (
              <span className="text-[11px] font-medium text-muted-foreground bg-muted/40 border border-border px-2 py-0.5 rounded-full">
                {location}
              </span>
            )}
            {(organization.support_types || []).slice(0, 2).map((item) => (
              <span key={item} className="text-[10px] font-medium text-muted-foreground bg-muted/40 border border-border px-1.5 py-0.5 rounded-full">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href={`/organizations/${encodeURIComponent(organization.slug)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-transparent px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 active:scale-95 transition"
            >
              <Eye className="h-3.5 w-3.5" /> View Profile
            </Link>
            {organization.website && (
              <a
                href={organization.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 dark:bg-emerald-500/90 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700 dark:hover:bg-emerald-500 active:scale-95 transition"
              >
                Visit <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Hub Page ---

function HubPageContent() {
  const { user } = useAuth();

  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey) || 'events';
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [eventCategory, setEventCategory] = useState<EventCategoryKey>('all');
  const [loading, setLoading] = useState(true);

  // Sync tab with URL search params so back navigation preserves tab state
  const handleTabChange = (newTab: TabKey) => {
    setTab(newTab);
    router.replace(`/hub?tab=${newTab}`, { scroll: false });
  };

  // Search + filter state (events tab)
  const [eventsSearch, setEventsSearch] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterPrize, setFilterPrize] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Events tab data
  const [featured, setFeatured] = useState<CompetitionItem | null>(null);
  const [competitions, setCompetitions] = useState<CompetitionItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [featuredEvent, setFeaturedEvent] = useState<EventItem | null>(null);

  // Jobs tab data
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [gigs, setGigs] = useState<GigItem[]>([]);

  // Resources tab data
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationResourceItem[]>([]);
  const [resourceFilter, setResourceFilter] = useState<string>('All');
  const [resourcePage, setResourcePage] = useState(0);
  const RESOURCES_PER_PAGE = 10;

  // Recommendations
  type RecommendedResource = ResourceItem & { ai_reason?: string };
  const [recommendations, setRecommendations] = useState<RecommendedResource[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const filteredResources = useMemo(() => {
    if (resourceFilter === 'Organizations') return [];
    if (resourceFilter === 'All') return resources;
    return resources.filter(r => r.category === resourceFilter);
  }, [resourceFilter, resources]);

  const filteredOrganizations = useMemo(() => {
    if (resourceFilter === 'Organizations' || resourceFilter === 'All') return organizations;
    return [];
  }, [resourceFilter, organizations]);

  const totalResourcePages = Math.max(1, Math.ceil((resourceFilter === 'Organizations' ? filteredOrganizations.length : filteredResources.length) / RESOURCES_PER_PAGE));

  const paginatedResources = useMemo(() => {
    const start = resourcePage * RESOURCES_PER_PAGE;
    return filteredResources.slice(start, start + RESOURCES_PER_PAGE);
  }, [filteredResources, resourcePage]);

  const paginatedOrganizations = useMemo(() => {
    const start = resourcePage * RESOURCES_PER_PAGE;
    return filteredOrganizations.slice(start, start + RESOURCES_PER_PAGE);
  }, [filteredOrganizations, resourcePage]);

  // Fetch data for the Events tab (competitions + events from DB)
  useEffect(() => {
    if (tab === 'events') {
      setLoading(true);
      (async () => {
        try {
          // Fetch featured competition, all competitions, and events in parallel
          const [featuredRes, compRes, eventsRes] = await Promise.all([
            fetch(`/api/competitions?activeOnly=true&orderBy=deadline&ascending=true&limit=1`, { cache: 'no-store' }),
            fetch(`/api/competitions?orderBy=created_at&ascending=false&limit=20`, { cache: 'no-store' }),
            fetch(`/api/events?activeOnly=true&orderBy=event_date&ascending=true&limit=50`, { cache: 'no-store' }),
          ]);
          const featuredJson = await featuredRes.json();
          const compJson = await compRes.json();
          const eventsJson = await eventsRes.json();

          // Set featured competition (nearest deadline first, fallback to latest)
          const upcoming = Array.isArray(featuredJson.data) ? featuredJson.data : [];
          if (upcoming.length > 0) {
            setFeatured(upcoming[0]);
          } else {
            const allComps = Array.isArray(compJson.data) ? compJson.data : [];
            setFeatured(allComps.length > 0 ? allComps[0] : null);
          }

          setCompetitions(Array.isArray(compJson.data) ? compJson.data : []);

          const eventsData: EventItem[] = Array.isArray(eventsJson.data) ? eventsJson.data : [];
          setEvents(eventsData);
          // Pick featured event: first explicitly featured, else nearest upcoming
          const featuredEv = eventsData.find(e => e.is_featured) ?? eventsData[0] ?? null;
          setFeaturedEvent(featuredEv);
        } catch (e) {
          console.error('Failed to load events data', e);
          setFeatured(null);
          setFeaturedEvent(null);
          setCompetitions([]);
          setEvents([]);
        }
        setLoading(false);
      })();
    } else if (tab === 'jobs') {
      setLoading(true);
      (async () => {
        try {
          const [jobsRes, gigsRes] = await Promise.all([
            fetch(`/api/jobs?activeOnly=true&orderBy=created_at&ascending=false&limit=20`, { cache: 'no-store' }),
            fetch(`/api/gigs?activeOnly=true&orderBy=created_at&ascending=false&limit=20`, { cache: 'no-store' }),
          ]);
          const jobsJson = await jobsRes.json();
          const gigsJson = await gigsRes.json();
          setJobs(Array.isArray(jobsJson.data) ? jobsJson.data : []);
          setGigs(Array.isArray(gigsJson.data) ? gigsJson.data : []);
        } catch (e) {
          console.error('Failed to load jobs/gigs', e);
          setJobs([]);
          setGigs([]);
        }
        setLoading(false);
      })();
    } else if (tab === 'resources') {
      setLoading(true);
      (async () => {
        try {
          const [resourcesRes, orgsRes] = await Promise.all([
            fetch(`/api/resources?activeOnly=true&orderBy=created_at&ascending=false&limit=500`, { cache: 'no-store' }),
            fetch(`/api/organizations`, { cache: 'no-store' }),
          ]);
          const resourcesJson = await resourcesRes.json();
          const orgsJson = await orgsRes.json();
          setResources(Array.isArray(resourcesJson.data) ? resourcesJson.data : []);
          setOrganizations(Array.isArray(orgsJson.data) ? orgsJson.data : []);
        } catch (e) {
          console.error('Failed to load resources', e);
          setResources([]);
          setOrganizations([]);
        }
        setLoading(false);
      })();
    }
  }, [tab]);

  // Fetch AI recommendations when resources tab is active and user is logged in
  useEffect(() => {
    if (tab !== 'resources' || !user) return;
    let cancelled = false;
    setLoadingRecs(true);
    (async () => {
      try {
        const res = await fetch('/api/resources/recommendations', { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled) setRecommendations(Array.isArray(json.recommendations) ? json.recommendations : []);
      } catch {
        if (!cancelled) setRecommendations([]);
      }
      if (!cancelled) setLoadingRecs(false);
    })();
    return () => { cancelled = true; };
  }, [tab, user]);

  // Filter competitions by search + filters
  const filteredCompetitions = useMemo(() => {
    const q = eventsSearch.toLowerCase();
    return competitions.filter((c) => {
      if (q && !c.title.toLowerCase().includes(q) && !(c.description ?? '').toLowerCase().includes(q)) return false;
      if (filterDomain && c.domain !== filterDomain) return false;
      if (filterPrize && !c.prize_pool) return false;
      return true;
    });
  }, [competitions, eventsSearch, filterDomain, filterPrize]);

  // Filter events by sub-category + search + mode
  const filteredEvents = useMemo(() => {
    const q = eventsSearch.toLowerCase();
    const categoryMap: Record<string, string> = {
      events: 'event', meetups: 'meetup', workshops: 'workshop',
      conference: 'conference', seminar: 'seminar',
    };
    return events.filter((ev) => {
      if (eventCategory !== 'all') {
        const dbCategory = categoryMap[eventCategory];
        if (dbCategory && (ev.category || 'event') !== dbCategory) return false;
      }
      if (q && !ev.title.toLowerCase().includes(q) && !(ev.description ?? '').toLowerCase().includes(q)) return false;
      if (filterMode && ev.event_type !== filterMode) return false;
      return true;
    });
  }, [eventCategory, events, eventsSearch, filterMode]);

  return (
    <DashboardLayout fullWidth>
      <div className="flex flex-col flex-1 w-full h-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">Hub</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {tab === 'events' ? 'Discover competitions, events, and workshops' : tab === 'jobs' ? 'Find jobs and freelance gigs' : 'Explore tools, funding, and startup resources'}
            </p>
          </div>
          <PillTabs active={tab} onChange={handleTabChange} />
        </div>

        {/* Events tab — with sub-category pills */}
        {tab === 'events' && (
          <div className="mt-6 space-y-6">
            {/* Search + filter bar */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={eventsSearch}
                    onChange={(e) => setEventsSearch(e.target.value)}
                    placeholder="Search competitions & events..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-border/60 bg-card/60 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 backdrop-blur-sm"
                  />
                  {eventsSearch && (
                    <button onClick={() => setEventsSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                    showFilters || filterDomain || filterMode || filterPrize
                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-border/60 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card/80'
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {(filterDomain || filterMode || filterPrize) && (
                    <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                      {[filterDomain, filterMode, filterPrize].filter(Boolean).length}
                    </span>
                  )}
                </button>
              </div>

              {showFilters && (
                <div className="flex flex-wrap gap-3 p-3 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Domain</label>
                    <select
                      value={filterDomain}
                      onChange={(e) => setFilterDomain(e.target.value)}
                      className="rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-emerald-500/50"
                    >
                      <option value="">Any</option>
                      <option value="hackathon">Hackathon</option>
                      <option value="case_study">Case Study</option>
                      <option value="quiz">Quiz</option>
                      <option value="design">Design</option>
                      <option value="coding">Coding</option>
                      <option value="business_plan">Business Plan</option>
                      <option value="research">Research</option>
                      <option value="marketing">Marketing</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Mode</label>
                    <select
                      value={filterMode}
                      onChange={(e) => setFilterMode(e.target.value)}
                      className="rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-emerald-500/50"
                    >
                      <option value="">Any</option>
                      <option value="online">Online</option>
                      <option value="in-person">In-person</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterPrize}
                        onChange={(e) => setFilterPrize(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-border/60 text-emerald-500"
                      />
                      <span className="text-xs font-medium text-foreground">Has prize pool</span>
                    </label>
                  </div>
                  {(filterDomain || filterMode || filterPrize) && (
                    <button
                      onClick={() => { setFilterDomain(''); setFilterMode(''); setFilterPrize(false); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground self-end"
                    >
                      <XIcon className="h-3 w-3" /> Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Sub-category filter pills */}
            <div className="flex flex-wrap gap-2">
              {EVENT_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${eventCategory === cat.key
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30'
                    : 'text-muted-foreground bg-muted/40 border border-border hover:bg-muted/60'
                    }`}
                  onClick={() => setEventCategory(cat.key)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* "All" view: single featured + unified list */}
            {eventCategory === 'all' && (
              <>
                {/* Single featured post — prefer featured competition, fallback to featured event */}
                {!loading && (featured || featuredEvent) && (
                  <div>
                    <h3 className="text-lg md:text-xl font-bold mb-4">Featured</h3>
                    {featured ? (
                      <FeaturedCompetitionCard c={featured} user={user} />
                    ) : featuredEvent ? (
                      <FeaturedEventCard event={featuredEvent} user={user} />
                    ) : null}
                  </div>
                )}

                {/* Unified list of all competitions + events mixed together */}
                <div className="grid gap-4">
                  {loading ? (
                    <>
                      <div className="h-28 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                      <div className="h-28 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                      <div className="h-28 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                    </>
                  ) : filteredCompetitions.length === 0 && filteredEvents.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <div className="w-12 h-12 rounded-full bg-accent/40 flex items-center justify-center mb-3">
                        <Trophy className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {eventsSearch || filterDomain || filterPrize || filterMode ? 'No results match your filters.' : 'No events or competitions yet.'}
                      </p>
                    </div>
                  ) : (
                    [...filteredCompetitions.map(c => ({ type: 'competition' as const, item: c, date: c.deadline })),
                     ...filteredEvents.map(ev => ({ type: 'event' as const, item: ev, date: ev.event_date }))]
                      .sort((a, b) => {
                        const da = a.date ? Date.parse(a.date) : 0;
                        const db = b.date ? Date.parse(b.date) : 0;
                        return db - da;
                      })
                      .map(entry =>
                        entry.type === 'competition'
                          ? <CompetitionRowCard key={`comp-${entry.item.id}`} c={entry.item as CompetitionItem} user={user} />
                          : <EventRowCard key={`evt-${entry.item.id}`} event={entry.item as EventItem} user={user} />
                      )
                  )}
                </div>
              </>
            )}

            {/* Competitions-only view */}
            {eventCategory === 'competitions' && (
              <>
                {featured && !loading && (
                  <div>
                    <h3 className="text-lg md:text-xl font-bold mb-4">Featured</h3>
                    <FeaturedCompetitionCard c={featured} user={user} />
                  </div>
                )}
                <div>
                  <h3 className="text-lg md:text-xl font-bold mb-4">Competitions</h3>
                  <div className="grid gap-4">
                    {loading ? (
                      <>
                        <div className="h-28 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                        <div className="h-28 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                      </>
                    ) : filteredCompetitions.length === 0 ? (
                      <div className="text-sm text-muted-foreground">{eventsSearch || filterDomain || filterPrize ? 'No competitions match your filters.' : 'No competitions yet.'}</div>
                    ) : (
                      filteredCompetitions.map(c => <CompetitionRowCard key={c.id} c={c} user={user} />)
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Events / Meetups / Workshops specific view */}
            {(eventCategory === 'events' || eventCategory === 'meetups' || eventCategory === 'workshops') && (
              <>
                {featuredEvent && !loading && eventCategory === 'events' && (
                  <div>
                    <h3 className="text-lg md:text-xl font-bold mb-4">Featured</h3>
                    <FeaturedEventCard event={featuredEvent} user={user} />
                  </div>
                )}
                <div>
                  <h3 className="text-lg md:text-xl font-bold mb-4">
                    {eventCategory === 'events' ? 'Events' :
                      eventCategory === 'meetups' ? 'Meetups' : 'Workshops'}
                  </h3>
                  <div className="grid gap-4">
                    {loading ? (
                      <>
                        <div className="h-28 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                        <div className="h-28 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                      </>
                    ) : filteredEvents.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No {eventCategory} yet.
                      </div>
                    ) : (
                      filteredEvents.map(ev => <EventRowCard key={ev.id} event={ev} user={user} />)
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Jobs & Gigs tab */}
        {tab === 'jobs' && (
          <div className="mt-6 space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                <h3 className="text-lg md:text-xl font-bold">Jobs</h3>
              </div>
              <div className="grid gap-4">
                {loading ? (
                  <>
                    <div className="h-32 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                    <div className="h-32 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                  </>
                ) : jobs.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <div className="w-12 h-12 rounded-full bg-accent/40 flex items-center justify-center mb-3">
                      <Briefcase className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">No open jobs right now. New opportunities are added regularly.</p>
                  </div>
                ) : (
                  jobs.map(job => <JobRowCard key={job.id} job={job} />)
                )}
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                <h3 className="text-lg md:text-xl font-bold">Gigs</h3>
              </div>
              <div className="grid gap-4">
                {loading ? (
                  <>
                    <div className="h-32 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                    <div className="h-32 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                  </>
                ) : gigs.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <div className="w-12 h-12 rounded-full bg-accent/40 flex items-center justify-center mb-3">
                      <Zap className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">No open gigs right now. Freelance opportunities are added regularly.</p>
                  </div>
                ) : (
                  gigs.map(gig => <GigRowCard key={gig.id} gig={gig} />)
                )}
              </div>
            </div>
          </div>
        )}

        {/* Resources tab */}
        {tab === 'resources' && (
          <div className="mt-6 space-y-6">
            {/* AI Recommendations */}
            {user && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-lg font-bold text-foreground">Recommended for You</h3>
                </div>
                {loadingRecs ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-28 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                    ))}
                  </div>
                ) : recommendations.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {recommendations.map((rec) => (
                      <Link
                        key={rec.id}
                        href={`/hub/resource/${encodeURIComponent(rec.id)}`}
                        className="rounded-2xl bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-500/20 p-4 hover:border-emerald-500/40 hover:shadow-md transition-all"
                      >
                        <h4 className="text-sm font-semibold text-foreground line-clamp-1">{rec.title}</h4>
                        {rec.provider && <p className="text-xs text-muted-foreground mt-0.5">{rec.provider}</p>}
                        <span className="mt-1.5 inline-block text-[10px] font-semibold text-primary/80 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                          {categoryLabels[rec.category] || rec.category}
                        </span>
                        {rec.ai_reason && (
                          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300/80 line-clamp-2">
                            <Sparkles className="inline h-3 w-3 mr-1" />{rec.ai_reason}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : null}
                {(recommendations.length > 0 || loadingRecs) && (
                  <div className="mt-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {RESOURCE_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${resourceFilter === cat.key
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-muted-foreground bg-muted/40 border border-border hover:bg-muted/60'
                    }`}
                  onClick={() => { setResourceFilter(cat.key); setResourcePage(0); }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-36 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                ))}
              </div>
            ) : (resourceFilter === 'Organizations' ? paginatedOrganizations.length > 0 : paginatedResources.length > 0) ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {resourceFilter === 'Organizations'
                    ? paginatedOrganizations.map((organization) => (
                      <OrganizationHubCard key={organization.id} organization={organization} />
                    ))
                    : paginatedResources.map(resource => (
                      <ResourceCard key={resource.id} resource={resource} />
                    ))}
                </div>

                {/* Pagination controls */}
                {(resourceFilter === 'Organizations' ? filteredOrganizations.length : filteredResources.length) > RESOURCES_PER_PAGE && (
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      onClick={() => setResourcePage((prev) => Math.max(0, prev - 1))}
                      disabled={resourcePage === 0}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-transparent px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/40 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <ArrowRight className="h-4 w-4 rotate-180" /> Prev
                    </button>
                    <span className="text-xs text-muted-foreground tabular-nums">{resourcePage + 1} / {totalResourcePages}</span>
                    <button
                      onClick={() => setResourcePage((prev) => Math.min(totalResourcePages - 1, prev + 1))}
                      disabled={resourcePage >= totalResourcePages - 1}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-transparent px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/40 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Next <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-accent/40 flex items-center justify-center mb-3">
                  <FolderOpen className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">{resourceFilter === 'Organizations' ? 'No startup facilitator profiles available right now.' : 'No resources in this category yet. Try a different filter.'}</p>
              </div>
            )}
          </div>
        )}
      </div>

    </DashboardLayout>
  );
}

export default function HubPage() {
  return (
    <Suspense fallback={
      <DashboardLayout fullWidth>
        <div className="flex flex-col flex-1 w-full h-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="h-8 w-20 animate-pulse rounded-lg bg-muted/20" />
              <div className="h-4 w-56 animate-pulse rounded bg-muted/15" />
            </div>
            <div className="h-10 w-64 animate-pulse rounded-2xl bg-muted/20" />
          </div>
          <div className="mt-6 space-y-4">
            <div className="h-64 animate-pulse rounded-2xl bg-muted/20 border border-border/60" />
            <div className="h-28 animate-pulse rounded-2xl bg-muted/20 border border-border/60" />
            <div className="h-28 animate-pulse rounded-2xl bg-muted/20 border border-border/60" />
          </div>
        </div>
      </DashboardLayout>
    }>
      <HubPageContent />
    </Suspense>
  );
}
