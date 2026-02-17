"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import {
  ArrowLeft, Share2, Clock, ExternalLink, ChevronDown,
  MapPin, Building2, Users, Target, TrendingUp, Briefcase, UserCheck,
  Tag, DollarSign, CreditCard, Shield, Percent, Calendar, FileText,
  Monitor, Star, Package, Sparkles, Eye, ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';

type ResourceDetail = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  icon: string | null;
  logo_url: string | null;
  category: string;
  provider: string | null;
  eligibility: string | null;
  deadline: string | null;
  tags: string[];
  metadata: Record<string, string> | null;
  created_at: string;
  is_active: boolean;
};

type RelatedResource = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  icon: string | null;
  logo_url: string | null;
  category: string;
  provider: string | null;
  deadline: string | null;
  tags: string[];
};

type RecommendedResource = RelatedResource & { ai_reason?: string };

function isEnded(deadline?: string | null) {
  if (!deadline) return false;
  const t = Date.parse(deadline);
  return isFinite(t) && t < Date.now();
}

const categoryLabels: Record<string, string> = {
  govt_scheme: 'Govt Scheme',
  accelerator_incubator: 'Accelerator / Incubator',
  company_offer: 'Company Offer',
  tool: 'Tool',
  bank_offer: 'Bank Offer',
  scheme: 'Scheme',
};

const categoryColors: Record<string, string> = {
  govt_scheme: 'text-blue-700 dark:text-blue-300 bg-blue-400/10 border-blue-500/30',
  accelerator_incubator: 'text-purple-700 dark:text-purple-300 bg-purple-400/10 border-purple-500/30',
  company_offer: 'text-amber-700 dark:text-amber-300 bg-amber-400/10 border-amber-500/30',
  tool: 'text-cyan-700 dark:text-cyan-300 bg-cyan-400/10 border-cyan-500/30',
  bank_offer: 'text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 border-emerald-500/30',
  scheme: 'text-indigo-700 dark:text-indigo-300 bg-indigo-400/10 border-indigo-500/30',
};

function getResourceLogoUrl(resource: { logo_url?: string | null; url?: string | null }): string | null {
  if (resource.logo_url) return resource.logo_url;
  if (resource.url) {
    try {
      const domain = new URL(resource.url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {}
  }
  return null;
}

// Scheme/accelerator metadata display
function SchemeMetadataSection({ meta }: { meta: Record<string, string> }) {
  const hasContent = meta.location || meta.sectors || meta.avg_startup_age || meta.avg_num_founders || meta.avg_founder_age || meta.recent_investments || meta.companies_invested;
  if (!hasContent) return null;

  return (
    <div className="space-y-3 rounded-2xl bg-card/70 border border-border/60 p-5">
      <h3 className="text-sm font-semibold text-foreground">Scheme Details</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {meta.location && (
          <MetaItem icon={MapPin} label="Location" value={meta.location} />
        )}
        {meta.sectors && (
          <MetaItem icon={Target} label="Sectors" value={meta.sectors} />
        )}
        {meta.avg_startup_age && (
          <MetaItem icon={Building2} label="Avg Startup Age" value={meta.avg_startup_age} />
        )}
        {meta.avg_num_founders && (
          <MetaItem icon={Users} label="Avg No. of Founders" value={meta.avg_num_founders} />
        )}
        {meta.avg_founder_age && (
          <MetaItem icon={UserCheck} label="Avg Founder Age" value={meta.avg_founder_age} />
        )}
      </div>
      {meta.recent_investments && (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            <p className="text-[11px] text-muted-foreground font-medium">Recent Investments</p>
          </div>
          <p className="text-sm text-foreground whitespace-pre-line">{meta.recent_investments}</p>
        </div>
      )}
      {meta.companies_invested && (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Briefcase className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            <p className="text-[11px] text-muted-foreground font-medium">Companies Invested</p>
          </div>
          <p className="text-sm text-foreground whitespace-pre-line">{meta.companies_invested}</p>
        </div>
      )}
    </div>
  );
}

// Company offer metadata display
function CompanyOfferMetadataSection({ meta }: { meta: Record<string, string> }) {
  const hasContent = meta.discount_value || meta.promo_code || meta.valid_until || meta.terms;
  if (!hasContent) return null;

  return (
    <div className="space-y-3 rounded-2xl bg-card/70 border border-border/60 p-5">
      <h3 className="text-sm font-semibold text-foreground">Offer Details</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {meta.discount_value && (
          <MetaItem icon={Percent} label="Discount" value={meta.discount_value} />
        )}
        {meta.promo_code && (
          <MetaItem icon={Tag} label="Promo Code" value={meta.promo_code} />
        )}
        {meta.valid_until && (
          <MetaItem icon={Calendar} label="Valid Until" value={meta.valid_until} />
        )}
      </div>
      {meta.terms && (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            <p className="text-[11px] text-muted-foreground font-medium">Terms & Conditions</p>
          </div>
          <p className="text-sm text-foreground whitespace-pre-line">{meta.terms}</p>
        </div>
      )}
    </div>
  );
}

// Tool metadata display
function ToolMetadataSection({ meta }: { meta: Record<string, string> }) {
  const hasContent = meta.pricing_model || meta.platform || meta.features;
  if (!hasContent) return null;

  const pricingLabels: Record<string, string> = {
    free: 'Free', freemium: 'Freemium', paid: 'Paid',
    open_source: 'Open Source', free_trial: 'Free Trial',
  };

  return (
    <div className="space-y-3 rounded-2xl bg-card/70 border border-border/60 p-5">
      <h3 className="text-sm font-semibold text-foreground">Tool Details</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {meta.pricing_model && (
          <MetaItem icon={DollarSign} label="Pricing" value={pricingLabels[meta.pricing_model] || meta.pricing_model} />
        )}
        {meta.platform && (
          <MetaItem icon={Monitor} label="Platform" value={meta.platform} />
        )}
      </div>
      {meta.features && (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Star className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            <p className="text-[11px] text-muted-foreground font-medium">Key Features</p>
          </div>
          <p className="text-sm text-foreground whitespace-pre-line">{meta.features}</p>
        </div>
      )}
    </div>
  );
}

// Bank offer metadata display
function BankOfferMetadataSection({ meta }: { meta: Record<string, string> }) {
  const hasContent = meta.interest_rate || meta.loan_range || meta.repayment_period || meta.collateral_required;
  if (!hasContent) return null;

  return (
    <div className="space-y-3 rounded-2xl bg-card/70 border border-border/60 p-5">
      <h3 className="text-sm font-semibold text-foreground">Bank Offer Details</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {meta.interest_rate && (
          <MetaItem icon={Percent} label="Interest Rate" value={meta.interest_rate} />
        )}
        {meta.loan_range && (
          <MetaItem icon={CreditCard} label="Loan Range" value={meta.loan_range} />
        )}
        {meta.repayment_period && (
          <MetaItem icon={Clock} label="Repayment Period" value={meta.repayment_period} />
        )}
        {meta.collateral_required && (
          <MetaItem icon={Shield} label="Collateral Required" value={meta.collateral_required} />
        )}
      </div>
    </div>
  );
}

// Shared meta item
function MetaItem({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-300 mt-0.5 shrink-0" />
      <div>
        <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
        <p className="text-foreground">{value}</p>
      </div>
    </div>
  );
}

// Related resource mini card
function RelatedResourceCard({ resource }: { resource: RelatedResource }) {
  const logoUrl = getResourceLogoUrl(resource);
  const ended = isEnded(resource.deadline);

  return (
    <Link
      href={`/hub/resource/${encodeURIComponent(resource.id)}`}
      className="group rounded-2xl bg-card/70 border border-border/60 p-4 hover:bg-card/80 hover:border-primary/30 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain bg-muted/30 p-0.5 flex-shrink-0 border border-border/60" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 text-lg">
            {resource.icon || '\uD83D\uDCE6'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{resource.title}</h4>
          {resource.provider && (
            <p className="text-xs text-muted-foreground mt-0.5">{resource.provider}</p>
          )}
          {resource.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{resource.description}</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${categoryColors[resource.category] || 'text-primary bg-primary/10 border-primary/20'}`}>
              {categoryLabels[resource.category] || resource.category}
            </span>
            {resource.deadline && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ended ? 'text-rose-600 dark:text-rose-300 bg-rose-400/10 border border-rose-500/30' : 'text-amber-600 dark:text-amber-300 bg-amber-400/10 border border-amber-500/30'}`}>
                {ended ? 'Expired' : format(new Date(resource.deadline), 'dd MMM')}
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-1" />
      </div>
    </Link>
  );
}

export default function ResourceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [resource, setResource] = useState<ResourceDetail | null>(null);
  const [descOpen, setDescOpen] = useState(true);
  const [eligOpen, setEligOpen] = useState(true);

  // Related resources (same category)
  const [relatedResources, setRelatedResources] = useState<RelatedResource[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // AI recommendations based on startup profile
  const [recommendations, setRecommendations] = useState<RecommendedResource[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Fetch main resource
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/resources/${encodeURIComponent(id)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled) setResource(json.data || null);
      } catch (e) {
        console.error('Failed to load resource details', e);
        if (!cancelled) setResource(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Fetch related resources (same category, excluding current)
  useEffect(() => {
    if (!resource) return;
    let cancelled = false;
    setLoadingRelated(true);
    (async () => {
      try {
        const res = await fetch(`/api/resources?activeOnly=true&category=${encodeURIComponent(resource.category)}&limit=7`, { cache: 'no-store' });
        const json = await res.json();
        const items = (Array.isArray(json.data) ? json.data : []).filter((r: RelatedResource) => r.id !== id);
        if (!cancelled) setRelatedResources(items.slice(0, 6));
      } catch {
        if (!cancelled) setRelatedResources([]);
      }
      if (!cancelled) setLoadingRelated(false);
    })();
    return () => { cancelled = true; };
  }, [resource, id]);

  // Fetch AI recommendations based on startup profile
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadingRecs(true);
    (async () => {
      try {
        const res = await fetch('/api/resources/recommendations', { cache: 'no-store' });
        const json = await res.json();
        const recs = (Array.isArray(json.recommendations) ? json.recommendations : []).filter((r: RecommendedResource) => r.id !== id);
        if (!cancelled) setRecommendations(recs.slice(0, 4));
      } catch {
        if (!cancelled) setRecommendations([]);
      }
      if (!cancelled) setLoadingRecs(false);
    })();
    return () => { cancelled = true; };
  }, [user, id]);

  const ended = resource ? isEnded(resource.deadline) : false;
  const meta = (resource?.metadata || {}) as Record<string, string>;

  const share = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      navigator.share({ title: resource?.title || 'Resource', url }).catch(() => {});
    } else if (url) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  const logoUrl = resource ? getResourceLogoUrl(resource) : null;

  return (
    <DashboardLayout>
      <div className="flex flex-col flex-1 w-full h-full min-h-[calc(100vh-4rem)] py-4 md:py-6 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        {/* Header actions */}
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" className="rounded-xl bg-accent/30 hover:bg-accent/60 border border-border/50" onClick={() => router.push('/hub?tab=resources')} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="rounded-xl bg-accent/30 hover:bg-accent/60 border border-border/50" onClick={share} aria-label="Share">
            <Share2 className="h-5 w-5" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 animate-pulse rounded-xl bg-muted/20" />
              <div className="flex-1 space-y-2">
                <div className="h-8 w-2/3 animate-pulse rounded-xl bg-muted/20" />
                <div className="h-5 w-1/3 animate-pulse rounded-lg bg-muted/20" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-7 w-24 animate-pulse rounded-full bg-muted/20" />
              <div className="h-7 w-32 animate-pulse rounded-full bg-muted/20" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="h-16 animate-pulse rounded-xl bg-muted/20 border border-border/60" />
              <div className="h-16 animate-pulse rounded-xl bg-muted/20 border border-border/60" />
              <div className="h-16 animate-pulse rounded-xl bg-muted/20 border border-border/60" />
            </div>
            <div className="h-40 animate-pulse rounded-2xl bg-muted/20 border border-border/60" />
            <div className="h-60 animate-pulse rounded-2xl bg-muted/20 border border-border/60" />
          </div>
        ) : !resource ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Package className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">Resource not found</p>
            <p className="text-sm text-muted-foreground mt-1">This resource may have been removed or doesn&apos;t exist.</p>
          </div>
        ) : (
          <>
            {/* Title & Provider Header */}
            <div className="flex items-start gap-4 mb-4">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-14 w-14 rounded-xl object-contain bg-muted/30 p-1 flex-shrink-0 border border-border/60" />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 text-2xl">
                  {resource.icon || '\uD83D\uDCE6'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">{resource.title}</h1>
                {resource.provider && (
                  <p className="text-base text-muted-foreground font-medium mt-1">{resource.provider}</p>
                )}
              </div>
            </div>

            {/* Category badge */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${categoryColors[resource.category] || 'text-primary bg-primary/10 border-primary/20'}`}>
                {categoryLabels[resource.category] || resource.category}
              </span>
              {resource.deadline && (
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${ended ? 'text-rose-600 dark:text-rose-300 bg-rose-400/10 border-rose-500/30' : 'text-amber-600 dark:text-amber-300 bg-amber-400/10 border-amber-500/30'}`}>
                  <Clock className="h-3 w-3" />
                  {ended ? 'Expired' : `Deadline: ${format(new Date(resource.deadline), 'dd MMM, yyyy')}`}
                </span>
              )}
            </div>

            {/* Info cards grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {resource.provider && (
                <div className="rounded-xl bg-card/70 border border-border/60 px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                    <Building2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Provider
                  </div>
                  <p className="text-sm font-semibold text-foreground">{resource.provider}</p>
                </div>
              )}
              {resource.deadline && (
                <div className="rounded-xl bg-card/70 border border-border/60 px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                    <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Deadline
                  </div>
                  <p className={`text-sm font-semibold ${ended ? 'text-rose-600 dark:text-rose-300' : 'text-foreground'}`}>
                    {ended ? 'Ended' : format(new Date(resource.deadline), 'dd MMM, yyyy')}
                  </p>
                </div>
              )}
              <div className="rounded-xl bg-card/70 border border-border/60 px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Added
                </div>
                <p className="text-sm font-semibold text-foreground">{format(new Date(resource.created_at), 'dd MMM, yyyy')}</p>
              </div>
            </div>

            {/* Tags */}
            {resource.tags && resource.tags.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {resource.tags.map((tag) => (
                    <span key={tag} className="text-xs font-semibold text-muted-foreground bg-muted/40 border border-border px-3 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description Section */}
            {resource.description && (
              <div className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden mb-4">
                <button className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold" onClick={() => setDescOpen(o => !o)}>
                  <span>Description</span>
                  <ChevronDown className={`h-5 w-5 transition-transform ${descOpen ? 'rotate-180' : ''}`} />
                </button>
                {descOpen && (
                  <div className="px-5 pb-5 text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                    {resource.description}
                  </div>
                )}
              </div>
            )}

            {/* Eligibility Section */}
            {resource.eligibility && (
              <div className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden mb-4">
                <button className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold" onClick={() => setEligOpen(o => !o)}>
                  <span>Eligibility</span>
                  <ChevronDown className={`h-5 w-5 transition-transform ${eligOpen ? 'rotate-180' : ''}`} />
                </button>
                {eligOpen && (
                  <div className="px-5 pb-5 text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                    {resource.eligibility}
                  </div>
                )}
              </div>
            )}

            {/* Category-specific metadata */}
            {(resource.category === 'scheme' || resource.category === 'govt_scheme' || resource.category === 'accelerator_incubator') && (
              <div className="mb-4"><SchemeMetadataSection meta={meta} /></div>
            )}
            {resource.category === 'company_offer' && (
              <div className="mb-4"><CompanyOfferMetadataSection meta={meta} /></div>
            )}
            {resource.category === 'tool' && (
              <div className="mb-4"><ToolMetadataSection meta={meta} /></div>
            )}
            {resource.category === 'bank_offer' && (
              <div className="mb-4"><BankOfferMetadataSection meta={meta} /></div>
            )}

            {/* Visit Website CTA */}
            {resource.url && (
              <div className="sticky bottom-4 mt-4 z-10">
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 dark:bg-emerald-500/90 text-white px-8 py-3.5 text-sm font-bold hover:bg-emerald-700 dark:hover:bg-emerald-500 active:scale-[0.98] transition shadow-lg shadow-emerald-500/20 border border-emerald-500/30"
                >
                  Visit Website <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}

            {/* AI Recommendations for your startup */}
            {user && (recommendations.length > 0 || loadingRecs) && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  <h3 className="text-lg font-bold text-foreground">Recommended for Your Startup</h3>
                </div>
                {loadingRecs ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="h-24 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {recommendations.map((rec) => (
                      <Link
                        key={rec.id}
                        href={`/hub/resource/${encodeURIComponent(rec.id)}`}
                        className="rounded-2xl bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 p-4 hover:border-amber-500/40 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start gap-3">
                          {(() => {
                            const recLogo = getResourceLogoUrl(rec);
                            return recLogo ? (
                              <img src={recLogo} alt="" className="h-8 w-8 rounded-lg object-contain bg-muted/30 p-0.5 flex-shrink-0 border border-border/60" />
                            ) : (
                              <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 text-sm">
                                {rec.icon || '\uD83D\uDCE6'}
                              </div>
                            );
                          })()}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-foreground line-clamp-1">{rec.title}</h4>
                            {rec.provider && <p className="text-xs text-muted-foreground mt-0.5">{rec.provider}</p>}
                            <span className="mt-1 inline-block text-[10px] font-semibold text-primary/80 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                              {categoryLabels[rec.category] || rec.category}
                            </span>
                            {rec.ai_reason && (
                              <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300/80 line-clamp-2">
                                <Sparkles className="inline h-3 w-3 mr-1" />{rec.ai_reason}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Related Resources */}
            {(relatedResources.length > 0 || loadingRelated) && (
              <div className="mt-8 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-foreground">
                    More {categoryLabels[resource.category] ? categoryLabels[resource.category] + 's' : 'Resources'}
                  </h3>
                  <Link
                    href="/hub?tab=resources"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    View All <Eye className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {loadingRelated ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-24 rounded-2xl bg-muted/20 border border-border/60 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {relatedResources.map((r) => (
                      <RelatedResourceCard key={r.id} resource={r} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
