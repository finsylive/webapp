"use client";

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StartupProfileView } from '@/components/startups/StartupProfileView';
import { fetchStartupById, bookmarkStartup, unbookmarkStartup, upvoteStartup, unupvoteStartup, recordView, StartupProfile } from '@/api/startups';
import { createDeal, getDealForStartup, updateDealStage, removeDeal, InvestorDeal } from '@/api/investor-deals';
import { supabase } from '@/utils/supabase';
import { ArrowLeft, Plus, ChevronDown, Trash2, IndianRupee, Wallet, TrendingUp, Loader2, CheckCircle, X } from 'lucide-react';
import Link from 'next/link';
import { LoginPromptModal, useLoginPrompt } from '@/components/auth/LoginPromptModal';

export default function StartupDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;

  // Arena context from query params
  const fromArena = searchParams.get('fromArena') === '1';
  const arenaEventId = searchParams.get('eventId');
  const arenaStallId = searchParams.get('stallId');

  const [startup, setStartup] = useState<StartupProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pipeline state for verified investors
  const [investorStatus, setInvestorStatus] = useState<string>('none');
  const [deal, setDeal] = useState<InvestorDeal | null>(null);
  const [addingToPipeline, setAddingToPipeline] = useState(false);

  // Arena investment state
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [arenaBalance, setArenaBalance] = useState(0);
  const [isAudience, setIsAudience] = useState(false);
  const [isStallOwner, setIsStallOwner] = useState(false);
  const [arenaRound, setArenaRound] = useState<string | null>(null);
  const [investAmount, setInvestAmount] = useState('');
  const [investing, setInvesting] = useState(false);
  const [investError, setInvestError] = useState<string | null>(null);
  const [investSuccess, setInvestSuccess] = useState(false);
  const [stallFunding, setStallFunding] = useState(0);
  const [stallInvestorCount, setStallInvestorCount] = useState(0);
  const [loadingArena, setLoadingArena] = useState(false);
  const [joiningAudience, setJoiningAudience] = useState(false);
  const [virtualFundAmount, setVirtualFundAmount] = useState(1000000);
  const loginPrompt = useLoginPrompt();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await fetchStartupById(id, user?.id);
      if (error) {
        setError(error.message);
      } else {
        setStartup(data);
      }
      setLoading(false);

      // Record view (fire and forget)
      if (data && data.owner_id !== user?.id) {
        recordView(id, user?.id);
      }
    };
    load();
  }, [id, user?.id]);

  // Fetch investor status + existing deal
  useEffect(() => {
    if (!user) return;
    const fetchInvestor = async () => {
      const { data: userData } = await supabase.from('users').select('investor_status').eq('id', user.id).single();
      const status = userData?.investor_status ?? 'none';
      setInvestorStatus(status);

      if (status === 'verified') {
        const { data: dealData } = await getDealForStartup(user.id, id);
        if (dealData) setDeal(dealData);
      }
    };
    fetchInvestor();
  }, [user, id]);

  // Fetch arena context when coming from investment arena (works even without login)
  useEffect(() => {
    if (!fromArena || !arenaEventId || !arenaStallId) return;
    setLoadingArena(true);
    (async () => {
      try {
        // Always fetch leaderboard and event info (public data)
        const fetches: Promise<Response>[] = [
          fetch(`/api/events/${encodeURIComponent(arenaEventId)}/leaderboard`),
          fetch(`/api/events/${encodeURIComponent(arenaEventId)}`),
        ];
        // Only fetch audience (user-specific) if logged in
        if (user) {
          fetches.push(fetch(`/api/events/${encodeURIComponent(arenaEventId)}/audience`));
        }

        const responses = await Promise.all(fetches);
        const leaderJson = await responses[0].json();
        const eventJson = await responses[1].json();

        setArenaRound(leaderJson.arena_round ?? eventJson.data?.arena_round ?? null);
        setVirtualFundAmount(eventJson.data?.virtual_fund_amount ?? 1000000);

        if (user && responses[2]) {
          const audienceJson = await responses[2].json();
          setIsStallOwner(audienceJson.isStallOwner ?? false);
          if (audienceJson.audience) {
            setIsAudience(true);
            setArenaBalance(audienceJson.audience.virtual_balance ?? 0);
          }
        }

        const entry = (leaderJson.leaderboard ?? []).find((l: { id: string }) => l.id === arenaStallId);
        if (entry) {
          setStallFunding(entry.total_funding);
          setStallInvestorCount(entry.investor_count);
        }
      } catch { }
      setLoadingArena(false);
    })();
  }, [fromArena, arenaEventId, arenaStallId, user]);

  const handleJoinAudience = async () => {
    if (!user || !arenaEventId) return;
    setJoiningAudience(true);
    setInvestError(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(arenaEventId)}/audience`, { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        setIsAudience(true);
        setArenaBalance(json.audience?.virtual_balance ?? virtualFundAmount);
      } else {
        setInvestError(json.error || 'Failed to join');
      }
    } catch {
      setInvestError('Network error');
    }
    setJoiningAudience(false);
  };

  const handleArenaInvest = async () => {
    if (!user || !arenaEventId || !arenaStallId) return;
    const amount = parseInt(investAmount || '0');
    if (!amount || amount <= 0) { setInvestError('Enter a valid amount'); return; }

    setInvesting(true);
    setInvestError(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(arenaEventId)}/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stall_id: arenaStallId, amount }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setArenaBalance(json.remaining_balance);
        setInvestAmount('');
        setInvestSuccess(true);
        setStallFunding(prev => prev + amount);
        setStallInvestorCount(prev => prev + 1);
        setTimeout(() => setInvestSuccess(false), 4000);
      } else {
        setInvestError(json.error || 'Investment failed');
      }
    } catch {
      setInvestError('Network error');
    }
    setInvesting(false);
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    return amount.toLocaleString('en-IN');
  };

  const handleBookmark = async () => {
    if (!user || !startup) return;
    await bookmarkStartup(user.id, startup.id);
    setStartup(prev => prev ? { ...prev, is_bookmarked: true } : prev);
  };

  const handleUnbookmark = async () => {
    if (!user || !startup) return;
    await unbookmarkStartup(user.id, startup.id);
    setStartup(prev => prev ? { ...prev, is_bookmarked: false } : prev);
  };

  const handleUpvote = async () => {
    if (!user || !startup) return;
    await upvoteStartup(user.id, startup.id);
    setStartup(prev => prev ? { 
      ...prev, 
      is_upvoted: true, 
      upvote_count: (prev.upvote_count || 0) + 1 
    } : prev);
  };

  const handleUnupvote = async () => {
    if (!user || !startup) return;
    await unupvoteStartup(user.id, startup.id);
    setStartup(prev => prev ? { 
      ...prev, 
      is_upvoted: false, 
      upvote_count: Math.max(0, (prev.upvote_count || 0) - 1) 
    } : prev);
  };

  const isOwner = user?.id === startup?.owner_id;
  const isCofounder = !isOwner && (startup?.founders || []).some(
    f => f.user_id === user?.id && f.status === 'accepted'
  );
  const isVerifiedInvestor = investorStatus === 'verified' && !isOwner && !isCofounder;

  const handleAddToPipeline = async () => {
    if (!user) return;
    setAddingToPipeline(true);
    const { data } = await createDeal(user.id, id);
    if (data) setDeal(data);
    setAddingToPipeline(false);
  };

  const handleDealStageChange = async (stage: string) => {
    if (!deal) return;
    const { data } = await updateDealStage(deal.id, stage);
    if (data) setDeal(prev => prev ? { ...prev, stage: data.stage } : prev);
  };

  const handleRemoveFromPipeline = async () => {
    if (!deal) return;
    const { error: err } = await removeDeal(deal.id);
    if (!err) setDeal(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {fromArena && arenaEventId ? (
            <Link href={`/hub/event/${arenaEventId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]">
              <ArrowLeft className="h-4 w-4" /> Back to Arena
            </Link>
          ) : (
            <Link href="/startups" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]">
              <ArrowLeft className="h-4 w-4" /> Back to Directory
            </Link>
          )}

          <div className="flex items-center gap-2">
            {/* Pipeline controls for verified investors */}
            {isVerifiedInvestor && startup && (
              <>
                {deal ? (
                  <>
                    <div className="relative">
                      <select
                        value={deal.stage}
                        onChange={(e) => handleDealStageChange(e.target.value)}
                        className="appearance-none pl-3 pr-7 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-pointer"
                      >
                        <option value="watching">Watching</option>
                        <option value="interested">Interested</option>
                        <option value="in_talks">In Talks</option>
                        <option value="due_diligence">Due Diligence</option>
                        <option value="invested">Invested</option>
                        <option value="referred">Referred</option>
                        <option value="passed">Passed</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                    </div>
                    <button
                      onClick={handleRemoveFromPipeline}
                      className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Remove from pipeline"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleAddToPipeline}
                    disabled={addingToPipeline}
                    className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add to Pipeline
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Virtual Money Investment Modal */}
        {showInvestModal && fromArena && arenaEventId && arenaStallId && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowInvestModal(false); setInvestError(null); }} />
            <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-border/60 bg-background shadow-2xl mx-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/40 px-5 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-lg font-bold text-foreground">Invest Virtual Funds</h3>
                </div>
                <button onClick={() => { setShowInvestModal(false); setInvestError(null); }} className="shrink-0 rounded-full p-1.5 hover:bg-muted/20 transition">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-5 py-5 space-y-5">
                {/* Success message */}
                {investSuccess && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4 flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      Investment successful!
                    </p>
                  </div>
                )}

                {/* Stall funding stats */}
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">{startup?.brand_name || 'This Startup'}</p>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                        <IndianRupee className="h-5 w-5" />
                        {formatCurrency(stallFunding)}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Funding</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stallInvestorCount}</p>
                      <p className="text-xs text-muted-foreground">Investors</p>
                    </div>
                  </div>
                </div>

                {/* Not audience yet — join first */}
                {!isAudience && !isStallOwner && (
                  <div className="rounded-xl border border-border/60 bg-card/70 p-5 text-center space-y-3">
                    <Wallet className="h-10 w-10 text-emerald-500 mx-auto" />
                    <h4 className="font-bold text-lg">Join as Investor</h4>
                    <p className="text-sm text-muted-foreground">
                      Get <strong>₹{virtualFundAmount.toLocaleString('en-IN')}</strong> virtual cash to invest!
                    </p>
                    {investError && <p className="text-sm text-red-500">{investError}</p>}
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

                {/* Audience ready — show balance & invest UI */}
                {isAudience && (
                  <>
                    {/* Balance Card */}
                    <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Your Virtual Balance</p>
                          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <IndianRupee className="h-5 w-5" />
                            {arenaBalance.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <Wallet className="h-8 w-8 text-emerald-500/50" />
                      </div>
                    </div>

                    {arenaBalance > 0 ? (
                      <div className="space-y-4">
                        {/* Quick amount buttons */}
                        <div className="flex flex-wrap gap-2">
                          {[50000, 100000, 200000, 500000].filter(a => a <= arenaBalance).map(amount => (
                            <button
                              key={amount}
                              type="button"
                              onClick={() => setInvestAmount(String(amount))}
                              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                investAmount === String(amount)
                                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                  : 'border-border/60 text-muted-foreground hover:border-emerald-500/50'
                              }`}
                            >
                              ₹{formatCurrency(amount)}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setInvestAmount(String(arenaBalance))}
                            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                              investAmount === String(arenaBalance)
                                ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                : 'border-border/60 text-muted-foreground hover:border-amber-500/50'
                            }`}
                          >
                            All In
                          </button>
                        </div>

                        {/* Custom input + invest button */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-3">
                            <IndianRupee className="h-4 w-4 text-muted-foreground" />
                            <input
                              type="number"
                              placeholder="Enter amount"
                              value={investAmount}
                              onChange={e => setInvestAmount(e.target.value)}
                              min={1}
                              max={arenaBalance}
                              className="flex-1 bg-transparent text-sm outline-none"
                            />
                          </div>
                          <button
                            onClick={handleArenaInvest}
                            disabled={investing || !investAmount}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-3 text-sm transition disabled:opacity-50 whitespace-nowrap flex items-center gap-2"
                          >
                            {investing ? <Loader2 className="h-4 w-4 animate-spin" /> : <IndianRupee className="h-4 w-4" />}
                            {investing ? 'Investing...' : 'Invest'}
                          </button>
                        </div>

                        {investError && <p className="text-sm text-red-500">{investError}</p>}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 text-center">
                        <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                          You have invested all your virtual funds!
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-6 py-6 animate-pulse">
            <div className="h-48 w-full bg-muted rounded-2xl" />
            <div className="flex gap-4 items-center">
              <div className="h-20 w-20 bg-muted rounded-xl shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-6 bg-muted rounded w-1/4" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </div>
            </div>
            <div className="h-24 w-full bg-muted rounded-2xl" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-red-500">{error}</p>
          </div>
        ) : startup ? (
          <StartupProfileView
            startup={startup}
            isOwner={isOwner}
            isCofounder={isCofounder}
            onBookmark={handleBookmark}
            onUnbookmark={handleUnbookmark}
            onUpvote={handleUpvote}
            onUnupvote={handleUnupvote}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-muted-foreground">Startup not found.</p>
          </div>
        )}
        {/* Bottom spacer so content isn't hidden behind sticky bar */}
        {fromArena && arenaEventId && arenaStallId && !loadingArena && arenaRound === 'investment' && !isStallOwner && (
          <div className="h-40 md:h-28" />
        )}
      </div>

      {/* PhonePe-style sticky bottom invest bar */}
      {fromArena && arenaEventId && arenaStallId && !loadingArena && arenaRound === 'investment' && !isStallOwner && (
        <div className="fixed bottom-[60px] md:bottom-0 left-0 right-0 z-[51] border-t border-border/60 bg-background/95 backdrop-blur-md safe-bottom">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
            {user ? (
              <>
                {/* Balance info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Virtual Balance</p>
                  <p className="text-lg font-bold text-foreground flex items-center gap-0.5">
                    <IndianRupee className="h-4 w-4" />
                    {arenaBalance.toLocaleString('en-IN')}
                  </p>
                </div>
                {/* Big Invest button */}
                <button
                  onClick={() => setShowInvestModal(true)}
                  className="flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold shadow-lg shadow-emerald-600/30 transition active:scale-[0.97] min-w-[160px]"
                >
                  <IndianRupee className="h-5 w-5" />
                  Invest Now
                </button>
              </>
            ) : (
              <>
                {/* Not logged in — prompt to login */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Login to invest virtual funds</p>
                  <p className="text-xs text-muted-foreground">Join the arena and get virtual cash!</p>
                </div>
                <button
                  onClick={() => loginPrompt.open('Sign in to Invest', 'Sign in to get virtual cash and invest in startups!')}
                  className="flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold shadow-lg shadow-emerald-600/30 transition active:scale-[0.97] min-w-[160px]"
                >
                  <IndianRupee className="h-5 w-5" />
                  Login & Invest
                </button>
              </>
            )}
          </div>
        </div>
      )}
      <LoginPromptModal {...loginPrompt.modalProps} redirectTo={typeof window !== 'undefined' ? window.location.href : undefined} />
    </DashboardLayout>
  );
}
