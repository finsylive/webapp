"use client";

import { useState } from 'react';
import { X, TrendingUp, ChevronDown, Check, Loader2 } from 'lucide-react';

type InvestorVerifyModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const INVESTOR_TYPES = [
  { value: 'angel', label: 'Angel Investor' },
  { value: 'vc', label: 'Venture Capital' },
  { value: 'scout', label: 'VC Scout' },
  { value: 'syndicate_lead', label: 'Syndicate Lead' },
  { value: 'family_office', label: 'Family Office' },
  { value: 'accelerator', label: 'Accelerator / Incubator' },
  { value: 'corporate_vc', label: 'Corporate VC' },
  { value: 'government', label: 'Government Fund' },
];

const STAGE_OPTIONS = ['ideation', 'mvp', 'scaling', 'expansion', 'maturity'];
const SECTOR_SUGGESTIONS = [
  'FinTech', 'HealthTech', 'EdTech', 'SaaS', 'D2C', 'DeepTech',
  'AI/ML', 'CleanTech', 'AgriTech', 'Logistics', 'Gaming', 'Web3',
];

const inputClass = "w-full px-3.5 py-2.5 bg-background border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-colors";
const selectClass = `${inputClass} appearance-none pr-9 cursor-pointer`;

export function InvestorVerifyModal({ isOpen, onClose, onSuccess }: InvestorVerifyModalProps) {
  const [investorType, setInvestorType] = useState('');
  const [firmName, setFirmName] = useState('');
  const [affiliatedFund, setAffiliatedFund] = useState('');
  const [checkSizeMin, setCheckSizeMin] = useState('');
  const [checkSizeMax, setCheckSizeMax] = useState('');
  const [preferredStages, setPreferredStages] = useState<string[]>([]);
  const [preferredSectors, setPreferredSectors] = useState<string[]>([]);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [thesis, setThesis] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleStage = (stage: string) => {
    setPreferredStages(prev =>
      prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
    );
  };

  const toggleSector = (sector: string) => {
    setPreferredSectors(prev =>
      prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector]
    );
  };

  const handleSubmit = async () => {
    if (!investorType) {
      setError('Select your investor type');
      return;
    }
    if (!linkedinUrl.trim()) {
      setError('LinkedIn URL is required for verification');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/investor/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investor_type: investorType,
          firm_name: firmName.trim() || null,
          affiliated_fund: affiliatedFund.trim() || null,
          check_size_min: checkSizeMin.trim() || null,
          check_size_max: checkSizeMax.trim() || null,
          preferred_stages: preferredStages,
          preferred_sectors: preferredSectors,
          linkedin: linkedinUrl.trim(),
          website: website.trim() || null,
          thesis: thesis.trim() || null,
          location: location.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      onSuccess();
    } catch {
      setError('Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border/50 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-4.5 w-4.5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Verify as Investor</h2>
              <p className="text-xs text-muted-foreground">Get access to deal flow and pipeline tools</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-500">
              {error}
            </div>
          )}

          {/* Investor Type */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Investor Type *</label>
            <div className="relative">
              <select
                value={investorType}
                onChange={(e) => setInvestorType(e.target.value)}
                className={selectClass}
              >
                <option value="">Select type</option>
                {INVESTOR_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
          </div>

          {/* Firm Name */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {investorType === 'angel' ? 'Fund / Network (optional)' : 'Firm / Fund Name'}
            </label>
            <input
              type="text"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder={investorType === 'angel' ? 'e.g. Indian Angel Network' : 'e.g. Sequoia Capital'}
              className={inputClass}
            />
          </div>

          {/* Affiliated Fund — only for scouts */}
          {investorType === 'scout' && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Affiliated Fund *</label>
              <input
                type="text"
                value={affiliatedFund}
                onChange={(e) => setAffiliatedFund(e.target.value)}
                placeholder="Which fund are you scouting for?"
                className={inputClass}
              />
            </div>
          )}

          {/* Check Size */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Check Size Range</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={checkSizeMin}
                onChange={(e) => setCheckSizeMin(e.target.value)}
                placeholder="Min (e.g. $25K)"
                className={inputClass}
              />
              <input
                type="text"
                value={checkSizeMax}
                onChange={(e) => setCheckSizeMax(e.target.value)}
                placeholder="Max (e.g. $500K)"
                className={inputClass}
              />
            </div>
          </div>

          {/* Preferred Stages */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Preferred Stages</label>
            <div className="flex flex-wrap gap-2">
              {STAGE_OPTIONS.map(stage => {
                const active = preferredStages.includes(stage);
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => toggleStage(stage)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-background border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    {active && <Check className="inline h-3 w-3 mr-1" />}
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preferred Sectors */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Preferred Sectors</label>
            <div className="flex flex-wrap gap-2">
              {SECTOR_SUGGESTIONS.map(sector => {
                const active = preferredSectors.includes(sector);
                return (
                  <button
                    key={sector}
                    type="button"
                    onClick={() => toggleSector(sector)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-background border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    {active && <Check className="inline h-3 w-3 mr-1" />}
                    {sector}
                  </button>
                );
              })}
            </div>
          </div>

          {/* LinkedIn */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">LinkedIn URL *</label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/yourprofile"
              className={inputClass}
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Website (optional)</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourfund.com"
              className={inputClass}
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Mumbai, India"
              className={inputClass}
            />
          </div>

          {/* Thesis */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Investment Thesis (optional)</label>
            <textarea
              value={thesis}
              onChange={(e) => setThesis(e.target.value)}
              placeholder="What kind of companies excite you? What stage, sector, geography?"
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border/50 px-5 py-4 rounded-b-2xl">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Apply for Verification'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
