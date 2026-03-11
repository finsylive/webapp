"use client";

import { Plus, X, TrendingUp, DollarSign, BarChart3, ChevronDown } from 'lucide-react';

type FundingRound = {
  investor: string;
  amount: string;
  round_type: string;
  round_date: string;
  is_public: boolean;
};

type Step6Props = {
  data: {
    revenue_amount: string;
    revenue_currency: string;
    revenue_growth: string;
    traction_metrics: string;
    total_raised: string;
    investor_count: string;
    is_actively_raising: boolean;
    raise_target: string;
    equity_offered: string;
    min_ticket_size: string;
    funding_stage: string;
    sector: string;
  };
  fundingRounds: FundingRound[];
  onChange: (field: string, value: string | boolean) => void;
  onFundingChange: (rounds: FundingRound[]) => void;
};

const roundTypes = [
  { value: 'pre_seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
  { value: 'series_b', label: 'Series B' },
  { value: 'series_c', label: 'Series C' },
  { value: 'other', label: 'Other' },
];

const currencies = ['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'];

const fundingStages = [
  { value: 'pre_seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
  { value: 'series_b', label: 'Series B' },
  { value: 'series_c', label: 'Series C' },
  { value: 'bridge', label: 'Bridge' },
];

const inputClass = "w-full px-3.5 py-2.5 bg-background border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-colors";
const selectClass = `${inputClass} appearance-none pr-9 cursor-pointer`;

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
    </div>
  );
}

export function Step6Financials({ data, fundingRounds, onChange, onFundingChange }: Step6Props) {
  const addRound = () => {
    onFundingChange([...fundingRounds, { investor: '', amount: '', round_type: '', round_date: '', is_public: true }]);
  };

  const removeRound = (i: number) => onFundingChange(fundingRounds.filter((_, idx) => idx !== i));

  const updateRound = (i: number, field: string, value: string | boolean) => {
    const updated = [...fundingRounds];
    updated[i] = { ...updated[i], [field]: value };
    onFundingChange(updated);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground">Financials</h2>
        <p className="text-sm text-muted-foreground mt-1">Revenue and funding details — all optional</p>
      </div>

      {/* Revenue Section */}
      <div className="p-5 bg-accent/15 rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Revenue</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Monthly Amount</label>
            <input
              type="text"
              value={data.revenue_amount}
              onChange={(e) => onChange('revenue_amount', e.target.value)}
              placeholder="e.g. 50,000"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
            <SelectWrapper>
              <select
                value={data.revenue_currency}
                onChange={(e) => onChange('revenue_currency', e.target.value)}
                className={selectClass}
              >
                {currencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </SelectWrapper>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">MoM Growth</label>
            <input
              type="text"
              value={data.revenue_growth}
              onChange={(e) => onChange('revenue_growth', e.target.value)}
              placeholder="e.g. 15%"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Traction Metrics */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10">
            <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
          </div>
          Traction Metrics
        </label>
        <textarea
          value={data.traction_metrics}
          onChange={(e) => onChange('traction_metrics', e.target.value)}
          placeholder="Share key numbers: 10K MAU, 500 paying customers, 2M downloads, 30% MoM growth, 85% retention..."
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Funding Summary */}
      <div className="p-5 bg-accent/15 rounded-2xl space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Funding Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Total Raised</label>
            <input
              type="text"
              value={data.total_raised}
              onChange={(e) => onChange('total_raised', e.target.value)}
              placeholder="e.g. $1.5M"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Number of Investors</label>
            <input
              type="number"
              value={data.investor_count}
              onChange={(e) => onChange('investor_count', e.target.value)}
              placeholder="e.g. 5"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Actively Raising Toggle */}
      <button
        type="button"
        onClick={() => onChange('is_actively_raising', !data.is_actively_raising)}
        className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 ${
          data.is_actively_raising
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-transparent bg-accent/20 hover:bg-accent/30'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            data.is_actively_raising ? 'bg-emerald-500/15' : 'bg-muted'
          }`}>
            <TrendingUp className={`h-4.5 w-4.5 ${data.is_actively_raising ? 'text-emerald-500' : 'text-muted-foreground'}`} />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Actively Raising</p>
            <p className="text-xs text-muted-foreground">Show a &quot;Raising&quot; badge on your profile</p>
          </div>
        </div>
        <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${data.is_actively_raising ? 'bg-emerald-500' : 'bg-muted'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${data.is_actively_raising ? 'translate-x-5' : ''}`} />
        </div>
      </button>

      {/* Fundraising Details — visible when actively raising */}
      {data.is_actively_raising && (
        <div className="p-5 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Fundraising Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Raise Target</label>
              <input
                type="text"
                value={data.raise_target}
                onChange={(e) => onChange('raise_target', e.target.value)}
                placeholder="e.g. $500K"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Equity Offered</label>
              <input
                type="text"
                value={data.equity_offered}
                onChange={(e) => onChange('equity_offered', e.target.value)}
                placeholder="e.g. 10%"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Min Ticket Size</label>
              <input
                type="text"
                value={data.min_ticket_size}
                onChange={(e) => onChange('min_ticket_size', e.target.value)}
                placeholder="e.g. $25K"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Funding Stage</label>
              <SelectWrapper>
                <select
                  value={data.funding_stage}
                  onChange={(e) => onChange('funding_stage', e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select stage</option>
                  {fundingStages.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </SelectWrapper>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Sector</label>
            <input
              type="text"
              value={data.sector}
              onChange={(e) => onChange('sector', e.target.value)}
              placeholder="e.g. FinTech, HealthTech, SaaS"
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* Funding Rounds */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Funding Rounds</h3>
        {fundingRounds.length > 0 && (
          <div className="space-y-3 mb-3">
            {fundingRounds.map((round, i) => (
              <div key={i} className="p-4 bg-accent/15 rounded-xl border border-border/30 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Round {i + 1}</span>
                  <button type="button" onClick={() => removeRound(i)} className="p-1 rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <SelectWrapper>
                    <select
                      value={round.round_type}
                      onChange={(e) => updateRound(i, 'round_type', e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Round type</option>
                      {roundTypes.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                    </select>
                  </SelectWrapper>
                  <input
                    type="text"
                    value={round.amount}
                    onChange={(e) => updateRound(i, 'amount', e.target.value)}
                    placeholder="Amount (e.g. $500K)"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={round.investor}
                    onChange={(e) => updateRound(i, 'investor', e.target.value)}
                    placeholder="Investor name"
                    className={inputClass}
                  />
                  <input
                    type="date"
                    value={round.round_date}
                    onChange={(e) => updateRound(i, 'round_date', e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addRound}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground bg-accent/20 hover:bg-accent/40 hover:text-foreground border border-dashed border-border/50 hover:border-border transition-all"
        >
          <Plus className="h-4 w-4" /> Add Funding Round
        </button>
      </div>
    </div>
  );
}
