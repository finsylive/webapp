"use client";
import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import Image from 'next/image';
import { Users, Clock, Trophy, ArrowRight, MapPin, Briefcase, DollarSign, Zap, ExternalLink, Loader2, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toProxyUrl } from '@/utils/imageUtils';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/context/AuthContext';

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
  category?: string | null; // 'event' | 'meetup' | 'workshop'
  is_active: boolean;
  created_at: string;
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
};

type ResourceItem = {
  id: string;
  title: string;
  description?: string | null;
  url?: string | null;
  icon?: string | null;
  category: string;
  provider?: string | null;
  eligibility?: string | null;
  deadline?: string | null;
  tags?: string[];
};

const RESOURCE_CATEGORIES = [
  { key: 'All', label: 'All' },
  { key: 'govt_scheme', label: 'Govt Schemes' },
  { key: 'accelerator_incubator', label: 'Accelerators' },
  { key: 'company_offer', label: 'Company Offers' },
  { key: 'tool', label: 'Tools' },
  { key: 'bank_offer', label: 'Bank Offers' },
];

const categoryLabels: Record<string, string> = {
  govt_scheme: 'Govt Scheme',
  accelerator_incubator: 'Accelerator / Incubator',
  company_offer: 'Company Offer',
  tool: 'Tool',
  bank_offer: 'Bank Offer',
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
  const base = 'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200';
  const inactive = 'text-muted-foreground hover:text-accent-foreground hover:bg-accent/70';
  const activeCls = 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40 dark:border-emerald-400/30 shadow-[inset_0_0_0_1px_rgba(16,185,129,.3)]';
  return (
    <div className="inline-flex items-center gap-2 bg-card/60 border border-border/60 p-2 rounded-2xl backdrop-blur-sm">
      {/* Renamed from "Competitions" to "Events" */}
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

const FeaturedCompetitionCard = ({ c, user, onJoinSuccess }: { c: CompetitionItem; user: { id: string } | null; onJoinSuccess?: () => void }) => {
  const ended = isEnded(c);
  const deadlineLabel = c.deadline ? (ended ? 'Ended' : format(new Date(c.deadline), 'dd MMM, yyyy')) : 'Open';

  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [checkingJoin, setCheckingJoin] = useState(true);

  // Check if user already joined
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
      } catch {}
      if (!cancelled) setCheckingJoin(false);
    })();
    return () => { cancelled = true; };
  }, [c.id, user]);

  const handleJoin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || ended) return;

    // External competitions: redirect to external URL
    if (c.is_external && c.external_url) {
      window.open(c.external_url, '_blank', 'noopener,noreferrer');
      return;
    }

    setJoining(true);
    try {
      const res = await fetch(`/api/competitions/${encodeURIComponent(c.id)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setJoined(true);
        onJoinSuccess?.();
      } else if (json.alreadyJoined) {
        setJoined(true);
      }
    } catch {}
    setJoining(false);
  };

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
            <div className="text-white/95 text-xl md:text-2xl font-extrabold drop-shadow">{c.title}</div>
            {c.description && (
              <p className="text-slate-200/80 text-xs md:text-sm mt-1 line-clamp-2 max-w-2xl">{c.description}</p>
            )}
          </div>
        </div>
        <div className="absolute inset-0 ring-1 ring-white/10 rounded-b-2xl"></div>
      </div>
      {/* Content */}
      <div className="p-5 md:p-6">
        <div className="mt-1 text-muted-foreground text-sm truncate">{deadlineLabel}</div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Stat icon={Users}>Participants: --</Stat>
          <Stat icon={Clock}>{deadlineLabel}</Stat>
          {c.prize_pool && <Stat icon={Trophy}>Prize: {c.prize_pool}</Stat>}
        </div>
        <div className="mt-5 flex items-center gap-3">
          <span className="flex-1 md:flex-none md:min-w-[140px] inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-transparent text-foreground px-4 py-2.5 text-sm font-semibold hover:bg-accent/60 active:scale-95 transition">
            View Details
          </span>
          <button
            onClick={handleJoin}
            disabled={joined || joining || checkingJoin || !user || ended}
            className={`flex-1 md:flex-none md:min-w-[120px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-95 transition ${
              joined
                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40'
                : 'bg-emerald-600 dark:bg-emerald-500/90 text-white hover:bg-emerald-700 dark:hover:bg-emerald-500 disabled:opacity-50'
            }`}
          >
            {checkingJoin ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : joined ? (
              <><CheckCircle className="h-4 w-4" /> Joined</>
            ) : joining ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Joining...</>
            ) : (
              <>Join <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      </div>
    </Link>
  );
};

const CompetitionRowCard = ({ c, user }: { c: CompetitionItem; user: { id: string } | null }) => {
  const ended = isEnded(c);

  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
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
      } catch {}
      if (!cancelled) setCheckingJoin(false);
    })();
    return () => { cancelled = true; };
  }, [c.id, user]);

  const handleJoin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || ended) return;

    if (c.is_external && c.external_url) {
      window.open(c.external_url, '_blank', 'noopener,noreferrer');
      return;
    }

    setJoining(true);
    try {
      const res = await fetch(`/api/competitions/${encodeURIComponent(c.id)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = await res.json();
      if ((res.ok && json.success) || json.alreadyJoined) {
        setJoined(true);
      }
    } catch {}
    setJoining(false);
  };

  return (
    <div className="rounded-2xl bg-card/70 border border-border/60 p-4 md:p-5 flex gap-4 hover:bg-card/80 transition">
      <div className="relative h-20 w-28 md:h-24 md:w-32 rounded-xl overflow-hidden flex-shrink-0 bg-muted/40">
        {(() => {
          const url = resolveBannerUrl(c.banner_image_url);
          return url ? (
            <Image src={url} alt={c.title} fill className="object-cover" sizes="160px" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">No image</div>
          );
        })()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-base md:text-lg font-semibold text-foreground truncate">{c.title}</h4>
          {ended ? (
            <span className="text-[11px] md:text-xs font-semibold text-rose-600 dark:text-rose-300 bg-rose-400/10 border border-rose-500/30 dark:border-rose-400/30 px-2.5 py-0.5 rounded-full">Ended</span>
          ) : (
            <span className="text-[11px] md:text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 border border-emerald-500/30 dark:border-emerald-400/30 px-2.5 py-0.5 rounded-full">Open</span>
          )}
        </div>
        {c.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{c.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <Stat icon={Clock}>{c.deadline ? format(new Date(c.deadline), 'dd MMM, yyyy') : 'No deadline'}</Stat>
          {c.prize_pool && <Stat icon={Trophy}>Prize: {c.prize_pool}</Stat>}
        </div>
      </div>
      <div className="flex flex-col gap-2 justify-center">
        <Link
          href={`/hub/${encodeURIComponent(c.id)}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-transparent text-foreground px-3 py-2 text-sm font-semibold hover:bg-accent/60 active:scale-95 transition"
        >
          View
        </Link>
        <a
          href={c.is_external && c.external_url ? c.external_url : '#'}
          target={c.is_external ? '_blank' : undefined}
          rel={c.is_external ? 'noopener noreferrer' : undefined}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 dark:bg-emerald-500/90 text-white px-3 py-2 text-sm font-semibold hover:bg-emerald-700 dark:hover:bg-emerald-500 active:scale-95 transition"
        >
          Join
        </a>
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
    <div className="rounded-2xl bg-card/70 border border-border/60 p-4 md:p-5 hover:bg-card/80 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-base md:text-lg font-semibold text-foreground truncate">{job.title}</h4>
            {ended ? (
              <span className="text-[11px] md:text-xs font-semibold text-rose-600 dark:text-rose-300 bg-rose-400/10 border border-rose-500/30 dark:border-rose-400/30 px-2.5 py-0.5 rounded-full shrink-0">Closed</span>
            ) : (
              <span className="text-[11px] md:text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 border border-emerald-500/30 dark:border-emerald-400/30 px-2.5 py-0.5 rounded-full shrink-0">Open</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{job.company}</p>
          {job.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{job.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-[11px] md:text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-400/10 border border-blue-500/30 dark:border-blue-400/30 px-2.5 py-0.5 rounded-full">
              {jobTypeLabels[job.job_type] || job.job_type}
            </span>
            {job.location && <Stat icon={MapPin}>{job.location}</Stat>}
            {job.salary_range && <Stat icon={DollarSign}>{job.salary_range}</Stat>}
            {job.deadline && (
              <Stat icon={Clock}>{ended ? 'Ended' : format(new Date(job.deadline), 'dd MMM, yyyy')}</Stat>
            )}
          </div>
        </div>
        <button className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 dark:bg-emerald-500/90 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700 dark:hover:bg-emerald-500 active:scale-95 transition">
          Apply
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const GigRowCard = ({ gig }: { gig: GigItem }) => {
  const ended = isEnded(gig);
  return (
    <div className="rounded-2xl bg-card/70 border border-border/60 p-4 md:p-5 hover:bg-card/80 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-base md:text-lg font-semibold text-foreground truncate">{gig.title}</h4>
            {ended ? (
              <span className="text-[11px] md:text-xs font-semibold text-rose-600 dark:text-rose-300 bg-rose-400/10 border border-rose-500/30 dark:border-rose-400/30 px-2.5 py-0.5 rounded-full shrink-0">Closed</span>
            ) : (
              <span className="text-[11px] md:text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 border border-emerald-500/30 dark:border-emerald-400/30 px-2.5 py-0.5 rounded-full shrink-0">Open</span>
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
        <button className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 dark:bg-emerald-500/90 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700 dark:hover:bg-emerald-500 active:scale-95 transition">
          Apply
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// --- Resource card (unchanged) ---

const ResourceCard = ({ resource }: { resource: ResourceItem }) => {
  const ended = isEnded(resource);
  const Wrapper = resource.url ? 'a' : 'div';
  const linkProps = resource.url ? { href: resource.url, target: '_blank' as const, rel: 'noopener noreferrer' } : {};
  return (
    <Wrapper
      {...linkProps}
      className="group rounded-2xl bg-card/70 border border-border/60 p-5 hover:bg-card/80 hover:border-primary/30 hover:shadow-lg transition-all duration-200"
    >
      <div className="flex items-start gap-4">
        <div className="text-3xl flex-shrink-0 w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
          {resource.icon || '\uD83D\uDCE6'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{resource.title}</h4>
            {resource.url && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
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
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ended ? 'text-rose-600 dark:text-rose-300 bg-rose-400/10 border border-rose-500/30' : 'text-amber-600 dark:text-amber-300 bg-amber-400/10 border border-amber-500/30'}`}>
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
        </div>
      </div>
    </Wrapper>
  );
};

// --- Main Hub Page ---

export default function HubPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>('events');
  const [eventCategory, setEventCategory] = useState<EventCategoryKey>('all');
  const [loading, setLoading] = useState(true);

  // Events tab data
  const [featured, setFeatured] = useState<CompetitionItem | null>(null);
  const [competitions, setCompetitions] = useState<CompetitionItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  // Jobs tab data
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [gigs, setGigs] = useState<GigItem[]>([]);

  // Resources tab data
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [resourceFilter, setResourceFilter] = useState<string>('All');

  const filteredResources = useMemo(() => {
    if (resourceFilter === 'All') return resources;
    return resources.filter(r => r.category === resourceFilter);
  }, [resourceFilter, resources]);

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
          setEvents(Array.isArray(eventsJson.data) ? eventsJson.data : []);
        } catch (e) {
          console.error('Failed to load events data', e);
          setFeatured(null);
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
          const res = await fetch(`/api/resources?activeOnly=true&orderBy=created_at&ascending=false&limit=50`, { cache: 'no-store' });
          const json = await res.json();
          setResources(Array.isArray(json.data) ? json.data : []);
        } catch (e) {
          console.error('Failed to load resources', e);
          setResources([]);
        }
        setLoading(false);
      })();
    }
  }, [tab]);

  // Filter events by sub-category
  const filteredEvents = useMemo(() => {
    if (eventCategory === 'all') return events;
    // Map sub-category key to the category value stored in DB
    const categoryMap: Record<string, string> = {
      events: 'event',
      meetups: 'meetup',
      workshops: 'workshop',
    };
    const dbCategory = categoryMap[eventCategory];
    if (!dbCategory) return events;
    return events.filter(ev => (ev.category || 'event') === dbCategory);
  }, [eventCategory, events]);

  // Determine what to show based on selected sub-category
  const showCompetitions = eventCategory === 'all' || eventCategory === 'competitions';
  const showEvents = eventCategory !== 'competitions';

  return (
    <DashboardLayout>
      <div className="flex flex-col flex-1 w-full h-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        {/* Tabs header */}
        <div className="flex items-center justify-end">
          <PillTabs active={tab} onChange={setTab} />
        </div>

        {/* Section title */}
        <h2 className="mt-6 text-2xl md:text-3xl font-extrabold text-foreground">
          {tab === 'events' ? 'Events' : tab === 'jobs' ? 'Jobs & Gigs' : 'Resources'}
        </h2>
        <div className="mt-4 h-1 rounded-full bg-gradient-to-r from-emerald-500/50 dark:from-emerald-300/40 via-emerald-500/30 dark:via-emerald-400/30 to-transparent w-40" />

        {/* Events tab — with sub-category pills */}
        {tab === 'events' && (
          <div className="mt-6 space-y-6">
            {/* Sub-category filter pills */}
            <div className="flex flex-wrap gap-2">
              {EVENT_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                    eventCategory === cat.key
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30'
                      : 'text-muted-foreground bg-muted/40 border border-border hover:bg-muted/60'
                  }`}
                  onClick={() => setEventCategory(cat.key)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Featured competition card (shown on "All" or "Competitions") */}
            {showCompetitions && featured && !loading && (
              <div>
                <h3 className="text-lg md:text-xl font-bold mb-4">Featured</h3>
                <FeaturedCompetitionCard c={featured} user={user} />
              </div>
            )}

            {/* Competitions section (shown when "All" or "Competitions" is selected) */}
            {showCompetitions && (
              <div>
                <h3 className="text-lg md:text-xl font-bold mb-4">Competitions</h3>
                <div className="grid gap-4">
                  {loading ? (
                    <>
                      <div className="h-28 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                      <div className="h-28 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                    </>
                  ) : competitions.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No competitions yet.</div>
                  ) : (
                    competitions.map(c => <CompetitionRowCard key={c.id} c={c} user={user} />)
                  )}
                </div>
              </div>
            )}

            {/* Divider between competitions and events (only when showing both) */}
            {showCompetitions && showEvents && competitions.length > 0 && (
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            )}

            {/* Events / Meetups / Workshops section */}
            {showEvents && (
              <div>
                <h3 className="text-lg md:text-xl font-bold mb-4">
                  {eventCategory === 'all' ? 'Events, Meetups & Workshops' :
                   eventCategory === 'events' ? 'Events' :
                   eventCategory === 'meetups' ? 'Meetups' :
                   eventCategory === 'workshops' ? 'Workshops' : 'Events'}
                </h3>
                <div className="grid gap-4">
                  {loading ? (
                    <>
                      <div className="h-28 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                      <div className="h-28 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                    </>
                  ) : filteredEvents.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No {eventCategory === 'all' ? 'events' : eventCategory} yet.
                    </div>
                  ) : (
                    filteredEvents.map(ev => <EventRowCard key={ev.id} event={ev} user={user} />)
                  )}
                </div>
              </div>
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
                  <div className="text-center text-muted-foreground py-6">No jobs posted yet.</div>
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
                  <div className="text-center text-muted-foreground py-6">No gigs posted yet.</div>
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
            <div className="flex flex-wrap gap-2">
              <button
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${resourceFilter === 'All'
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-muted-foreground bg-muted/40 border border-border hover:bg-muted/60'
                  }`}
                onClick={() => setResourceFilter('All')}
              >
                All
              </button>
              {RESOURCE_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${resourceFilter === cat
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted-foreground bg-muted/40 border border-border hover:bg-muted/60'
                    }`}
                  onClick={() => setResourceFilter(cat)}
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
            ) : filteredResources.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredResources.map(resource => (
                  <ResourceCard key={resource.id} resource={resource} />
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-10">No resources in this category.</div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
