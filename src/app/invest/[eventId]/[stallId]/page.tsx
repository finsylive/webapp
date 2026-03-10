"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  IndianRupee, Loader2, Wallet, Store, TrendingUp, CheckCircle, ExternalLink, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { LoginPromptModal } from '@/components/auth/LoginPromptModal';

type StallInfo = {
  id: string;
  stall_name: string;
  tagline: string | null;
  description: string | null;
  category: string | null;
  startup?: { id: string; brand_name: string; stage: string; website: string | null } | null;
};

type EventInfo = {
  id: string;
  title: string;
  arena_enabled: boolean;
  arena_round: string | null;
  virtual_fund_amount: number;
};

export default function InvestViaQRPage() {
  const params = useParams<{ eventId: string; stallId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const eventId = params?.eventId as string;
  const stallId = params?.stallId as string;

  const [showLogin, setShowLogin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stall, setStall] = useState<StallInfo | null>(null);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Audience state
  const [isAudience, setIsAudience] = useState(false);
  const [isStallOwner, setIsStallOwner] = useState(false);
  const [virtualBalance, setVirtualBalance] = useState(0);
  const [joiningAudience, setJoiningAudience] = useState(false);

  // Investment state
  const [investAmount, setInvestAmount] = useState('');
  const [investing, setInvesting] = useState(false);
  const [investError, setInvestError] = useState<string | null>(null);
  const [investSuccess, setInvestSuccess] = useState(false);

  // Funding stats
  const [totalFunding, setTotalFunding] = useState(0);
  const [investorCount, setInvestorCount] = useState(0);

  // Fetch event + stall info
  useEffect(() => {
    if (!eventId || !stallId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [eventRes, stallsRes] = await Promise.all([
          fetch(`/api/events/${encodeURIComponent(eventId)}`),
          fetch(`/api/events/${encodeURIComponent(eventId)}/stalls`),
        ]);
        const eventJson = await eventRes.json();
        const stallsJson = await stallsRes.json();

        if (cancelled) return;

        const eventData = eventJson.data;
        if (!eventData) { setError('Event not found'); setLoading(false); return; }
        if (!eventData.arena_enabled) { setError('Investment Arena is not enabled for this event'); setLoading(false); return; }

        setEvent(eventData);

        const foundStall = (stallsJson.stalls ?? []).find((s: StallInfo) => s.id === stallId);
        if (!foundStall) { setError('Stall not found'); setLoading(false); return; }
        setStall(foundStall);

        // Fetch leaderboard for this stall's stats
        const leaderRes = await fetch(`/api/events/${encodeURIComponent(eventId)}/leaderboard`);
        const leaderJson = await leaderRes.json();
        const entry = (leaderJson.leaderboard ?? []).find((l: { id: string }) => l.id === stallId);
        if (entry) {
          setTotalFunding(entry.total_funding);
          setInvestorCount(entry.investor_count);
        }
      } catch {
        if (!cancelled) setError('Failed to load stall information');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [eventId, stallId]);

  // Check user's arena role
  useEffect(() => {
    if (!event?.arena_enabled || !eventId || !user) return;
    (async () => {
      try {
        const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/audience`);
        const json = await res.json();
        setIsStallOwner(json.isStallOwner ?? false);
        if (json.audience) {
          setIsAudience(true);
          setVirtualBalance(json.audience.virtual_balance ?? 0);
        }
      } catch { /* ignore */ }
    })();
  }, [event?.arena_enabled, eventId, user]);

  const handleJoinAudience = async () => {
    if (!user || !event) return;
    setJoiningAudience(true);
    setInvestError(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/audience`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setIsAudience(true);
        setVirtualBalance(json.audience?.virtual_balance ?? event.virtual_fund_amount ?? 1000000);
      } else {
        setInvestError(json.error || 'Failed to join as investor');
      }
    } catch {
      setInvestError('Network error');
    }
    setJoiningAudience(false);
  };

  const handleInvest = async () => {
    if (!user || !event || !stall) return;
    const amount = parseInt(investAmount || '0');
    if (!amount || amount <= 0) { setInvestError('Enter a valid amount'); return; }

    setInvesting(true);
    setInvestError(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stall_id: stallId, amount }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setVirtualBalance(json.remaining_balance);
        setInvestAmount('');
        setInvestSuccess(true);
        setTotalFunding(prev => prev + amount);
        setInvestorCount(prev => prev + 1);
        // Reset success after a few seconds
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto" />
          <p className="text-sm text-muted-foreground">Loading stall...</p>
        </div>
      </div>
    );
  }

  if (error || !stall || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-sm">
          <Store className="h-12 w-12 text-muted-foreground/50 mx-auto" />
          <h1 className="text-xl font-bold">{error || 'Stall not found'}</h1>
          <p className="text-sm text-muted-foreground">This QR code may be invalid or the event may have ended.</p>
          <Button variant="outline" onClick={() => router.push('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Go Home
          </Button>
        </div>
      </div>
    );
  }

  const isInvestmentRound = event.arena_round === 'investment';

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/60 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.push(`/hub/event/${eventId}`)} className="shrink-0 rounded-xl p-2 hover:bg-muted/20 transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground truncate">{event.title}</p>
            <p className="font-semibold text-sm truncate">{stall.stall_name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Stall Header Card */}
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-emerald-500" />
            <h1 className="text-xl font-bold">{stall.stall_name}</h1>
          </div>

          {stall.tagline && (
            <p className="text-sm text-muted-foreground italic">&ldquo;{stall.tagline}&rdquo;</p>
          )}

          <div className="flex flex-wrap gap-2">
            {stall.category && (
              <span className="text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full capitalize">
                {stall.category}
              </span>
            )}
            {stall.startup && (
              <a
                href={`/startups/${stall.startup.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full hover:underline"
              >
                <Store className="h-3 w-3" />
                {stall.startup.brand_name} — {stall.startup.stage}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {stall.description && (
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{stall.description}</p>
          )}
        </div>

        {/* Funding Stats */}
        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                <IndianRupee className="h-5 w-5" />
                {formatCurrency(totalFunding)}
              </p>
              <p className="text-xs text-muted-foreground">Total Funding</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{investorCount}</p>
              <p className="text-xs text-muted-foreground">Investors</p>
            </div>
          </div>
        </div>

        {/* Success message */}
        {investSuccess && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Investment successful! Thank you for backing this {event.arena_round === 'investment' ? 'startup' : 'project'}.
            </p>
          </div>
        )}

        {/* Not logged in */}
        {!user && (
          <div className="rounded-2xl border border-border/60 bg-card/70 p-6 text-center space-y-3">
            <Wallet className="h-10 w-10 text-blue-500 mx-auto" />
            <h2 className="font-bold text-lg">Sign in to Invest</h2>
            <p className="text-sm text-muted-foreground">
              Log in to your Ments account to receive virtual funds and invest in this stall.
            </p>
            <Button
              onClick={() => setShowLogin(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Sign In
            </Button>
          </div>
        )}

        <LoginPromptModal
          open={showLogin}
          onClose={() => setShowLogin(false)}
          title="Sign in to Invest"
          description="Sign in with Google to receive virtual funds and invest in this stall."
          redirectTo={`/invest/${eventId}/${stallId}`}
        />

        {/* Not investment round */}
        {user && !isInvestmentRound && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-5 text-center">
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
              {event.arena_round === 'registration'
                ? 'The investment round has not started yet. Please wait for the organizer to open Round 2.'
                : 'The investment arena has concluded. Check the final results on the event page.'}
            </p>
            <button
              onClick={() => router.push(`/hub/event/${eventId}`)}
              className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View Event Page
            </button>
          </div>
        )}

        {/* User is a stall owner */}
        {user && isInvestmentRound && isStallOwner && (
          <div className="rounded-2xl border border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-5 text-center">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>You are a stall owner</strong> in this event. Stall owners cannot invest as audience.
            </p>
          </div>
        )}

        {/* Join as audience first */}
        {user && isInvestmentRound && !isStallOwner && !isAudience && (
          <div className="rounded-2xl border border-border/60 bg-card/70 p-6 text-center space-y-3">
            <Wallet className="h-10 w-10 text-blue-500 mx-auto" />
            <h2 className="font-bold text-lg">Join as Investor</h2>
            <p className="text-sm text-muted-foreground">
              Get <strong>₹{(event.virtual_fund_amount ?? 1000000).toLocaleString('en-IN')}</strong> virtual cash to invest in stalls!
            </p>
            {investError && <p className="text-sm text-red-500">{investError}</p>}
            <button
              onClick={handleJoinAudience}
              disabled={joiningAudience}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 text-sm transition disabled:opacity-50"
            >
              {joiningAudience ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {joiningAudience ? 'Joining...' : 'Join & Get Virtual Cash'}
            </button>
          </div>
        )}

        {/* Investment section (audience is ready) */}
        {user && isInvestmentRound && isAudience && !isStallOwner && (
          <div className="space-y-4">
            {/* Balance */}
            <div className="rounded-2xl border-2 border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Your Virtual Balance</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <IndianRupee className="h-5 w-5" />
                    {virtualBalance.toLocaleString('en-IN')}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-blue-500/50" />
              </div>
            </div>

            {virtualBalance > 0 ? (
              <div className="rounded-2xl border border-border/60 bg-card/70 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  <h3 className="font-semibold">Invest in {stall.stall_name}</h3>
                </div>

                {/* Quick amount buttons */}
                <div className="flex flex-wrap gap-2">
                  {[50000, 100000, 200000, 500000].filter(a => a <= virtualBalance).map(amount => (
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
                    onClick={() => setInvestAmount(String(virtualBalance))}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      investAmount === String(virtualBalance)
                        ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'border-border/60 text-muted-foreground hover:border-amber-500/50'
                    }`}
                  >
                    All In
                  </button>
                </div>

                {/* Custom input */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-3">
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="number"
                      placeholder="Enter amount"
                      value={investAmount}
                      onChange={e => setInvestAmount(e.target.value)}
                      min={1}
                      max={virtualBalance}
                      className="flex-1 bg-transparent text-sm outline-none"
                    />
                  </div>
                  <button
                    onClick={handleInvest}
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
          </div>
        )}

        {/* Link back to event */}
        <div className="text-center pt-2">
          <button
            onClick={() => router.push(`/hub/event/${eventId}`)}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            View full event page &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
