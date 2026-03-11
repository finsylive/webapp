"use client";

import { useState, useEffect } from 'react';
import { fetchDealFlow, updateDealStage, removeDeal, InvestorDeal } from '@/api/investor-deals';
import { toProxyUrl } from '@/utils/imageUtils';
import Link from 'next/link';
import { ChevronDown, Trash2, Loader2, Rocket, TrendingUp } from 'lucide-react';

const STAGES = [
  { value: 'watching', label: 'Watching', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  { value: 'interested', label: 'Interested', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { value: 'in_talks', label: 'In Talks', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  { value: 'due_diligence', label: 'Due Diligence', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { value: 'invested', label: 'Invested', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { value: 'referred', label: 'Referred', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  { value: 'passed', label: 'Passed', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
];

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.value, s]));

type DealFlowTabProps = {
  userId: string;
};

export function DealFlowTab({ userId }: DealFlowTabProps) {
  const [deals, setDeals] = useState<InvestorDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStage, setFilterStage] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      const { data } = await fetchDealFlow(userId);
      if (data) setDeals(data);
      setLoading(false);
    };
    load();
  }, [userId]);

  const handleStageChange = async (dealId: string, newStage: string) => {
    const { data } = await updateDealStage(dealId, newStage);
    if (data) {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: data.stage } : d));
    }
  };

  const handleRemove = async (dealId: string) => {
    const { error } = await removeDeal(dealId);
    if (!error) {
      setDeals(prev => prev.filter(d => d.id !== dealId));
    }
  };

  const filtered = filterStage === 'all' ? deals : deals.filter(d => d.stage === filterStage);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <TrendingUp className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-base font-semibold text-foreground mb-1">No deals yet</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Browse the directory and add startups to your pipeline to track them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stage filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setFilterStage('all')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            filterStage === 'all'
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'bg-background border-border text-muted-foreground hover:border-primary/20'
          }`}
        >
          All ({deals.length})
        </button>
        {STAGES.filter(s => deals.some(d => d.stage === s.value)).map(stage => {
          const count = deals.filter(d => d.stage === stage.value).length;
          return (
            <button
              key={stage.value}
              onClick={() => setFilterStage(stage.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filterStage === stage.value
                  ? stage.color
                  : 'bg-background border-border text-muted-foreground hover:border-primary/20'
              }`}
            >
              {stage.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Deal list */}
      <div className="space-y-2">
        {filtered.map(deal => {
          const startup = deal.startup;
          const stageInfo = STAGE_MAP[deal.stage] || STAGE_MAP.watching;
          const logoUrl = startup?.logo_url ? toProxyUrl(startup.logo_url, { width: 80, quality: 80 }) : null;

          return (
            <div
              key={deal.id}
              className="flex items-center gap-3 p-3 bg-card border border-border/50 rounded-xl hover:border-border transition-colors"
            >
              {/* Logo */}
              <Link href={`/startups/${startup?.id}`} className="shrink-0">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-accent/30 flex items-center justify-center">
                  {logoUrl ? (
                    <img src={logoUrl} alt={startup?.brand_name || ''} className="w-full h-full object-cover" />
                  ) : (
                    <Rocket className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </Link>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <Link href={`/startups/${startup?.id}`} className="block">
                  <h4 className="text-sm font-medium text-foreground truncate hover:underline">
                    {startup?.brand_name || 'Unknown'}
                  </h4>
                </Link>
                <div className="flex items-center gap-2 mt-0.5">
                  {startup?.stage && (
                    <span className="text-[10px] text-muted-foreground capitalize">{startup.stage}</span>
                  )}
                  {startup?.sector && (
                    <>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="text-[10px] text-muted-foreground">{startup.sector}</span>
                    </>
                  )}
                  {startup?.is_actively_raising && (
                    <>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="text-[10px] text-emerald-500 font-medium">Raising</span>
                    </>
                  )}
                </div>
              </div>

              {/* Stage dropdown */}
              <div className="relative shrink-0">
                <select
                  value={deal.stage}
                  onChange={(e) => handleStageChange(deal.id, e.target.value)}
                  className={`appearance-none pl-2.5 pr-7 py-1 rounded-full text-[11px] font-medium border cursor-pointer ${stageInfo.color}`}
                >
                  {STAGES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3" />
              </div>

              {/* Remove */}
              <button
                onClick={() => handleRemove(deal.id)}
                className="shrink-0 p-1.5 rounded-lg text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                title="Remove from pipeline"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
