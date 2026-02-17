"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import {
  ArrowLeft, Share2, DollarSign, Clock, Zap,
  Building2, Globe, Mail, CheckCircle, Brain, Sparkles, Loader2,
  ChevronDown, GraduationCap, Layers, Package, FileText,
} from 'lucide-react';
import { format } from 'date-fns';

type GigDetail = {
  id: string;
  title: string;
  description: string | null;
  budget: string | null;
  duration: string | null;
  skills_required: string[] | null;
  deadline: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // New detailed fields
  company: string | null;
  company_logo_url: string | null;
  company_website: string | null;
  category: string | null;
  experience_level: string | null;
  payment_type: string | null;
  deliverables: string | null;
  responsibilities: string | null;
  contact_email: string | null;
};

function isEnded(deadline?: string | null) {
  if (!deadline) return false;
  const t = Date.parse(deadline);
  return isFinite(t) && t < Date.now();
}

const categoryLabels: Record<string, string> = {
  development: 'Development',
  design: 'Design',
  writing: 'Writing & Content',
  marketing: 'Marketing',
  video: 'Video & Animation',
  audio: 'Audio & Music',
  data: 'Data & Analytics',
  consulting: 'Consulting',
  other: 'Other',
};

const experienceLevelLabels: Record<string, string> = {
  any: 'Any Level',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  expert: 'Expert',
};

const paymentTypeLabels: Record<string, string> = {
  fixed: 'Fixed Price',
  hourly: 'Hourly Rate',
  milestone: 'Milestone-based',
  negotiable: 'Negotiable',
};

const paymentTypeColors: Record<string, string> = {
  fixed: 'text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 border-emerald-500/30',
  hourly: 'text-blue-700 dark:text-blue-300 bg-blue-400/10 border-blue-500/30',
  milestone: 'text-amber-700 dark:text-amber-300 bg-amber-400/10 border-amber-500/30',
  negotiable: 'text-purple-700 dark:text-purple-300 bg-purple-400/10 border-purple-500/30',
};

export default function GigDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [gig, setGig] = useState<GigDetail | null>(null);
  const [aboutOpen, setAboutOpen] = useState(true);
  const [deliverablesOpen, setDeliverablesOpen] = useState(true);
  const [responsibilitiesOpen, setResponsibilitiesOpen] = useState(true);
  const [appCheck, setAppCheck] = useState<{ applied: boolean; status?: string; loading: boolean }>({ applied: false, loading: true });

  // Check if user already applied
  useEffect(() => {
    if (!id) return;
    fetch(`/api/applications/check?gig_id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((json) => setAppCheck({ applied: json.applied, status: json.status, loading: false }))
      .catch(() => setAppCheck((prev) => ({ ...prev, loading: false })));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/gigs/${encodeURIComponent(id)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled) setGig(json.data || null);
      } catch (e) {
        console.error('Failed to load gig details', e);
        if (!cancelled) setGig(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const ended = gig ? isEnded(gig.deadline) : false;

  const share = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      navigator.share({ title: gig?.title || 'Gig', url }).catch(() => {});
    } else if (url) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col flex-1 w-full h-full min-h-[calc(100vh-4rem)] py-4 md:py-6 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        {/* Header actions */}
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" className="rounded-xl bg-accent/30 hover:bg-accent/60 border border-border/50" onClick={() => router.back()} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="rounded-xl bg-accent/30 hover:bg-accent/60 border border-border/50" onClick={share} aria-label="Share">
            <Share2 className="h-5 w-5" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="h-10 w-2/3 animate-pulse rounded-xl bg-muted/20" />
            <div className="h-6 w-1/3 animate-pulse rounded-lg bg-muted/20" />
            <div className="h-40 animate-pulse rounded-2xl bg-muted/20 border border-border/60" />
            <div className="h-60 animate-pulse rounded-2xl bg-muted/20 border border-border/60" />
          </div>
        ) : !gig ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Zap className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">Gig not found</p>
            <p className="text-sm text-muted-foreground mt-1">This gig may have been removed or doesn't exist.</p>
          </div>
        ) : (
          <>
            {/* Title & Client Header */}
            <div className="flex items-start gap-4 mb-4">
              {gig.company_logo_url ? (
                <img src={gig.company_logo_url} alt={gig.company || 'Client'} className="h-14 w-14 rounded-xl object-contain bg-muted/30 p-1 flex-shrink-0 border border-border/60" />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">{gig.title}</h1>
                {gig.company && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-base text-muted-foreground font-medium">{gig.company}</span>
                    {gig.company_website && (
                      <a href={gig.company_website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition">
                        <Globe className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Status & Meta Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${ended || !gig.is_active ? 'text-rose-600 dark:text-rose-300 bg-rose-400/10 border-rose-500/30' : 'text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 border-emerald-500/30'}`}>
                <CheckCircle className="h-3 w-3" />
                {ended ? 'Closed' : !gig.is_active ? 'Inactive' : 'Open'}
              </span>
              {gig.payment_type && (
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${paymentTypeColors[gig.payment_type] || 'text-muted-foreground bg-muted/20 border-border'}`}>
                  <DollarSign className="h-3 w-3" />
                  {paymentTypeLabels[gig.payment_type] || gig.payment_type}
                </span>
              )}
              {gig.category && gig.category !== 'other' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border text-amber-700 dark:text-amber-300 bg-amber-400/10 border-amber-500/30">
                  <Layers className="h-3 w-3" />
                  {categoryLabels[gig.category] || gig.category}
                </span>
              )}
              {gig.experience_level && gig.experience_level !== 'any' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border text-cyan-700 dark:text-cyan-300 bg-cyan-400/10 border-cyan-500/30">
                  <GraduationCap className="h-3 w-3" />
                  {experienceLevelLabels[gig.experience_level] || gig.experience_level}
                </span>
              )}
            </div>

            {/* Key Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {gig.budget && (
                <div className="rounded-xl bg-card/70 border border-border/60 px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Budget
                  </div>
                  <p className="text-sm font-semibold text-foreground">{gig.budget}</p>
                </div>
              )}
              {gig.duration && (
                <div className="rounded-xl bg-card/70 border border-border/60 px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                    <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Duration
                  </div>
                  <p className="text-sm font-semibold text-foreground">{gig.duration}</p>
                </div>
              )}
              {gig.deadline && (
                <div className="rounded-xl bg-card/70 border border-border/60 px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                    <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Deadline
                  </div>
                  <p className={`text-sm font-semibold ${ended ? 'text-rose-600 dark:text-rose-300' : 'text-foreground'}`}>
                    {ended ? 'Ended' : format(new Date(gig.deadline), 'dd MMM, yyyy')}
                  </p>
                </div>
              )}
              <div className="rounded-xl bg-card/70 border border-border/60 px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Posted
                </div>
                <p className="text-sm font-semibold text-foreground">{format(new Date(gig.created_at), 'dd MMM, yyyy')}</p>
              </div>
            </div>

            {/* Skills */}
            {gig.skills_required && gig.skills_required.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Required Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {gig.skills_required.map((skill) => (
                    <span key={skill} className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-400/10 border border-purple-500/30 dark:border-purple-400/30 px-3 py-1 rounded-full">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description Section */}
            {gig.description && (
              <div className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden mb-4">
                <button className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold" onClick={() => setAboutOpen(o => !o)}>
                  <span>About this Gig</span>
                  <ChevronDown className={`h-5 w-5 transition-transform ${aboutOpen ? 'rotate-180' : ''}`} />
                </button>
                {aboutOpen && (
                  <div className="px-5 pb-5 text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                    {gig.description}
                  </div>
                )}
              </div>
            )}

            {/* Deliverables Section */}
            {gig.deliverables && (
              <div className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden mb-4">
                <button className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold" onClick={() => setDeliverablesOpen(o => !o)}>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Deliverables</span>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${deliverablesOpen ? 'rotate-180' : ''}`} />
                </button>
                {deliverablesOpen && (
                  <div className="px-5 pb-5 text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                    {gig.deliverables}
                  </div>
                )}
              </div>
            )}

            {/* Responsibilities Section */}
            {gig.responsibilities && (
              <div className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden mb-4">
                <button className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold" onClick={() => setResponsibilitiesOpen(o => !o)}>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Scope of Work</span>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${responsibilitiesOpen ? 'rotate-180' : ''}`} />
                </button>
                {responsibilitiesOpen && (
                  <div className="px-5 pb-5 text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                    {gig.responsibilities}
                  </div>
                )}
              </div>
            )}

            {/* Contact Info */}
            {gig.contact_email && (
              <div className="rounded-2xl border border-border/60 bg-card/70 p-5 mb-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">Contact</h3>
                <a href={`mailto:${gig.contact_email}`} className="inline-flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
                  <Mail className="h-4 w-4" />
                  {gig.contact_email}
                </a>
              </div>
            )}

            {/* Apply CTA */}
            {!ended && gig.is_active && (
              <div className="sticky bottom-4 mt-4">
                {appCheck.loading ? (
                  <div className="w-full flex items-center justify-center py-3.5">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : appCheck.applied ? (
                  <div className="w-full rounded-xl bg-card border border-border p-4 text-center">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="h-4 w-4" />
                      Application {appCheck.status === 'submitted' ? 'Submitted' : 'In Progress'}
                    </div>
                    {appCheck.status === 'in_progress' && (
                      <Link href={`/hub/gig/${id}/apply`} className="block mt-2 text-xs text-primary hover:underline">
                        Continue Application
                      </Link>
                    )}
                  </div>
                ) : (
                  <Link
                    href={`/hub/gig/${id}/apply`}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 dark:bg-emerald-500/90 text-white px-8 py-3.5 text-sm font-bold hover:bg-emerald-700 dark:hover:bg-emerald-500 active:scale-[0.98] transition shadow-lg shadow-emerald-500/20 border border-emerald-500/30"
                  >
                    <Brain className="h-4 w-4" />
                    Apply with AI
                    <Sparkles className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            )}

          </>
        )}
      </div>
    </DashboardLayout>
  );
}
