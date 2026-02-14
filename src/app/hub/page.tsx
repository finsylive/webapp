"use client";
import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import Image from 'next/image';
import { Users, Clock, Trophy, ArrowRight, MapPin, Briefcase, DollarSign, Zap, ExternalLink, Wrench } from 'lucide-react';
import { format } from 'date-fns';
// Local util: determine if a competition has ended
function isEnded(c: { deadline?: string | null }) {
  if (!c?.deadline) return false;
  const t = Date.parse(c.deadline);
  return isFinite(t) && t < Date.now();
}
import { toProxyUrl } from '@/utils/imageUtils';
import { supabase } from '@/utils/supabase';

type TabKey = 'competitions' | 'jobs' | 'resources';

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
  description: string;
  url: string;
  category: string;
  icon: string;
};

// Curated resources — can be replaced with an API later
const RESOURCES: ResourceItem[] = [
  {
    id: '1',
    title: 'Figma',
    description: 'Collaborative design tool for UI/UX design, prototyping, and design systems.',
    url: 'https://figma.com',
    category: 'Design',
    icon: '🎨',
  },
  {
    id: '2',
    title: 'GitHub',
    description: 'Code hosting platform for version control, collaboration, and open-source projects.',
    url: 'https://github.com',
    category: 'Development',
    icon: '💻',
  },
  {
    id: '3',
    title: 'Notion',
    description: 'All-in-one workspace for notes, docs, project management, and team wikis.',
    url: 'https://notion.so',
    category: 'Productivity',
    icon: '📝',
  },
  {
    id: '4',
    title: 'Vercel',
    description: 'Cloud platform for deploying and hosting frontend frameworks and static sites.',
    url: 'https://vercel.com',
    category: 'Development',
    icon: '🚀',
  },
  {
    id: '5',
    title: 'Linear',
    description: 'Issue tracking and project management tool built for modern software teams.',
    url: 'https://linear.app',
    category: 'Productivity',
    icon: '📋',
  },
  {
    id: '6',
    title: 'Supabase',
    description: 'Open-source Firebase alternative with Postgres database, auth, and storage.',
    url: 'https://supabase.com',
    category: 'Development',
    icon: '⚡',
  },
  {
    id: '7',
    title: 'Canva',
    description: 'Online graphic design tool for creating social media posts, presentations, and more.',
    url: 'https://canva.com',
    category: 'Design',
    icon: '🖼️',
  },
  {
    id: '8',
    title: 'Slack',
    description: 'Messaging platform for team communication, channels, and integrations.',
    url: 'https://slack.com',
    category: 'Communication',
    icon: '💬',
  },
  {
    id: '9',
    title: 'Stripe',
    description: 'Payment processing platform for internet businesses and online transactions.',
    url: 'https://stripe.com',
    category: 'Business',
    icon: '💳',
  },
  {
    id: '10',
    title: 'Loom',
    description: 'Video messaging tool for recording and sharing quick screen recordings.',
    url: 'https://loom.com',
    category: 'Communication',
    icon: '🎥',
  },
  {
    id: '11',
    title: 'Framer',
    description: 'Website builder and prototyping tool with powerful animations and interactions.',
    url: 'https://framer.com',
    category: 'Design',
    icon: '✨',
  },
  {
    id: '12',
    title: 'Railway',
    description: 'Infrastructure platform for deploying apps, databases, and cron jobs instantly.',
    url: 'https://railway.app',
    category: 'Development',
    icon: '🛤️',
  },
];

const RESOURCE_CATEGORIES = [...new Set(RESOURCES.map(r => r.category))];

// Resolve a banner URL that might be a storage path
function resolveBannerUrl(raw?: string | null): string | null {
  if (!raw) return null;
  // Convert s3://bucket/key to https URL
  if (raw.startsWith('s3://')) {
    const withoutScheme = raw.slice('s3://'.length);
    const slashIdx = withoutScheme.indexOf('/');
    if (slashIdx > 0) {
      const bucket = withoutScheme.slice(0, slashIdx);
      const key = withoutScheme.slice(slashIdx + 1);
      return toProxyUrl(`https://${bucket}.s3.amazonaws.com/${key}`);
    }
  }
  // Supabase Storage public URLs — use directly (no proxy needed)
  if (raw.includes('/storage/v1/object/public/')) return raw;
  if (raw.startsWith('http')) return toProxyUrl(raw);
  // Treat as storage path in the 'media' bucket by default
  try {
    const { data } = supabase.storage.from('media').getPublicUrl(raw);
    if (data?.publicUrl) return data.publicUrl;
  } catch {}
  return null;
}

const PillTabs = ({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) => {
  const base = 'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200';
  const inactive = 'text-muted-foreground hover:text-accent-foreground hover:bg-accent/70';
  const activeCls = 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40 dark:border-emerald-400/30 shadow-[inset_0_0_0_1px_rgba(16,185,129,.3)]';
  return (
    <div className="inline-flex items-center gap-2 bg-card/60 border border-border/60 p-2 rounded-2xl backdrop-blur-sm">
      <button className={`${base} ${active === 'competitions' ? activeCls : inactive}`} onClick={() => onChange('competitions')}>Competitions</button>
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

function useDaysRemaining(target: Date) {
  return useMemo(() => {
    const now = new Date();
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [target]);
}

const MonthlyCompetitionCard = () => {
  // End of next month for a rolling countdown look
  const end = useMemo(() => {
    // September 2025 per screenshot
    return new Date(2025, 8, 30, 23, 59, 59);
  }, []);
  const daysRemaining = useDaysRemaining(end);
  return (
    <div className="rounded-2xl bg-card/70 border border-border/60 p-5 md:p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-foreground">{format(new Date(2025, 8, 1), 'MMMM yyyy')}</h3>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Submit your projects to the monthly leaderboard and earn points for upvotes, comments, and engagement!
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-[11px] md:text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-400/10 border border-amber-500/30 dark:border-amber-400/30 px-2.5 py-1 rounded-full">Coming soon</span>
          <button className="mt-1 inline-flex items-center gap-2 rounded-xl bg-emerald-600 dark:bg-emerald-500/90 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700 dark:hover:bg-emerald-500 active:scale-95 transition">
            Join
          </button>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <Stat icon={Users}>0 participants</Stat>
        <Stat icon={Clock}>{daysRemaining} days remaining</Stat>
      </div>
    </div>
  );
};

const FeaturedCompetitionCard = ({ c }: { c: CompetitionItem }) => {
  const ended = isEnded(c);
  const deadlineLabel = c.deadline ? (ended ? 'Ended' : format(new Date(c.deadline), 'dd MMM, yyyy')) : 'Open';
  return (
    <div className="rounded-2xl overflow-hidden bg-card/70 border border-border/60 shadow-sm">
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
          <Stat icon={Users}>Participants: –</Stat>
          <Stat icon={Clock}>{deadlineLabel}</Stat>
          {c.prize_pool && <Stat icon={Trophy}>Prize: {c.prize_pool}</Stat>}
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Link href={`/hub/${encodeURIComponent(c.id)}`} className="flex-1 md:flex-none md:min-w-[140px] inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-transparent text-foreground px-4 py-2.5 text-sm font-semibold hover:bg-accent/60 active:scale-95 transition">
            View Details
          </Link>
          <a
            href={c.is_external && c.external_url ? c.external_url : '#'}
            target={c.is_external ? '_blank' : undefined}
            rel={c.is_external ? 'noopener noreferrer' : undefined}
            className="flex-1 md:flex-none md:min-w-[120px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 dark:bg-emerald-500/90 text-white px-4 py-2.5 text-sm font-semibold hover:bg-emerald-700 dark:hover:bg-emerald-500 active:scale-95 transition"
          >
            Join
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
};

const CompetitionRowCard = ({ c }: { c: CompetitionItem }) => {
  const ended = isEnded(c);
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
    </div>
  );
};

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

const ResourceCard = ({ resource }: { resource: ResourceItem }) => (
  <a
    href={resource.url}
    target="_blank"
    rel="noopener noreferrer"
    className="group rounded-2xl bg-card/70 border border-border/60 p-5 hover:bg-card/80 hover:border-primary/30 hover:shadow-lg transition-all duration-200"
  >
    <div className="flex items-start gap-4">
      <div className="text-3xl flex-shrink-0 w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
        {resource.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{resource.title}</h4>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{resource.description}</p>
        <span className="inline-block mt-2 text-[11px] font-semibold text-primary/80 dark:text-primary/70 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
          {resource.category}
        </span>
      </div>
    </div>
  </a>
);

export default function HubPage() {
  const [tab, setTab] = useState<TabKey>('competitions');
  const [loading, setLoading] = useState(true);
  const [featured, setFeatured] = useState<CompetitionItem[]>([]);
  const [list, setList] = useState<CompetitionItem[]>([]);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [gigs, setGigs] = useState<GigItem[]>([]);
  const [resourceFilter, setResourceFilter] = useState<string>('All');

  const filteredResources = useMemo(() => {
    if (resourceFilter === 'All') return RESOURCES;
    return RESOURCES.filter(r => r.category === resourceFilter);
  }, [resourceFilter]);

  useEffect(() => {
    if (tab === 'competitions') {
      setLoading(true);
      (async () => {
        try {
          const fRes = await fetch(`/api/competitions?activeOnly=true&orderBy=deadline&ascending=true&limit=1`, { cache: 'no-store' });
          const fJson = await fRes.json();
          const upcoming = Array.isArray(fJson.data) ? fJson.data : [];
          if (upcoming.length > 0) {
            setFeatured(upcoming);
          } else {
            const latestRes = await fetch(`/api/competitions?orderBy=created_at&ascending=false&limit=1`, { cache: 'no-store' });
            const latestJson = await latestRes.json();
            setFeatured(Array.isArray(latestJson.data) ? latestJson.data : []);
          }

          const listRes = await fetch(`/api/competitions?orderBy=created_at&ascending=false&limit=20`, { cache: 'no-store' });
          const listJson = await listRes.json();
          setList(Array.isArray(listJson.data) ? listJson.data : []);
        } catch (e) {
          console.error('Failed to load competitions', e);
          setFeatured([]);
          setList([]);
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
      setLoading(false);
    }
  }, [tab]);

  return (
    <DashboardLayout>
      <div className="flex flex-col flex-1 w-full h-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        {/* Tabs header */}
        <div className="flex items-center justify-end">
          <PillTabs active={tab} onChange={setTab} />
        </div>

        {/* Section title */}
        <h2 className="mt-6 text-2xl md:text-3xl font-extrabold text-foreground">
          {tab === 'competitions' ? 'Competitions' : tab === 'jobs' ? 'Jobs & Gigs' : 'Resources'}
        </h2>
        <div className="mt-4 h-1 rounded-full bg-gradient-to-r from-emerald-500/50 dark:from-emerald-300/40 via-emerald-500/30 dark:via-emerald-400/30 to-transparent w-40" />

        {/* Competitions tab */}
        {tab === 'competitions' && (
          <div className="mt-6 space-y-6">
            <MonthlyCompetitionCard />

            <div className="pt-2">
              <h3 className="text-lg md:text-xl font-bold">Featured Competitions</h3>
              <div className="mt-4">
                {loading ? (
                  <div className="animate-pulse h-64 rounded-2xl bg-muted/20 border border-border/60" />
                ) : featured.length > 0 ? (
                  <FeaturedCompetitionCard c={featured[0]} />
                ) : (
                  <div className="text-sm text-muted-foreground">No featured competitions.</div>
                )}
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-lg md:text-xl font-bold">All Competitions</h3>
              <div className="mt-4 grid gap-4">
                {loading ? (
                  <>
                    <div className="h-28 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                    <div className="h-28 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                  </>
                ) : list.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No competitions yet.</div>
                ) : (
                  list.map(c => <CompetitionRowCard key={c.id} c={c} />)
                )}
              </div>
            </div>
          </div>
        )}

        {/* Jobs & Gigs tab */}
        {tab === 'jobs' && (
          <div className="mt-6 space-y-8">
            {/* Jobs section */}
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

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            {/* Gigs section */}
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
            {/* Category filter pills */}
            <div className="flex flex-wrap gap-2">
              <button
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  resourceFilter === 'All'
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
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                    resourceFilter === cat
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted-foreground bg-muted/40 border border-border hover:bg-muted/60'
                  }`}
                  onClick={() => setResourceFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Resource grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredResources.map(resource => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>

            {filteredResources.length === 0 && (
              <div className="text-center text-muted-foreground py-10">No resources in this category.</div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
