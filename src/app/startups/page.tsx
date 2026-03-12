"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/utils/supabase';
import { toProxyUrl } from '@/utils/imageUtils';
import Image from 'next/image';
import Link from 'next/link';
import { Rocket, Plus, ChevronUp, ChevronDown, Bookmark, MapPin, X, TrendingUp, Eye, Edit, ExternalLink, FolderKanban, BarChart3, Clock, Flame, Sparkles, Trophy, Layers, Building2, CheckCircle2, Inbox } from 'lucide-react';

// ... (types and helpers unchanged)
import { fetchMyVentures, updateStartup, StartupProfile } from '@/api/startups';
import type { EntityType } from '@/api/startups';
import { fetchOrganizations, fetchStartupOrgRequests, respondToOrgRequest, type OrganizationListItem, type StartupOrgRequest } from '@/api/organizations';
import { DealFlowTab } from '@/components/investor/DealFlowTab';
import { InvestorVerifyModal } from '@/components/investor/InvestorVerifyModal';

// ── Types ─────────────────────────────────────────────────────────────────────

type StartupItem = {
  id: string;
  brand_name: string;
  description: string | null;
  elevator_pitch: string | null;
  stage: string;
  entity_type: EntityType;
  is_actively_raising: boolean;
  logo_url: string | null;
  banner_url: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
  _votes: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGES = ['ideation', 'mvp', 'scaling', 'expansion', 'maturity'] as const;

const STAGE_LABELS: Record<string, string> = {
  ideation: 'Ideation', mvp: 'MVP', scaling: 'Scaling', expansion: 'Expansion', maturity: 'Maturity',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

function resolveImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try { return toProxyUrl(raw); } catch { return raw.startsWith('http') ? raw : null; }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StartupsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-full max-w-2xl h-24 bg-muted animate-pulse rounded-2xl" />
          <div className="w-full max-w-2xl h-24 bg-muted animate-pulse rounded-2xl" />
          <div className="w-full max-w-2xl h-24 bg-muted animate-pulse rounded-2xl" />
        </div>
      </DashboardLayout>
    }>
      <StartupsPageContent />
    </Suspense>
  );
}

function StartupsPageContent() {
  const { user } = useAuth();
  const [startups, setStartups] = useState<StartupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
  const [filterStage, setFilterStage] = useState<string | null>(null);
  const [filterEntityType, setFilterEntityType] = useState<EntityType | null>(null);
  const [sortMode, setSortMode] = useState<'hot' | 'new'>('hot');
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);
  const listMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) {
        setShowListMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Tab system ──
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'directory' | 'my' | 'facilitators' | 'dealflow'>('directory');
  const [myVentures, setMyVentures] = useState<StartupProfile[]>([]);
  const [myFacilitators, setMyFacilitators] = useState<OrganizationListItem[]>([]);
  const [orgRequests, setOrgRequests] = useState<StartupOrgRequest[]>([]);
  const [investorStatus, setInvestorStatus] = useState<string>('none');
  const [primaryInterest, setPrimaryInterest] = useState<string | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'my') setActiveTab('my');
    else if (tab === 'facilitators') setActiveTab('facilitators');
    else if (tab === 'dealflow') setActiveTab('dealflow');
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    const fetchMeta = async () => {
      const [venturesRes, facilitatorRes, userRes] = await Promise.all([
        fetchMyVentures(user.id),
        fetchOrganizations({ mine: true }),
        supabase.from('users').select('investor_status, primary_interest').eq('id', user.id).single(),
      ]);
      setMyVentures(venturesRes.data ?? []);
      setMyFacilitators(facilitatorRes.data ?? []);
      setInvestorStatus(userRes.data?.investor_status ?? 'none');
      setPrimaryInterest(userRes.data?.primary_interest ?? null);
      try {
        const requestsRes = await fetchStartupOrgRequests();
        setOrgRequests(requestsRes.data);
      } catch {
        setOrgRequests([]);
      }
    };
    fetchMeta();
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('startup_profiles')
        .select('id, brand_name, description, elevator_pitch, stage, entity_type, is_actively_raising, logo_url, banner_url, city, country, created_at')
        .eq('is_published', true);

      if (filterEntityType) query = (query as typeof query).eq('entity_type', filterEntityType);
      if (filterStage) query = (query as typeof query).eq('stage', filterStage);

      const { data: rows } = await query.order('created_at', { ascending: false }).limit(60);
      const list: StartupItem[] = (rows || []).map((s: Omit<StartupItem, '_votes'>) => ({ ...s, _votes: 0 }));

      const ids = list.map(s => s.id);
      const userId = user?.id;

      const [allVotesRes, userVotesRes] = await Promise.all([
        ids.length > 0
          ? supabase.from('startup_bookmarks').select('startup_id').in('startup_id', ids)
          : Promise.resolve({ data: [] as { startup_id: string }[] }),
        userId
          ? supabase.from('startup_bookmarks').select('startup_id').eq('user_id', userId)
          : Promise.resolve({ data: [] as { startup_id: string }[] }),
      ]);

      const counts: Record<string, number> = {};
      for (const row of (allVotesRes.data ?? [])) {
        const sid = row.startup_id;
        if (sid) counts[sid] = (counts[sid] ?? 0) + 1;
      }

      const upvoted = new Set<string>(
        (userVotesRes.data ?? []).map((r: { startup_id: string }) => r.startup_id).filter(Boolean)
      );

      const merged = list.map(s => ({ ...s, _votes: counts[s.id] ?? 0 }));
      if (sortMode === 'hot') merged.sort((a, b) => b._votes - a._votes);

      setStartups(merged);
      setUpvotedIds(upvoted);
    } catch (e) {
      console.error('[Startups] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [filterStage, filterEntityType, sortMode, user?.id]);

  useEffect(() => { load(); }, [load]);

  const toggleVote = useCallback(async (startupId: string) => {
    if (!user?.id) return;
    const wasUpvoted = upvotedIds.has(startupId);

    setUpvotedIds(prev => { const n = new Set(prev); if (wasUpvoted) { n.delete(startupId); } else { n.add(startupId); } return n; });
    setStartups(prev => prev.map(s => s.id === startupId ? { ...s, _votes: Math.max(0, s._votes + (wasUpvoted ? -1 : 1)) } : s));
    setVotingIds(prev => new Set(prev).add(startupId));

    try {
      if (wasUpvoted) {
        await supabase.from('startup_bookmarks').delete().eq('user_id', user.id).eq('startup_id', startupId);
      } else {
        await supabase.from('startup_bookmarks').insert({ user_id: user.id, startup_id: startupId });
      }
    } catch {
      // Revert optimistic update on error
      setUpvotedIds(prev => { const n = new Set(prev); if (wasUpvoted) { n.add(startupId); } else { n.delete(startupId); } return n; });
      setStartups(prev => prev.map(s => s.id === startupId ? { ...s, _votes: Math.max(0, s._votes + (wasUpvoted ? 1 : -1)) } : s));
    } finally {
      setVotingIds(prev => { const n = new Set(prev); n.delete(startupId); return n; });
    }
  }, [user?.id, upvotedIds]);

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Please sign in to view startups.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        {/* ── Header ── */}
        <div className="flex items-center gap-3 pb-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground leading-tight">Directory</h1>
            {!loading && (
              <p className="text-xs text-muted-foreground">{startups.length} listed · ranked by votes</p>
            )}
          </div>
          <div className="relative shrink-0" ref={listMenuRef}>
            <button
              onClick={() => setShowListMenu(v => !v)}
              className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>List</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>
            {showListMenu && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-card border border-border rounded-2xl shadow-lg overflow-hidden py-1.5 z-50">
                <Link
                  href="/startups/create?type=startup"
                  onClick={() => setShowListMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors"
                >
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Rocket className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Startup</p>
                    <p className="text-xs text-muted-foreground">List your venture</p>
                  </div>
                </Link>
                <Link
                  href="/startups/create?type=org_project"
                  onClick={() => setShowListMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors"
                >
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FolderKanban className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Org Project</p>
                    <p className="text-xs text-muted-foreground">Club, team, or group</p>
                  </div>
                </Link>
                <Link
                  href="/organizations/create"
                  onClick={() => setShowListMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors"
                >
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Startup Facilitator</p>
                    <p className="text-xs text-muted-foreground">Incubator, accelerator, e-cell</p>
                  </div>
                </Link>
                <div className="mx-3 my-1 border-t border-border" />
                <Link
                  href="/profile/edit"
                  onClick={() => setShowListMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors"
                >
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Layers className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Personal Project</p>
                    <p className="text-xs text-muted-foreground">Add to your profile</p>
                  </div>
                </Link>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowBookmarks(true)}
            className="h-11 w-11 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <Bookmark className="h-5 w-5" />
          </button>
        </div>

        {/* ── Tab Bar ── */}
        <TabBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          showMyVentures={myVentures.length > 0}
          showFacilitators={myFacilitators.length > 0}
          showDealFlow={investorStatus === 'verified'}
        />

        {/* ── Investor Verification CTA ── */}
        {activeTab === 'directory' && investorStatus === 'none' && primaryInterest === 'investing' && (
          <div className="mb-3 p-3.5 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Verify as investor</p>
              <p className="text-xs text-muted-foreground">Access deal flow and pipeline tools</p>
            </div>
            <button
              onClick={() => setShowVerifyModal(true)}
              className="shrink-0 px-4 py-2 min-h-[44px] rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
            >
              Get Verified
            </button>
          </div>
        )}

        {/* ── Directory Tab ── */}
        {activeTab === 'directory' && (
          <>
        <Controls
          sortMode={sortMode}
          setSortMode={setSortMode}
          filterStage={filterStage}
          setFilterStage={setFilterStage}
          filterEntityType={filterEntityType}
          setFilterEntityType={setFilterEntityType}
        />

        {/* ── Content ── */}
        {loading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-card border border-border rounded-2xl p-3 flex items-start gap-3 h-24 animate-pulse">
                <div className="w-12 h-12 bg-muted rounded-full shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : startups.length === 0 ? (
          <EmptyState
            title={filterStage ? `No ${STAGE_LABELS[filterStage] ?? filterStage} startups yet` : 'No startups listed yet'}
            subtitle={filterStage ? 'Try a different stage filter' : 'Be the first to list your startup'}
          />
        ) : (
          <>
            {/* Featured Top 3 */}
            {sortMode === 'hot' && (
              <>
                <div className="flex items-center gap-2 py-3">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold text-foreground">Featured</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-4" style={{ scrollbarWidth: 'none' }}>
                  {startups.slice(0, Math.min(5, startups.length)).map((s, i) => (
                    <FeaturedCard
                      key={s.id}
                      startup={s}
                      rank={(i + 1) as 1 | 2 | 3 | 4 | 5}
                      upvoted={upvotedIds.has(s.id)}
                      loading={votingIds.has(s.id)}
                      onVote={toggleVote}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Ranked list */}
            {(sortMode === 'new' || startups.length > 5) && (
              <>
                <div className="flex items-center gap-2 py-3">
                  {sortMode === 'hot' ? <BarChart3 className="h-4 w-4 text-muted-foreground" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm font-semibold text-foreground">
                    {sortMode === 'hot' ? 'All Rankings' : 'Latest'}
                  </span>
                </div>
                <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
                  {(sortMode === 'hot' ? startups.slice(5) : startups).map((s, i) => (
                    <RankedRow
                      key={s.id}
                      startup={s}
                      rank={sortMode === 'hot' ? i + 6 : i + 1}
                      upvoted={upvotedIds.has(s.id)}
                      loading={votingIds.has(s.id)}
                      onVote={toggleVote}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
          </>
        )}

        {/* ── My Ventures Tab ── */}
        {activeTab === 'my' && myVentures.length > 0 && (
          <MyVenturesTab ventures={myVentures} onUpdate={setMyVentures} orgRequests={orgRequests} onRequestsUpdate={setOrgRequests} />
        )}

        {activeTab === 'facilitators' && myFacilitators.length > 0 && (
          <MyFacilitatorsTab facilitators={myFacilitators} />
        )}

        {/* ── Deal Flow Tab ── */}
        {activeTab === 'dealflow' && user && (
          <DealFlowTab userId={user.id} />
        )}
      </div>

      {/* Bookmarks sheet */}
      {showBookmarks && user && (
        <BookmarksSheet userId={user.id} onClose={() => setShowBookmarks(false)} />
      )}

      <InvestorVerifyModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        onSuccess={() => { setShowVerifyModal(false); setInvestorStatus('applied'); }}
      />
    </DashboardLayout>
  );
}

// ── Controls ──────────────────────────────────────────────────────────────────

function Controls({
  sortMode, setSortMode, filterStage, setFilterStage, filterEntityType, setFilterEntityType,
}: {
  sortMode: 'hot' | 'new';
  setSortMode: (m: 'hot' | 'new') => void;
  filterStage: string | null;
  setFilterStage: (s: string | null) => void;
  filterEntityType: EntityType | null;
  setFilterEntityType: (t: EntityType | null) => void;
}) {
  const [stageOpen, setStageOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (stageRef.current && !stageRef.current.contains(event.target as Node)) {
        setStageOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col sm:flex-row gap-3 pb-4 relative z-20">
      {/* Category Filter Pills */}
      <div className="flex gap-2">
        {[
          { id: null, label: 'All' },
          { id: 'startup', label: 'Startups' },
          { id: 'org_project', label: 'Projects' }
        ].map(opt => (
          <button
            key={opt.id || 'all'}
            onClick={() => setFilterEntityType(opt.id as EntityType | null)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all min-h-[36px] border ${
              filterEntityType === opt.id
                ? 'border-primary/50 text-primary bg-transparent'
                : 'border-border text-muted-foreground bg-transparent hover:text-foreground hover:border-foreground/30'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      
      {/* Custom Dropdowns */}
      <div className="flex items-center gap-2 sm:ml-auto">
        {/* Stage Dropdown */}
        <div className="relative flex-1 sm:flex-none" ref={stageRef}>
          <button
            onClick={() => setStageOpen(!stageOpen)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2 min-h-[44px] bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            <span className="truncate">{filterStage ? STAGE_LABELS[filterStage] : 'All Stages'}</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${stageOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {stageOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-lg overflow-hidden py-1 z-50">
              <button
                onClick={() => { setFilterStage(null); setStageOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors ${filterStage === null ? 'bg-primary/5 text-primary font-medium' : 'text-foreground'}`}
              >
                All Stages
              </button>
              {STAGES.map(s => (
                <button
                  key={s}
                  onClick={() => { setFilterStage(s); setStageOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors ${filterStage === s ? 'bg-primary/5 text-primary font-medium' : 'text-foreground'}`}
                >
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="relative flex-1 sm:flex-none" ref={sortRef}>
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="w-full flex items-center justify-between gap-2 pl-3 pr-4 py-2 min-h-[44px] bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {sortMode === 'hot' ? <Flame className="h-4 w-4 text-orange-500" /> : <Sparkles className="h-4 w-4 text-blue-500" />}
              <span className="truncate">{sortMode === 'hot' ? 'Hot' : 'New'}</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
          </button>

          {sortOpen && (
            <div className="absolute top-full right-0 mt-2 w-40 bg-card border border-border rounded-xl shadow-lg overflow-hidden py-1 z-50">
              <button
                onClick={() => { setSortMode('hot'); setSortOpen(false); }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors ${sortMode === 'hot' ? 'bg-primary/5 text-primary font-medium' : 'text-foreground'}`}
              >
                <Flame className={`h-4 w-4 ${sortMode === 'hot' ? 'text-orange-500' : 'text-muted-foreground'}`} />
                Hot
              </button>
              <button
                onClick={() => { setSortMode('new'); setSortOpen(false); }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors ${sortMode === 'new' ? 'bg-primary/5 text-primary font-medium' : 'text-foreground'}`}
              >
                <Sparkles className={`h-4 w-4 ${sortMode === 'new' ? 'text-blue-500' : 'text-muted-foreground'}`} />
                New
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Rank Config ───────────────────────────────────────────────────────────────

const RANK_CONFIG = {
  1: { gradient: 'from-amber-500/25 via-orange-400/10 to-transparent', border: 'border-amber-500/20', badge: 'text-amber-500 border-amber-500/30 bg-card/80' },
  2: { gradient: 'from-slate-400/20 via-blue-400/10 to-transparent', border: 'border-slate-400/20', badge: 'text-slate-400 border-slate-400/30 bg-card/80' },
  3: { gradient: 'from-orange-400/20 via-rose-400/10 to-transparent', border: 'border-orange-400/20', badge: 'text-orange-400 border-orange-400/30 bg-card/80' },
  4: { gradient: 'from-violet-400/20 via-purple-400/10 to-transparent', border: 'border-violet-400/20', badge: 'text-violet-400 border-violet-400/30 bg-card/80' },
  5: { gradient: 'from-teal-400/20 via-emerald-400/10 to-transparent', border: 'border-teal-400/20', badge: 'text-teal-400 border-teal-400/30 bg-card/80' },
} as const;

// ── Featured Card ─────────────────────────────────────────────────────────────

function FeaturedCard({ startup, rank, upvoted, loading, onVote }: {
  startup: StartupItem;
  rank: 1 | 2 | 3 | 4 | 5;
  upvoted: boolean;
  loading: boolean;
  onVote: (id: string) => void;
}) {
  const cfg = RANK_CONFIG[rank];
  const logoSrc = resolveImageUrl(startup.logo_url);
  const bannerSrc = resolveImageUrl(startup.banner_url);
  const inits = getInitials(startup.brand_name);
  const pitch = startup.elevator_pitch || startup.description || '';

  return (
    <Link
      href={`/startups/${startup.id}`}
      className={`shrink-0 w-44 flex flex-col rounded-2xl border ${cfg.border} bg-card overflow-visible hover:scale-[1.02] transition-all duration-200`}
    >
      {/* Banner — own overflow-hidden so it clips image/gradient but not the logo */}
      <div className="relative h-20 w-full rounded-t-2xl overflow-hidden">
        {bannerSrc ? (
          <Image src={bannerSrc} alt="" fill className="object-cover" unoptimized />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient}`}>
            <span className="absolute inset-0 flex items-center justify-center text-5xl font-black opacity-[0.07] text-foreground select-none tracking-tighter">
              {inits}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent" />

        {/* Rank badge */}
        <span className={`absolute top-2 left-2 text-[11px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm ${cfg.badge}`}>
          #{rank}
        </span>

        {/* Vote button */}
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onVote(startup.id); }}
          className={`absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-1 rounded-lg text-[11px] font-bold border backdrop-blur-sm transition-colors bg-card/80 ${
            upvoted ? 'text-primary border-primary/30' : 'text-muted-foreground border-border/50 hover:text-foreground'
          }`}
        >
          {loading ? <div className="h-3 w-3 bg-muted rounded-full animate-pulse" /> : <><ChevronUp className="h-3 w-3" />{startup._votes}</>}
        </button>
      </div>

      {/* Logo sits between banner and content — outside the overflow-hidden banner */}
      <div className="px-3 -mt-5 z-10 relative">
        <div className="border-2 border-card rounded-xl shadow-sm overflow-hidden w-fit">
          <LogoWidget logoSrc={logoSrc} inits={inits} size={40} />
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pt-1.5 pb-3 flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground leading-tight line-clamp-1">{startup.brand_name}</p>
        {pitch && <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{pitch}</p>}
        <div className="flex flex-wrap gap-1 mt-1.5">
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
            {STAGE_LABELS[startup.stage] ?? startup.stage}
          </span>
          {startup.is_actively_raising && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/10 text-green-600">Raising</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Ranked Row ───────────────────────────────────────────────────────────────

function RankedRow({ startup, rank, upvoted, loading, onVote }: {
  startup: StartupItem;
  rank: number;
  upvoted: boolean;
  loading: boolean;
  onVote: (id: string) => void;
}) {
  const logoSrc = resolveImageUrl(startup.logo_url);
  const inits = getInitials(startup.brand_name);
  const pitch = startup.elevator_pitch || startup.description || '';
  const location = [startup.city, startup.country].filter(Boolean).join(', ');

  return (
    <Link href={`/startups/${startup.id}`} className="block p-4 hover:bg-muted/30 transition-all">
      <div className="flex items-start gap-4">
        {/* Rank */}
        <div className="w-6 shrink-0 text-center pt-3">
          <span className="text-sm font-bold text-muted-foreground">{rank}</span>
        </div>

        {/* Logo */}
        <LogoWidget logoSrc={logoSrc} inits={inits} size={48} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <p className="text-base font-semibold text-foreground truncate">{startup.brand_name}</p>
            <div className="flex items-center gap-1.5">
              {startup.entity_type === 'org_project' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">Project</span>
              )}
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                {STAGE_LABELS[startup.stage] ?? startup.stage}
              </span>
              {startup.is_actively_raising && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-600">Raising</span>
              )}
            </div>
          </div>
          {pitch && <p className="text-sm text-muted-foreground leading-snug mt-1 line-clamp-1">{pitch}</p>}
          {location && (
            <div className="flex items-center gap-1 mt-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{location}</span>
            </div>
          )}
        </div>

        {/* Upvote */}
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onVote(startup.id); }}
          className={`shrink-0 min-w-[56px] min-h-[56px] rounded-xl flex flex-col items-center justify-center gap-1 border transition-all ${
            upvoted ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          {loading ? (
            <div className="h-5 w-5 bg-muted-foreground/20 rounded-full animate-pulse" />
          ) : (
            <>
              <ChevronUp className="h-5 w-5" />
              <span className="text-[11px] font-bold leading-none">{startup._votes}</span>
            </>
          )}
        </button>
      </div>
    </Link>
  );
}

// ── Logo Widget ───────────────────────────────────────────────────────────────

function LogoWidget({ logoSrc, inits, size }: { logoSrc: string | null; inits: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size * 0.26);

  if (logoSrc && !failed) {
    return (
      <div
        className="shrink-0 overflow-hidden border border-border bg-card"
        style={{ width: size, height: size, borderRadius: radius }}
      >
        <Image
          src={logoSrc} alt="logo" width={size} height={size}
          className="object-cover w-full h-full"
          unoptimized
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="shrink-0 flex items-center justify-center bg-muted border border-border"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <span className="font-bold leading-none text-muted-foreground" style={{ fontSize: size * 0.32 }}>{inits}</span>
    </div>
  );
}

// ── Bookmarks Sheet ───────────────────────────────────────────────────────────

type BookmarkedStartup = { id: string; brand_name: string; stage: string; keywords: string[] | null };

function BookmarksSheet({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [bookmarked, setBookmarked] = useState<BookmarkedStartup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: rows } = await supabase
          .from('startup_bookmarks')
          .select('startup_id')
          .eq('user_id', userId);

        const ids = (rows ?? []).map((r: { startup_id: string }) => r.startup_id).filter(Boolean);
        if (ids.length === 0) { setBookmarked([]); setLoading(false); return; }

        const { data } = await supabase
          .from('startup_profiles')
          .select('id, brand_name, stage, keywords')
          .in('id', ids);

        setBookmarked(data ?? []);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const removeBookmark = async (startupId: string) => {
    setBookmarked(prev => prev.filter(s => s.id !== startupId));
    await supabase.from('startup_bookmarks').delete()
      .eq('user_id', userId).eq('startup_id', startupId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg bg-card border-t border-border rounded-t-3xl flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="p-2 bg-muted rounded-xl">
            <Bookmark className="h-5 w-5 text-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">Upvoted Startups</span>
          {!loading && (
            <div className="ml-auto px-3 py-1 rounded-lg bg-muted border border-border">
              <span className="text-sm font-semibold text-foreground">{bookmarked.length}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 bg-muted/30 border border-border rounded-xl px-4 py-3 h-20 animate-pulse">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : bookmarked.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="p-4 bg-muted rounded-full">
                <Bookmark className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground">No upvoted startups yet</p>
                <p className="text-sm text-muted-foreground mt-1">Upvote startups you find interesting</p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-2 pb-10">
              {bookmarked.map(s => {
                const kw = Array.isArray(s.keywords) && s.keywords.length > 0 ? s.keywords[0] : null;
                return (
                  <Link key={s.id} href={`/startups/${s.id}`} onClick={onClose} className="block">
                    <div className="flex items-center gap-3 bg-muted/30 border border-border rounded-xl px-4 py-3 hover:bg-muted/60 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{s.brand_name}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-card text-muted-foreground border border-border">
                            {STAGE_LABELS[s.stage] ?? s.stage}
                          </span>
                          {kw && <span className="text-[11px] text-muted-foreground truncate">{kw}</span>}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); removeBookmark(s.id); }}
                        className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card rounded-xl transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="h-16 w-16 rounded-full bg-muted border border-border flex items-center justify-center">
        <Rocket className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

// ── Tab Bar ──────────────────────────────────────────────────────────────────

function TabBar({ activeTab, setActiveTab, showMyVentures, showFacilitators, showDealFlow }: {
  activeTab: string;
  setActiveTab: (tab: 'directory' | 'my' | 'facilitators' | 'dealflow') => void;
  showMyVentures: boolean;
  showFacilitators: boolean;
  showDealFlow: boolean;
}) {
  return (
    <div className="flex gap-2 pb-4 mb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      <TabPill label="Directory" active={activeTab === 'directory'} onClick={() => setActiveTab('directory')} />
      {showMyVentures && (
        <TabPill label="My Ventures" active={activeTab === 'my'} onClick={() => setActiveTab('my')} />
      )}
      {showFacilitators && (
        <TabPill label="Startup Facilitators" active={activeTab === 'facilitators'} onClick={() => setActiveTab('facilitators')} />
      )}
      {showDealFlow && (
        <TabPill label="Deal Flow" active={activeTab === 'dealflow'} onClick={() => setActiveTab('dealflow')} />
      )}
    </div>
  );
}

function TabPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium transition-all border ${
        active
          ? 'border-foreground/20 text-foreground bg-transparent'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/50'
      }`}
    >
      {label}
    </button>
  );
}

// ── My Ventures Tab ──────────────────────────────────────────────────────────

function MyVenturesTab({
  ventures,
  onUpdate,
  orgRequests,
  onRequestsUpdate,
}: {
  ventures: StartupProfile[];
  onUpdate: (v: StartupProfile[]) => void;
  orgRequests: StartupOrgRequest[];
  onRequestsUpdate: (requests: StartupOrgRequest[]) => void;
}) {
  const togglePublish = async (venture: StartupProfile) => {
    const { data } = await updateStartup(venture.id, { is_published: !venture.is_published });
    if (data) {
      onUpdate(ventures.map(v => v.id === data.id ? data : v));
    }
  };

  const handleRequestAction = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      await respondToOrgRequest(requestId, action);
      onRequestsUpdate(orgRequests.filter((request) => request.id !== requestId));
    } catch (error) {
      console.error('Failed to respond to org request:', error);
    }
  };

  return (
    <div className="space-y-4">
      {ventures.map((startup) => {
        const isProject = startup.entity_type === 'org_project';
        const pendingRequests = orgRequests.filter((request) => request.startup_id === startup.id);
        return (
          <div key={startup.id} className="space-y-4 pb-4">
            {/* Venture Overview */}
            <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-muted border border-border shrink-0">
                      {isProject ? <FolderKanban className="h-6 w-6 text-foreground" /> : <Rocket className="h-6 w-6 text-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-bold text-foreground truncate">{startup.brand_name}</h2>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                          {isProject ? 'Project' : STAGE_LABELS[startup.stage]}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${startup.is_published ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                          {startup.is_published ? 'Published' : 'Draft'}
                        </span>
                        {!isProject && startup.is_actively_raising && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-600 border border-green-500/20">
                            <TrendingUp className="h-3 w-3" /> Raising
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats - Inline Row Layout */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">{startup.view_count || 0}</span>
                    <span className="text-xs text-muted-foreground">Views</span>
                  </div>
                  <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50">
                    <span className="text-sm font-semibold text-foreground">{startup.founders?.length || 0}</span>
                    <span className="text-xs text-muted-foreground">Team</span>
                  </div>
                  {!isProject && (
                    <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50">
                      <span className="text-sm font-semibold text-foreground">{startup.funding_rounds?.length || 0}</span>
                      <span className="text-xs text-muted-foreground">Rounds</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {pendingRequests.length > 0 && (
              <div className="bg-card border border-amber-500/20 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-foreground">Pending facilitator requests</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  These startup facilitators requested to show <span className="font-medium text-foreground">{startup.brand_name}</span> under their profile. Nothing goes live unless you accept it.
                </p>
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground">{request.organization.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {request.organization.org_type.replace(/_/g, ' ')} · wants to mark this startup as {request.relation_type.replace(/_/g, ' ')}
                          </div>
                          {request.organization.short_bio && (
                            <p className="text-sm text-muted-foreground mt-2">{request.organization.short_bio}</p>
                          )}
                        </div>
                        <Link
                          href={`/organizations/${request.organization.slug}`}
                          className="shrink-0 text-xs font-medium text-primary hover:underline"
                        >
                          View org
                        </Link>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          onClick={() => handleRequestAction(request.id, 'accept')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Accept
                        </button>
                        <button
                          onClick={() => handleRequestAction(request.id, 'reject')}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/30"
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-3 gap-2">
              <Link
                href={`/startups/${startup.id}`}
                className="flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-4 w-4" /> View
              </Link>
              <Link
                href={`/startups/${startup.id}/edit`}
                className="flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Edit className="h-4 w-4" /> Edit
              </Link>
              <button
                onClick={() => togglePublish(startup)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-colors ${
                  startup.is_published
                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {startup.is_published ? 'Unpublish' : 'Publish'}
              </button>
            </div>

            {/* Separator between ventures */}
            {ventures.indexOf(startup) < ventures.length - 1 && (
              <div className="border-b border-border mt-4" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MyFacilitatorsTab({ facilitators }: { facilitators: OrganizationListItem[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {facilitators.map((facilitator) => (
          <div key={facilitator.id} className="rounded-2xl border border-border/50 bg-card p-5">
            <div className="flex items-start gap-4">
              {facilitator.logo_url ? (
                <img src={facilitator.logo_url} alt={facilitator.name} className="h-14 w-14 rounded-2xl border border-border/40 object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/15">
                  <Building2 className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">{facilitator.name}</h3>
                  <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {facilitator.org_type.replace(/_/g, ' ')}
                  </span>
                  {facilitator.is_verified && (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                      Verified
                    </span>
                  )}
                </div>
                {facilitator.short_bio && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{facilitator.short_bio}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {(facilitator.city || facilitator.state || facilitator.country) && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {[facilitator.city, facilitator.state, facilitator.country].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {facilitator.website && (
                    <span className="inline-flex items-center gap-1">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Website
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/organizations/${facilitator.slug}/dashboard`}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                Manage dashboard
              </Link>
              <Link
                href={`/organizations/${facilitator.slug}`}
                className="inline-flex items-center justify-center rounded-xl border border-border/60 px-3 py-2 text-sm font-medium hover:bg-muted/30"
              >
                View public profile
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
