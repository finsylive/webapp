"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';

// lightweight types (aligned with our edit page)
type PositionPayload = {
  experienceId: string;
  position: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
};

type ExperienceItem = { id: string; company_name: string };

export default function CreateExperiencePage() {
  const params = useParams() as { username?: string };
  const username = (params?.username || '').toString();
  const router = useRouter();

  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [experienceId, setExperienceId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [domain, setDomain] = useState('');
  const [position, setPosition] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}/work-experience`);
        if (!res.ok) throw new Error('Failed to load experiences');
        const json = await res.json();
        const list: ExperienceItem[] = (json?.data?.experiences || []).map((e: { id: string; company_name: string }) => ({ id: e.id, company_name: e.company_name }));
        setExperiences(list);
        setExperienceId(list[0]?.id || '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load experiences');
      }
    };
    if (username) void load();
  }, [username]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (mode === 'existing') {
      if (!experienceId) e.experienceId = 'Please choose a company.';
    } else {
      if (!companyName.trim()) e.companyName = 'Company name is required.';
    }
    if (!position.trim()) e.position = 'Position is required.';
    if (!startDate) e.startDate = 'Start date is required.';
    if (!isCurrent && endDate && startDate && endDate < startDate) e.endDate = 'End date cannot be before start date.';
    return e;
  }, [mode, experienceId, companyName, position, startDate, endDate, isCurrent]);

  const canSubmit = useMemo(() => Object.keys(errors).length === 0 && !submitting, [errors, submitting]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      let expId = experienceId;
      if (mode === 'new') {
        const resExp = await fetch(`/api/users/${encodeURIComponent(username)}/work-experience`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyName: companyName.trim(), domain: domain.trim() || null }),
        });
        if (!resExp.ok) throw new Error('Failed to create company');
        const expJson = await resExp.json();
        expId = expJson?.data?.id;
      }

      const payload: PositionPayload = {
        experienceId: expId,
        position: position.trim(),
        description: description.trim() || null,
        startDate: startDate || null,
        endDate: isCurrent ? null : (endDate || null),
      };
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add position');

      showToast('success', 'Position added');
      // Small delay so toast is visible
      setTimeout(() => router.push(`/profile/${encodeURIComponent(username)}/experiences/edit`), 400);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 w-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto w-full">
          <div className="bg-card/60 border border-border rounded-2xl shadow-sm p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Link href={`/profile/${encodeURIComponent(username)}/experiences/edit`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-5 w-5 mr-1" /> Back
                </Link>
                <h1 className="text-2xl font-semibold">Add Position</h1>
              </div>
            </div>

            {error && <div className="text-sm text-red-400 mb-3">{error}</div>}

            {/* Company Information */}
            <div>
              <div className="text-emerald-400 font-semibold mb-2">Company Information</div>
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="companyMode" checked={mode === 'existing'} onChange={() => setMode('existing')} />
                  Use existing
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="companyMode" checked={mode === 'new'} onChange={() => setMode('new')} />
                  New company
                </label>
              </div>

              {mode === 'existing' ? (
                <select
                  className="w-full px-4 py-3 rounded-xl bg-background/50 border border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={experienceId}
                  onChange={(e) => setExperienceId(e.target.value)}
                >
                  {experiences.map((it) => (
                    <option key={it.id} value={it.id}>{it.company_name}</option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Company Name"
                    className={`w-full px-4 py-3 rounded-xl bg-background/50 border focus:outline-none focus:ring-2 ${errors.companyName ? 'border-red-500/50 focus:ring-red-500' : 'border-emerald-500/40 focus:ring-emerald-500'} mb-1`}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                  {errors.companyName && <p className="text-xs text-red-400 mb-2">{errors.companyName}</p>}
                  <input
                    type="text"
                    placeholder="Domain"
                    className="w-full px-4 py-3 rounded-xl bg-background/50 border border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                  />
                </>
              )}
              {errors.experienceId && mode === 'existing' && <p className="text-xs text-red-400 mt-1">{errors.experienceId}</p>}
            </div>

            <hr className="my-6 border-border" />

            {/* Position Details */}
            <div>
              <div className="text-emerald-400 font-semibold mb-2">Position Details</div>
              <input
                type="text"
                placeholder="Position"
                className={`w-full px-4 py-3 rounded-xl bg-background/50 border focus:outline-none focus:ring-2 ${errors.position ? 'border-red-500/50 focus:ring-red-500' : 'border-emerald-500/40 focus:ring-emerald-500'} mb-1`}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
              {errors.position && <p className="text-xs text-red-400 mb-2">{errors.position}</p>}
              <textarea
                placeholder="Description"
                rows={5}
                className="w-full px-4 py-3 rounded-xl bg-background/50 border border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Employment Period */}
            <div className="mt-6">
              <div className="text-emerald-400 font-semibold mb-2">Employment Period</div>
              <div className="grid grid-cols-1 gap-3">
                <input
                  type="date"
                  placeholder="Start Date"
                  className={`w-full px-4 py-3 rounded-xl bg-background/50 border focus:outline-none focus:ring-2 ${errors.startDate ? 'border-red-500/50 focus:ring-red-500' : 'border-emerald-500/40 focus:ring-emerald-500'}`}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                {errors.startDate && <p className="text-xs text-red-400 -mt-1">{errors.startDate}</p>}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isCurrent} onChange={(e) => { setIsCurrent(e.target.checked); if (e.target.checked) setEndDate(''); }} />
                  I currently work here
                </label>
                <input
                  type="date"
                  placeholder="End Date"
                  className={`w-full px-4 py-3 rounded-xl bg-background/50 border focus:outline-none focus:ring-2 ${errors.endDate ? 'border-red-500/50 focus:ring-red-500' : 'border-emerald-500/40 focus:ring-emerald-500'} disabled:opacity-50`}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={isCurrent}
                />
                {errors.endDate && <p className="text-xs text-red-400 -mt-1">{errors.endDate}</p>}
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-border text-sm"
                onClick={() => router.push(`/profile/${encodeURIComponent(username)}/experiences/edit`)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2 ${canSubmit ? 'bg-emerald-600 hover:bg-emerald-700 text-black' : 'bg-white/5 border border-white/10 text-white/40 cursor-not-allowed'}`}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                <Check className="h-4 w-4" /> Save
              </button>
            </div>
          
            {/* Toast */}
            {toast && (
              <div className={`fixed right-4 bottom-4 z-50 px-4 py-3 rounded-lg border shadow-lg ${toast.type === 'success' ? 'bg-emerald-600/90 border-emerald-400/50 text-black' : 'bg-red-600/90 border-red-400/50 text-white'}`}>
                {toast.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
