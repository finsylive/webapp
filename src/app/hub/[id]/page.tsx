"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';
import { ArrowLeft, Share2, Trophy, Users, Clock, ChevronDown, CheckCircle, Loader2, X, FolderOpen, Plus, LogOut, Bookmark, BookmarkCheck, Star, CalendarRange, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toProxyUrl } from '@/utils/imageUtils';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/context/AuthContext';

type Competition = {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  created_by: string;
  is_external: boolean;
  external_url: string | null;
  created_at: string;
  has_leaderboard: boolean;
  prize_pool: string | null;
  banner_image_url: string | null;
  // Extended fields
  tags?: string[];
  is_featured?: boolean;
  domain?: string | null;
  organizer_name?: string | null;
  participation_type?: string;
  team_size_min?: number;
  team_size_max?: number;
  eligibility_criteria?: string | null;
};

type CompetitionRound = {
  id: string;
  round_number: number;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
};

type CompetitionFaq = {
  id: string;
  question: string;
  answer: string;
  order_index: number;
};

const domainLabels: Record<string, string> = {
  hackathon: 'Hackathon', case_study: 'Case Study', quiz: 'Quiz', design: 'Design',
  coding: 'Coding', business_plan: 'Business Plan', research: 'Research',
  marketing: 'Marketing', other: 'Other',
};

type CompetitionEntry = {
  competition_id: string;
  project_id: string | null;
  submitted_by: string;
  created_at: string;
  external_entry_url: string | null;
};

type ProjectLite = {
  id: string;
  title: string;
  tagline: string | null;
  logo_url: string | null;
  cover_url: string | null;
};

function isEnded(c?: { deadline?: string | null }) {
  if (!c?.deadline) return false;
  const t = Date.parse(c.deadline);
  return isFinite(t) && t < Date.now();
}

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

export default function CompetitionDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [comp, setComp] = useState<Competition | null>(null);
  const [participants, setParticipants] = useState(0);
  const [entries, setEntries] = useState<(CompetitionEntry & { project?: ProjectLite | null; username?: string | null })[]>([]);
  const [aboutOpen, setAboutOpen] = useState(true);
  const [rounds, setRounds] = useState<CompetitionRound[]>([]);
  const [faqs, setFaqs] = useState<CompetitionFaq[]>([]);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSavingBookmark] = useState(false);

  // Join button state
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [checkingJoin, setCheckingJoin] = useState(true);

  const [unjoining, setUnjoining] = useState(false);

  // Project picker modal state
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [userProjects, setUserProjects] = useState<ProjectLite[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [compRes, entriesRes, roundsRes, faqsRes] = await Promise.all([
          fetch(`/api/competitions/${encodeURIComponent(id)}`, { cache: 'no-store' }),
          fetch(`/api/competitions/${encodeURIComponent(id)}/entries`, { cache: 'no-store' }),
          supabase.from('competition_rounds').select('*').eq('competition_id', id).order('round_number'),
          supabase.from('competition_faqs').select('*').eq('competition_id', id).order('order_index'),
        ]);
        const compJson = await compRes.json();
        const entriesJson = await entriesRes.json();
        if (cancelled) return;
        setComp(compJson.data || null);
        setParticipants(compJson.participants || 0);
        setRounds((roundsRes.data ?? []) as CompetitionRound[]);
        setFaqs((faqsRes.data ?? []) as CompetitionFaq[]);

        const baseEntries: CompetitionEntry[] = Array.isArray(entriesJson.data) ? entriesJson.data : [];
        // Fetch project details for entries using the username-based API
        const usernameCache = new Map<string, string | null>(); // submitted_by -> username
        const projectCache = new Map<string, ProjectLite | null>(); // project_id -> project lite

        async function getUsernameById(userId: string): Promise<string | null> {
          if (usernameCache.has(userId)) return usernameCache.get(userId)!;
          try {
            const res = await fetch(`/api/users/by-id/${encodeURIComponent(userId)}`, { cache: 'no-store' });
            const json = await res.json();
            const uname = json?.data?.username ? String(json.data.username) : null;
            usernameCache.set(userId, uname);
            return uname;
          } catch {
            usernameCache.set(userId, null);
            return null;
          }
        }

        async function getProjectByUsername(uname: string, projectId: string): Promise<ProjectLite | null> {
          const cacheKey = `${uname}:${projectId}`;
          if (projectCache.has(cacheKey)) return projectCache.get(cacheKey)!;
          try {
            const r = await fetch(`/api/users/${encodeURIComponent(uname)}/projects/${encodeURIComponent(projectId)}`, { cache: 'no-store' });
            const j = await r.json();
            const p = j?.data as ProjectLite | undefined;
            const out = p ? {
              id: p.id,
              title: p.title,
              tagline: p.tagline ?? null,
              logo_url: p.logo_url ?? null,
              cover_url: p.cover_url ?? null,
            } : null;
            projectCache.set(cacheKey, out);
            return out;
          } catch {
            projectCache.set(cacheKey, null);
            return null;
          }
        }

        const hydrated = await Promise.all(baseEntries.map(async (e) => {
          if (!e.project_id) return { ...e, project: null, username: await getUsernameById(e.submitted_by) };
          const uname = await getUsernameById(e.submitted_by);
          if (!uname) return { ...e, project: null, username: null };
          const proj = await getProjectByUsername(uname, e.project_id);
          return { ...e, project: proj, username: uname };
        }));
        setEntries(hydrated);
      } catch (e) {
        console.error('Failed to load competition details', e);
        if (!cancelled) {
          setComp(null);
          setParticipants(0);
          setEntries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Check if user already joined + check saved state
  useEffect(() => {
    if (!id || !user) { setCheckingJoin(false); return; }
    let cancelled = false;
    (async () => {
      setCheckingJoin(true);
      try {
        const [entryRes, savedRes] = await Promise.all([
          supabase
            .from('competition_entries')
            .select('submitted_by')
            .eq('competition_id', id)
            .eq('submitted_by', user.id)
            .maybeSingle(),
          supabase
            .from('saved_competitions')
            .select('id')
            .eq('competition_id', id)
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);
        if (!cancelled) {
          setJoined(!!entryRes.data);
          setSaved(!!savedRes.data);
        }
      } catch { }
      if (!cancelled) setCheckingJoin(false);
    })();
    return () => { cancelled = true; };
  }, [id, user]);

  // Open the project picker (or redirect for external competitions)
  const handleJoinClick = async () => {
    if (!user || !comp) return;

    // External competitions: redirect to external URL
    if (comp.is_external && comp.external_url) {
      window.open(comp.external_url, '_blank', 'noopener,noreferrer');
      return;
    }

    // Open the project picker modal and fetch user's projects
    setShowProjectPicker(true);
    setLoadingProjects(true);
    setJoinError(null);
    try {
      // Resolve username from user id
      let uname = currentUsername;
      if (!uname) {
        const res = await fetch(`/api/users/by-id/${encodeURIComponent(user.id)}`, { cache: 'no-store' });
        const json = await res.json();
        uname = json?.data?.username ? String(json.data.username) : null;
        setCurrentUsername(uname);
      }
      if (uname) {
        const res = await fetch(`/api/users/${encodeURIComponent(uname)}/projects`, { cache: 'no-store' });
        const json = await res.json();
        const projects: ProjectLite[] = Array.isArray(json.data)
          ? json.data.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            title: p.title as string,
            tagline: (p.tagline as string) ?? null,
            logo_url: (p.logo_url as string) ?? null,
            cover_url: (p.cover_url as string) ?? null,
          }))
          : [];
        setUserProjects(projects);
      } else {
        setUserProjects([]);
      }
    } catch {
      setUserProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Submit the join with an optional project
  const handleConfirmJoin = async (projectId?: string) => {
    if (!user || !comp) return;

    setShowProjectPicker(false);
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/competitions/${encodeURIComponent(comp.id)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, projectId: projectId || null }),
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

  // Leave / unjoin competition
  const handleLeave = async () => {
    if (!user || !comp) return;

    setUnjoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/competitions/${encodeURIComponent(comp.id)}/join`, {
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
    if (!user || !comp) return;
    setSavingBookmark(true);
    try {
      if (saved) {
        await supabase
          .from('saved_competitions')
          .delete()
          .eq('competition_id', comp.id)
          .eq('user_id', user.id);
        setSaved(false);
      } else {
        await supabase
          .from('saved_competitions')
          .insert({ competition_id: comp.id, user_id: user.id });
        setSaved(true);
      }
    } catch { }
    setSavingBookmark(false);
  };

  const bannerUrl = useMemo(() => resolveBannerUrl(comp?.banner_image_url), [comp?.banner_image_url]);
  const ended = comp ? isEnded(comp) : false;

  const share = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      navigator.share({ title: comp?.title || 'Competition', url }).catch(() => { });
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
              disabled={saving}
              aria-label={saved ? 'Unsave' : 'Save'}
            >
              {saved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="rounded-xl bg-accent/30 hover:bg-accent/60 border border-border/50" onClick={share} aria-label="Share">
            <Share2 className="h-5 w-5" />
          </Button>
        </div>

        {/* Banner */}
        <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-[160px] md:min-h-[220px]">
          {bannerUrl && (
            <img src={bannerUrl} alt={comp?.title || 'Cover'} className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/35" />
          <div className="relative p-5 md:p-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {comp?.is_featured && (
                <span className="flex items-center gap-1 text-xs font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                  <Star className="h-3 w-3 fill-white" /> Featured
                </span>
              )}
              {comp?.domain && (
                <span className="text-xs font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full">
                  {domainLabels[comp.domain] ?? comp.domain}
                </span>
              )}
              {comp?.participation_type === 'team' && (
                <span className="text-xs font-semibold bg-blue-500/70 text-white px-2 py-0.5 rounded-full">
                  Team ({comp.team_size_min}–{comp.team_size_max})
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white drop-shadow max-w-3xl">{comp?.title || (loading ? 'Loading…' : 'Competition')}</h1>
            {comp?.organizer_name && (
              <p className="text-white/70 text-sm mt-1">by {comp.organizer_name}</p>
            )}
            {(comp?.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(comp?.tags ?? []).slice(0, 5).map((tag) => (
                  <span key={tag} className="text-[10px] font-medium bg-white/10 text-white/80 px-1.5 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats & CTA */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full border ${ended ? 'text-rose-600 dark:text-rose-300 bg-rose-400/10 border-rose-500/30 dark:border-rose-400/30' : 'text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 border-emerald-500/30 dark:border-emerald-400/30'}`}>
              {ended ? 'Ended' : 'Open'}
            </span>
            {comp?.prize_pool && (
              <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-card/70 border border-border/60">
                <Trophy className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                <span className="text-emerald-600 dark:text-emerald-300 font-bold">{comp.prize_pool}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-card/70 border border-border/60">
              <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              <span>Participants: {participants}</span>
            </span>
            <span className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-card/70 border border-border/60">
              <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              <span>{comp?.deadline ? format(new Date(comp.deadline), 'dd MMM, yyyy') : 'No deadline'}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!ended && (
              <>
                {joined ? (
                  <>
                    <span className="inline-flex items-center gap-2 rounded-xl font-semibold px-5 py-3 border bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400/40">
                      <CheckCircle className="h-4 w-4" />
                      Joined
                    </span>
                    <button
                      onClick={handleLeave}
                      disabled={unjoining}
                      className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold px-4 py-3 transition active:scale-95 border border-red-400/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"
                      title="Leave competition"
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
                    onClick={handleJoinClick}
                    disabled={joining || checkingJoin}
                    className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold px-5 py-3 transition active:scale-95 border bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500/90 dark:hover:bg-emerald-500 text-white border-emerald-400/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkingJoin ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : joining ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      'Join Competition'
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

        {/* Project Picker Modal */}
        {showProjectPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowProjectPicker(false)}>
            <div className="relative w-full max-w-md mx-4 rounded-2xl border border-border/60 bg-card shadow-xl" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h2 className="text-lg font-bold">Join with a Project</h2>
                <button onClick={() => setShowProjectPicker(false)} className="rounded-lg p-1.5 hover:bg-accent/60 transition" aria-label="Cancel">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="px-5 text-sm text-muted-foreground mb-3">
                Select one of your projects to submit.
              </p>

              {/* Project list */}
              <div className="px-5 max-h-64 overflow-y-auto">
                {loadingProjects ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : userProjects.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-center">
                    <FolderOpen className="h-10 w-10 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">You don&apos;t have any projects yet.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {userProjects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleConfirmJoin(p.id)}
                        className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-3 text-left hover:bg-accent/50 transition"
                      >
                        {p.logo_url ? (
                          <Image src={toProxyUrl(p.logo_url)} alt={p.title} width={40} height={40} className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-muted/40 flex items-center justify-center text-sm font-semibold text-muted-foreground flex-shrink-0">
                            {p.title.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{p.title}</div>
                          {p.tagline && <div className="text-xs text-muted-foreground truncate">{p.tagline}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 px-5 pt-4 pb-5">
                {currentUsername && (
                  <a
                    href={`/profile/${encodeURIComponent(currentUsername)}/projects`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 px-4 py-2.5 text-sm font-medium hover:bg-accent/40 transition"
                  >
                    <Plus className="h-4 w-4" />
                    Create a New Project
                  </a>
                )}
                <button
                  onClick={() => setShowProjectPicker(false)}
                  className="rounded-xl border border-border/60 px-4 py-2.5 text-sm font-medium hover:bg-accent/40 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* About */}
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/70 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold"
            onClick={() => setAboutOpen(o => !o)}
          >
            <span>About this competition</span>
            <ChevronDown className={`h-5 w-5 transition-transform ${aboutOpen ? 'rotate-180' : ''}`} />
          </button>
          {aboutOpen && (
            <div className="px-5 pb-5 text-muted-foreground whitespace-pre-wrap">
              {comp?.description || 'No description provided.'}
            </div>
          )}
        </div>

        {/* Eligibility */}
        {comp?.eligibility_criteria && (
          <div className="mt-6 rounded-2xl border border-border/60 bg-card/70 p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              <h3 className="text-base font-semibold">Eligibility</h3>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{comp.eligibility_criteria}</p>
          </div>
        )}

        {/* Rounds Timeline */}
        {rounds.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border/60 bg-card/70 p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarRange className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              <h3 className="text-base font-semibold">Timeline</h3>
            </div>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-border/60" />
              <div className="space-y-5 pl-8">
                {rounds.map((round) => {
                  const now = Date.now();
                  const start = round.start_date ? Date.parse(round.start_date) : null;
                  const end = round.end_date ? Date.parse(round.end_date) : null;
                  const active = start && end ? now >= start && now <= end : false;
                  const done = end ? now > end : false;
                  return (
                    <div key={round.id} className="relative">
                      <div className={`absolute -left-5 top-0.5 h-4 w-4 rounded-full border-2 ${done ? 'bg-emerald-500 border-emerald-500' : active ? 'bg-emerald-400 border-emerald-400' : 'bg-background border-border'}`} />
                      <div className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${done ? 'text-emerald-600 dark:text-emerald-300' : active ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                        Round {round.round_number}{active ? ' · Active' : done ? ' · Completed' : ''}
                      </div>
                      <div className="font-semibold text-foreground">{round.title}</div>
                      {round.description && <p className="text-sm text-muted-foreground mt-0.5">{round.description}</p>}
                      {(round.start_date || round.end_date) && (
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          {round.start_date && <span>Start: {format(new Date(round.start_date), 'dd MMM yyyy')}</span>}
                          {round.end_date && <span>End: {format(new Date(round.end_date), 'dd MMM yyyy')}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* FAQs */}
        {faqs.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border/60 bg-card/70 overflow-hidden">
            <div className="flex items-center gap-2 px-5 pt-5 pb-3">
              <HelpCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              <h3 className="text-base font-semibold">FAQs</h3>
            </div>
            <div className="divide-y divide-border/60">
              {faqs.map((faq) => (
                <div key={faq.id}>
                  <button
                    className="w-full flex items-center justify-between px-5 py-3.5 text-left text-sm font-medium hover:bg-muted/20 transition-colors"
                    onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                  >
                    <span>{faq.question}</span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 ml-2 transition-transform ${openFaq === faq.id ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === faq.id && (
                    <div className="px-5 pb-4 text-sm text-muted-foreground">{faq.answer}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Entries */}
        <div className="mt-6">
          <h3 className="text-lg md:text-xl font-bold">Entries ({participants})</h3>
          <div className="mt-4 grid gap-3">
            {loading ? (
              <>
                <div className="h-20 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                <div className="h-20 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
              </>
            ) : entries.length === 0 ? (
              <div className="text-sm text-muted-foreground">No entries yet.</div>
            ) : (
              entries.map((e) => {
                const p = e.project;
                return (
                  <div key={`${e.competition_id}-${e.submitted_by}-${e.created_at}`} className="rounded-2xl bg-card/70 border border-border/60 p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Project avatar */}
                      {p?.logo_url ? (
                        <Image src={toProxyUrl(p.logo_url)} alt={p.title} width={44} height={44} className="h-11 w-11 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-11 w-11 rounded-xl bg-muted/40 flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">{p ? p.title.charAt(0) : '•'}</div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{p ? p.title : (e.project_id ? 'Project Submission' : 'External Entry')}</div>
                        <div className="text-sm text-muted-foreground truncate">{p?.tagline || e.external_entry_url || 'Participant'}</div>
                      </div>
                    </div>
                    {e.external_entry_url ? (
                      <a href={e.external_entry_url} target="_blank" rel="noopener noreferrer" className="rounded-xl px-3 py-2 text-sm font-semibold border border-border/60 hover:bg-accent/60">View</a>
                    ) : p ? (
                      e.username ? (
                        <a href={`/profile/${encodeURIComponent(e.username)}/projects/${encodeURIComponent(p.id)}`} className="rounded-xl px-3 py-2 text-sm font-semibold border border-border/60 hover:bg-accent/60">View</a>
                      ) : (
                        <a href={`/projects/${encodeURIComponent(p.id)}`} className="rounded-xl px-3 py-2 text-sm font-semibold border border-border/60 hover:bg-accent/60">View</a>
                      )
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
