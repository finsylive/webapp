"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import {
  ArrowLeft, Share2, MapPin, Briefcase, DollarSign, Clock,
  Building2, Globe, Mail, CheckCircle, Brain, Sparkles, Loader2,
  ChevronDown, Monitor, Wifi, Home, GraduationCap, Layers,
} from 'lucide-react';
import { format } from 'date-fns';

type JobDetail = {
  id: string;
  title: string;
  company: string;
  description: string | null;
  location: string | null;
  salary_range: string | null;
  job_type: string;
  requirements: string | null;
  deadline: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // New detailed fields
  company_logo_url: string | null;
  company_website: string | null;
  experience_level: string | null;
  skills_required: string[] | null;
  benefits: string | null;
  responsibilities: string | null;
  category: string | null;
  work_mode: string | null;
  contact_email: string | null;
};

function isEnded(deadline?: string | null) {
  if (!deadline) return false;
  const t = Date.parse(deadline);
  return isFinite(t) && t < Date.now();
}

const jobTypeLabels: Record<string, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  'contract': 'Contract',
  'remote': 'Remote',
  'internship': 'Internship',
};

const experienceLevelLabels: Record<string, string> = {
  any: 'Any Level',
  internship: 'Internship',
  entry: 'Entry Level',
  mid: 'Mid Level',
  senior: 'Senior',
  lead: 'Lead',
  executive: 'Executive',
};

const categoryLabels: Record<string, string> = {
  engineering: 'Engineering',
  design: 'Design',
  marketing: 'Marketing',
  sales: 'Sales',
  operations: 'Operations',
  finance: 'Finance',
  hr: 'Human Resources',
  legal: 'Legal',
  product: 'Product',
  data: 'Data & Analytics',
  support: 'Customer Support',
  content: 'Content',
  other: 'Other',
};

const workModeIcons: Record<string, typeof Monitor> = {
  onsite: Building2,
  remote: Wifi,
  hybrid: Home,
};

const workModeLabels: Record<string, string> = {
  onsite: 'On-site',
  remote: 'Remote',
  hybrid: 'Hybrid',
};

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [aboutOpen, setAboutOpen] = useState(true);
  const [requirementsOpen, setRequirementsOpen] = useState(true);
  const [responsibilitiesOpen, setResponsibilitiesOpen] = useState(true);
  const [benefitsOpen, setBenefitsOpen] = useState(true);
  const [appCheck, setAppCheck] = useState<{ applied: boolean; status?: string; loading: boolean }>({ applied: false, loading: true });

  // Check if user already applied
  useEffect(() => {
    if (!id) return;
    fetch(`/api/applications/check?job_id=${encodeURIComponent(id)}`)
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
        const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled) setJob(json.data || null);
      } catch (e) {
        console.error('Failed to load job details', e);
        if (!cancelled) setJob(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const ended = job ? isEnded(job.deadline) : false;

  const share = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      navigator.share({ title: job?.title || 'Job', url }).catch(() => {});
    } else if (url) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  const WorkModeIcon = job?.work_mode ? workModeIcons[job.work_mode] || Monitor : Monitor;

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
        ) : !job ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Briefcase className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">Job not found</p>
            <p className="text-sm text-muted-foreground mt-1">This job may have been removed or doesn't exist.</p>
          </div>
        ) : (
          <>
            {/* Title & Company Header */}
            <div className="flex items-start gap-4 mb-4">
              {job.company_logo_url ? (
                <img src={job.company_logo_url} alt={job.company} className="h-14 w-14 rounded-xl object-contain bg-muted/30 p-1 flex-shrink-0 border border-border/60" />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">{job.title}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-base text-muted-foreground font-medium">{job.company}</span>
                  {job.company_website && (
                    <a href={job.company_website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition">
                      <Globe className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Status & Meta Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${ended || !job.is_active ? 'text-rose-600 dark:text-rose-300 bg-rose-400/10 border-rose-500/30' : 'text-emerald-700 dark:text-emerald-300 bg-emerald-400/10 border-emerald-500/30'}`}>
                <CheckCircle className="h-3 w-3" />
                {ended ? 'Closed' : !job.is_active ? 'Inactive' : 'Open'}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border text-blue-700 dark:text-blue-300 bg-blue-400/10 border-blue-500/30">
                <Briefcase className="h-3 w-3" />
                {jobTypeLabels[job.job_type] || job.job_type}
              </span>
              {job.work_mode && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border text-purple-700 dark:text-purple-300 bg-purple-400/10 border-purple-500/30">
                  <WorkModeIcon className="h-3 w-3" />
                  {workModeLabels[job.work_mode] || job.work_mode}
                </span>
              )}
              {job.category && job.category !== 'other' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border text-amber-700 dark:text-amber-300 bg-amber-400/10 border-amber-500/30">
                  <Layers className="h-3 w-3" />
                  {categoryLabels[job.category] || job.category}
                </span>
              )}
              {job.experience_level && job.experience_level !== 'any' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border text-cyan-700 dark:text-cyan-300 bg-cyan-400/10 border-cyan-500/30">
                  <GraduationCap className="h-3 w-3" />
                  {experienceLevelLabels[job.experience_level] || job.experience_level}
                </span>
              )}
            </div>

            {/* Key Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {job.location && (
                <div className="rounded-xl bg-card/70 border border-border/60 px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Location
                  </div>
                  <p className="text-sm font-semibold text-foreground">{job.location}</p>
                </div>
              )}
              {job.salary_range && (
                <div className="rounded-xl bg-card/70 border border-border/60 px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Salary
                  </div>
                  <p className="text-sm font-semibold text-foreground">{job.salary_range}</p>
                </div>
              )}
              {job.deadline && (
                <div className="rounded-xl bg-card/70 border border-border/60 px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                    <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Deadline
                  </div>
                  <p className={`text-sm font-semibold ${ended ? 'text-rose-600 dark:text-rose-300' : 'text-foreground'}`}>
                    {ended ? 'Ended' : format(new Date(job.deadline), 'dd MMM, yyyy')}
                  </p>
                </div>
              )}
              <div className="rounded-xl bg-card/70 border border-border/60 px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Posted
                </div>
                <p className="text-sm font-semibold text-foreground">{format(new Date(job.created_at), 'dd MMM, yyyy')}</p>
              </div>
            </div>

            {/* Skills */}
            {job.skills_required && job.skills_required.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Required Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {job.skills_required.map((skill) => (
                    <span key={skill} className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-400/10 border border-purple-500/30 dark:border-purple-400/30 px-3 py-1 rounded-full">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description Section */}
            {job.description && (
              <div className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden mb-4">
                <button className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold" onClick={() => setAboutOpen(o => !o)}>
                  <span>About this Role</span>
                  <ChevronDown className={`h-5 w-5 transition-transform ${aboutOpen ? 'rotate-180' : ''}`} />
                </button>
                {aboutOpen && (
                  <div className="px-5 pb-5 text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                    {job.description}
                  </div>
                )}
              </div>
            )}

            {/* Responsibilities Section */}
            {job.responsibilities && (
              <div className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden mb-4">
                <button className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold" onClick={() => setResponsibilitiesOpen(o => !o)}>
                  <span>Responsibilities</span>
                  <ChevronDown className={`h-5 w-5 transition-transform ${responsibilitiesOpen ? 'rotate-180' : ''}`} />
                </button>
                {responsibilitiesOpen && (
                  <div className="px-5 pb-5 text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                    {job.responsibilities}
                  </div>
                )}
              </div>
            )}

            {/* Requirements Section */}
            {job.requirements && (
              <div className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden mb-4">
                <button className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold" onClick={() => setRequirementsOpen(o => !o)}>
                  <span>Requirements</span>
                  <ChevronDown className={`h-5 w-5 transition-transform ${requirementsOpen ? 'rotate-180' : ''}`} />
                </button>
                {requirementsOpen && (
                  <div className="px-5 pb-5 text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                    {job.requirements}
                  </div>
                )}
              </div>
            )}

            {/* Benefits Section */}
            {job.benefits && (
              <div className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden mb-4">
                <button className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold" onClick={() => setBenefitsOpen(o => !o)}>
                  <span>Benefits & Perks</span>
                  <ChevronDown className={`h-5 w-5 transition-transform ${benefitsOpen ? 'rotate-180' : ''}`} />
                </button>
                {benefitsOpen && (
                  <div className="px-5 pb-5 text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                    {job.benefits}
                  </div>
                )}
              </div>
            )}

            {/* Contact Info */}
            {job.contact_email && (
              <div className="rounded-2xl border border-border/60 bg-card/70 p-5 mb-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">Contact</h3>
                <a href={`mailto:${job.contact_email}`} className="inline-flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
                  <Mail className="h-4 w-4" />
                  {job.contact_email}
                </a>
              </div>
            )}

            {/* Apply CTA */}
            {!ended && job.is_active && (
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
                      <Link href={`/hub/job/${id}/apply`} className="block mt-2 text-xs text-primary hover:underline">
                        Continue Application
                      </Link>
                    )}
                  </div>
                ) : (
                  <Link
                    href={`/hub/job/${id}/apply`}
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
