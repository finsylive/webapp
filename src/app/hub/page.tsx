"use client";
import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import Image from 'next/image';
import { Users, Clock, Trophy, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
// Local util: determine if a competition has ended
function isEnded(c: { deadline?: string | null }) {
  if (!c?.deadline) return false;
  const t = Date.parse(c.deadline);
  return isFinite(t) && t < Date.now();
}
import { toProxyUrl } from '@/utils/imageUtils';
import { supabase } from '@/utils/supabase';

type TabKey = 'competitions' | 'jobs' | 'gigs';

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
  if (raw.startsWith('http')) return toProxyUrl(raw);
  // Treat as storage path in the 'media' bucket by default
  try {
    const { data } = supabase.storage.from('media').getPublicUrl(raw);
    if (data?.publicUrl) return toProxyUrl(data.publicUrl);
  } catch {}
  return null;
}

const PillTabs = ({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) => {
  const base = 'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200';
  const inactive = 'text-muted-foreground hover:text-accent-foreground hover:bg-accent/70';
  const activeCls = 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shadow-[inset_0_0_0_1px_rgba(16,185,129,.3)]';
  return (
    <div className="inline-flex items-center gap-2 bg-card/60 border border-border/60 p-2 rounded-2xl backdrop-blur-sm">
      <button className={`${base} ${active === 'competitions' ? activeCls : inactive}`} onClick={() => onChange('competitions')}>Competitions</button>
      <button className={`${base} ${active === 'jobs' ? activeCls : inactive}`} onClick={() => onChange('jobs')}>Jobs</button>
      <button className={`${base} ${active === 'gigs' ? activeCls : inactive}`} onClick={() => onChange('gigs')}>Gigs</button>
    </div>
  );
};

const Stat = ({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Icon className="h-4 w-4 text-emerald-300/90" />
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
          <h3 className="text-xl md:text-2xl font-bold text-white">{format(new Date(2025, 8, 1), 'MMMM yyyy')}</h3>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Submit your projects to the monthly leaderboard and earn points for upvotes, comments, and engagement!
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-[11px] md:text-xs font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2.5 py-1 rounded-full">Coming soon</span>
          <button className="mt-1 inline-flex items-center gap-2 rounded-xl bg-emerald-500/90 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-500 active:scale-95 transition">
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
            className="flex-1 md:flex-none md:min-w-[120px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/90 text-white px-4 py-2.5 text-sm font-semibold hover:bg-emerald-500 active:scale-95 transition"
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
          <h4 className="text-base md:text-lg font-semibold text-white truncate">{c.title}</h4>
          {ended ? (
            <span className="text-[11px] md:text-xs font-semibold text-rose-300 bg-rose-400/10 border border-rose-400/30 px-2.5 py-0.5 rounded-full">Ended</span>
          ) : (
            <span className="text-[11px] md:text-xs font-semibold text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">Open</span>
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
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/90 text-white px-3 py-2 text-sm font-semibold hover:bg-emerald-500 active:scale-95 transition"
        >
          Join
        </a>
      </div>
    </div>
  );
};

export default function HubPage() {
  const [tab, setTab] = useState<TabKey>('competitions');
  const [loading, setLoading] = useState(true);
  const [featured, setFeatured] = useState<CompetitionItem[]>([]);
  const [list, setList] = useState<CompetitionItem[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        // Try upcoming by deadline first
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
    };
    if (tab === 'competitions') run();
    return () => {};
  }, [tab]);
  return (
    <DashboardLayout>
      <div className="flex flex-col flex-1 w-full h-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        {/* Tabs header (brand removed) */}
        <div className="flex items-center justify-end">
          <PillTabs active={tab} onChange={setTab} />
        </div>

        {/* Section title */}
        <h2 className="mt-6 text-2xl md:text-3xl font-extrabold text-white">{tab === 'competitions' ? 'Competitions' : tab === 'jobs' ? 'Jobs' : 'Gigs'}</h2>
        {tab === 'competitions' && (
          <div className="mt-4 h-1 rounded-full bg-gradient-to-r from-emerald-300/40 via-emerald-400/30 to-transparent w-40" />
        )}

        {/* Content per tab */}
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

        {tab !== 'competitions' && (
          <div className="mt-10 text-center text-muted-foreground">
            Content for “{tab}” is coming soon.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

