"use client";

import React, { useState, useRef, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import {
  Upload, X, Check, ChevronDown, ChevronUp,
  Briefcase, GraduationCap, Link2, Sparkles, Loader2, AlertCircle,
  User, MapPin, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ParsedResume {
  full_name: string;
  tagline: string;
  about: string;
  current_city: string;
  skills: string[];
  work_experiences: {
    company_name: string;
    domain: string;
    positions: {
      position: string;
      start_date: string;
      end_date: string;
      description: string;
    }[];
  }[];
  education: {
    institution_name: string;
    degree: string;
    field_of_study: string;
    start_date: string;
    end_date: string;
    description: string;
  }[];
  portfolio_links: {
    platform: string;
    link: string;
  }[];
}

type Step = 'idle' | 'uploading' | 'parsing' | 'preview' | 'applying' | 'done' | 'error';

interface ResumeUploadProps {
  readonly onProfileUpdated?: () => void;
}

function stepClass(isDone: boolean, isActive: boolean): string {
  if (isDone) return 'bg-emerald-500 text-white';
  if (isActive) return 'bg-emerald-500/20 text-emerald-500';
  return 'bg-muted text-muted-foreground';
}

function stepTextClass(isDone: boolean, isActive: boolean): string {
  if (isDone) return 'text-emerald-500 font-medium';
  if (isActive) return 'text-foreground font-medium';
  return 'text-muted-foreground';
}

export default function ResumeUpload({ onProfileUpdated }: ResumeUploadProps) {
  const [step, setStep] = useState<Step>('idle');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedResume | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    profile: true, skills: true, experience: false, education: false, links: false,
  });
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({
    full_name: true, tagline: true, about: true, current_city: true,
    skills: true, work_experiences: true, education: true, portfolio_links: true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleField = (key: string) => {
    setSelectedFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getAuthToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    return session.access_token;
  };

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum 10MB.');
      return;
    }

    setFileName(file.name);
    setError(null);
    setParsed(null);

    try {
      // Step 1: Upload to storage (background save)
      setStep('uploading');
      const token = await getAuthToken();

      const uploadForm = new FormData();
      uploadForm.append('resume', file);
      const uploadRes = await fetch('/api/resume/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: uploadForm,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Upload failed');
      }

      // Step 2: Parse with AI (server-side pdf-parse + Groq)
      setStep('parsing');
      const parseForm = new FormData();
      parseForm.append('resume', file);
      const parseRes = await fetch('/api/resume/parse', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: parseForm,
      });
      if (!parseRes.ok) {
        const err = await parseRes.json();
        throw new Error(err.error || 'Parsing failed');
      }

      const { data } = await parseRes.json();
      setParsed(data);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setStep('error');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const buildPayload = useCallback((data: ParsedResume, fields: Record<string, boolean>): Partial<ParsedResume> => {
    const payload: Partial<ParsedResume> = {};
    const textFields: (keyof ParsedResume)[] = ['full_name', 'tagline', 'about', 'current_city'];
    const arrayFields: (keyof ParsedResume)[] = ['skills', 'work_experiences', 'education', 'portfolio_links'];

    for (const key of textFields) {
      if (fields[key] && data[key]) {
        (payload as Record<string, unknown>)[key] = data[key];
      }
    }
    for (const key of arrayFields) {
      const arr = data[key] as unknown[];
      if (fields[key] && arr.length > 0) {
        (payload as Record<string, unknown>)[key] = arr;
      }
    }
    return payload;
  }, []);

  const handleApply = async () => {
    if (!parsed) return;
    setStep('applying');
    setError(null);

    try {
      const token = await getAuthToken();
      const payload = buildPayload(parsed, selectedFields);

      const res = await fetch('/api/resume/apply', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to apply');
      }

      // The API returns { success, errors } — check the success field
      if (!result.success) {
        const errMsg = Array.isArray(result.errors) ? result.errors.join('; ') : 'Some fields failed to save';
        console.warn('[ResumeUpload] partial errors:', result.errors);
        throw new Error(errMsg);
      }

      setStep('done');
      onProfileUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply resume data');
      setStep('error');
    }
  };

  const reset = () => {
    setStep('idle');
    setFileName('');
    setError(null);
    setParsed(null);
    setSelectedFields({
      full_name: true, tagline: true, about: true, current_city: true,
      skills: true, work_experiences: true, education: true, portfolio_links: true,
    });
  };

  // ======================== IDLE / ERROR ========================
  if (step === 'idle' || step === 'error') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-3 px-4 py-10 rounded-xl bg-accent/20 border-2 border-dashed border-border/50 text-muted-foreground hover:border-emerald-500/30 hover:bg-accent/40 hover:text-foreground transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
            <Upload className="h-6 w-6 text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">Upload your Resume / CV</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              PDF format, max 10MB — AI will extract your profile details
            </p>
          </div>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
          className="hidden"
        />

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={reset} className="text-xs text-red-400/70 hover:text-red-400 underline mt-1">
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ======================== PROCESSING ========================
  if (step === 'uploading' || step === 'parsing') {
    const steps = [
      { key: 'uploading', label: 'Uploading resume' },
      { key: 'parsing', label: 'AI parsing profile data' },
    ];
    const currentIndex = step === 'uploading' ? 0 : 1;

    return (
      <div className="p-6 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10">
            <Sparkles className="h-5 w-5 text-emerald-500 animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-semibold">Processing {fileName}</p>
            <p className="text-xs text-muted-foreground">AI is analyzing your resume...</p>
          </div>
        </div>
        <div className="space-y-3">
          {steps.map((s, i) => {
            const isDone = i < currentIndex;
            const isActive = i === currentIndex;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full transition-all ${stepClass(isDone, isActive)}`}>
                  {isDone && <Check className="h-3.5 w-3.5" />}
                  {!isDone && isActive && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {!isDone && !isActive && <span className="text-[10px] font-bold">{i + 1}</span>}
                </div>
                <span className={`text-sm ${stepTextClass(isDone, isActive)}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ======================== APPLYING ========================
  if (step === 'applying') {
    return (
      <div className="p-6 rounded-xl bg-card border border-border flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
        <p className="text-sm font-medium">Saving to your profile...</p>
      </div>
    );
  }

  // ======================== DONE ========================
  if (step === 'done') {
    return (
      <div className="p-6 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/20">
            <Check className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-500">Profile updated from resume!</p>
            <p className="text-xs text-muted-foreground">Your profile data has been saved.</p>
          </div>
        </div>
        <Button onClick={reset} variant="ghost" size="sm" className="text-xs">
          Upload another
        </Button>
      </div>
    );
  }

  // ======================== PREVIEW ========================
  if (step === 'preview' && parsed) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/15">
              <Sparkles className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Resume parsed successfully!</p>
              <p className="text-xs text-muted-foreground">Review and select what to add to your profile.</p>
            </div>
            <button onClick={reset} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Profile Info */}
        <SectionCard
          icon={<User className="h-4 w-4" />}
          title="Profile Info"
          expanded={expandedSections.profile}
          onToggle={() => toggleSection('profile')}
        >
          <FieldRow label="Name" value={parsed.full_name} selected={selectedFields.full_name} onToggle={() => toggleField('full_name')} />
          <FieldRow label="Tagline" value={parsed.tagline} selected={selectedFields.tagline} onToggle={() => toggleField('tagline')} />
          <FieldRow label="About" value={parsed.about} selected={selectedFields.about} onToggle={() => toggleField('about')} multiline />
          <FieldRow label="City" value={parsed.current_city} icon={<MapPin className="h-3 w-3" />} selected={selectedFields.current_city} onToggle={() => toggleField('current_city')} />
        </SectionCard>

        {/* Skills */}
        {parsed.skills.length > 0 && (
          <SectionCard
            icon={<Zap className="h-4 w-4" />}
            title={`Skills (${parsed.skills.length})`}
            expanded={expandedSections.skills}
            onToggle={() => toggleSection('skills')}
            selected={selectedFields.skills}
            onSelectToggle={() => toggleField('skills')}
          >
            <div className="flex flex-wrap gap-1.5">
              {parsed.skills.map((skill) => (
                <span key={skill} className="inline-flex px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                  {skill}
                </span>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Work Experience */}
        {parsed.work_experiences.length > 0 && (
          <SectionCard
            icon={<Briefcase className="h-4 w-4" />}
            title={`Work Experience (${parsed.work_experiences.length})`}
            expanded={expandedSections.experience}
            onToggle={() => toggleSection('experience')}
            selected={selectedFields.work_experiences}
            onSelectToggle={() => toggleField('work_experiences')}
          >
            <div className="space-y-3">
              {parsed.work_experiences.map((we) => (
                <div key={`${we.company_name}-${we.positions[0]?.position || ''}`} className="p-3 rounded-lg bg-accent/30 border border-border/40">
                  <p className="text-sm font-semibold">{we.company_name}</p>
                  {we.domain && <p className="text-xs text-muted-foreground">{we.domain}</p>}
                  {we.positions.map((pos) => (
                    <div key={`${pos.position}-${pos.start_date}`} className="mt-2 pl-3 border-l-2 border-emerald-500/30">
                      <p className="text-xs font-medium">{pos.position}</p>
                      {(pos.start_date || pos.end_date) && (
                        <p className="text-[10px] text-muted-foreground">
                          {pos.start_date || '?'} — {pos.end_date || 'Present'}
                        </p>
                      )}
                      {pos.description && <p className="text-xs text-muted-foreground mt-1">{pos.description}</p>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Education */}
        {parsed.education.length > 0 && (
          <SectionCard
            icon={<GraduationCap className="h-4 w-4" />}
            title={`Education (${parsed.education.length})`}
            expanded={expandedSections.education}
            onToggle={() => toggleSection('education')}
            selected={selectedFields.education}
            onSelectToggle={() => toggleField('education')}
          >
            <div className="space-y-3">
              {parsed.education.map((ed) => (
                <div key={`${ed.institution_name}-${ed.degree}`} className="p-3 rounded-lg bg-accent/30 border border-border/40">
                  <p className="text-sm font-semibold">{ed.institution_name}</p>
                  {ed.degree && (
                    <p className="text-xs text-muted-foreground">
                      {ed.degree}{ed.field_of_study ? ` in ${ed.field_of_study}` : ''}
                    </p>
                  )}
                  {(ed.start_date || ed.end_date) && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {ed.start_date || '?'} — {ed.end_date || 'Present'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Links */}
        {parsed.portfolio_links.length > 0 && (
          <SectionCard
            icon={<Link2 className="h-4 w-4" />}
            title={`Links (${parsed.portfolio_links.length})`}
            expanded={expandedSections.links}
            onToggle={() => toggleSection('links')}
            selected={selectedFields.portfolio_links}
            onSelectToggle={() => toggleField('portfolio_links')}
          >
            <div className="space-y-2">
              {parsed.portfolio_links.map((pl) => (
                <div key={pl.link} className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-accent/50 text-muted-foreground font-medium capitalize">
                    {pl.platform}
                  </span>
                  <a href={pl.link} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline truncate">
                    {pl.link}
                  </a>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleApply} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl">
            <Check className="h-4 w-4 mr-2" />
            Apply to Profile
          </Button>
          <Button onClick={reset} variant="ghost" className="rounded-xl">
            Cancel
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ======================== SUB-COMPONENTS ========================

function SectionCard({
  icon, title, expanded, onToggle, selected, onSelectToggle, children,
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  selected?: boolean;
  onSelectToggle?: () => void;
  children: React.ReactNode;
}>) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-accent/30 transition-colors"
      >
        <span className="text-emerald-500">{icon}</span>
        <span className="text-sm font-medium flex-1 text-left">{title}</span>
        {onSelectToggle && (
          <span
            onClick={(e) => e.stopPropagation()}
            aria-hidden="true"
          >
            <input
              type="checkbox"
              checked={selected ?? true}
              onChange={onSelectToggle}
              aria-label={`Include ${title}`}
              className="h-4 w-4 rounded border-border text-emerald-500 focus:ring-emerald-500/30"
            />
          </span>
        )}
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function FieldRow({
  label, value, icon, selected, onToggle, multiline,
}: Readonly<{
  label: string;
  value: string;
  icon?: React.ReactNode;
  selected: boolean;
  onToggle: () => void;
  multiline?: boolean;
}>) {
  if (!value) return null;

  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        aria-label={`Include ${label}`}
        className="mt-1 h-4 w-4 rounded border-border text-emerald-500 focus:ring-emerald-500/30"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
          {icon}
          <span>{label}</span>
        </div>
        {multiline ? (
          <p className="text-sm text-foreground leading-relaxed">{value}</p>
        ) : (
          <p className="text-sm text-foreground font-medium">{value}</p>
        )}
      </div>
    </div>
  );
}
