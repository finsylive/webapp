"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import UniversityAutocomplete from '@/components/profile/UniversityAutocomplete';

export default function CreateEducationPage() {
  const params = useParams() as { username?: string };
  const username = (params?.username || '').toString();
  const router = useRouter();

  const [institutionName, setInstitutionName] = useState('');
  const [institutionDomain, setInstitutionDomain] = useState('');
  const [degree, setDegree] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 2600);
  };

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!institutionName.trim()) e.institutionName = 'Institution name is required.';
    if (!startDate) e.startDate = 'Start date is required.';
    if (!isCurrent && endDate && startDate && endDate < startDate) e.endDate = 'End date cannot be before start date.';
    return e;
  }, [institutionName, startDate, endDate, isCurrent]);

  const canSubmit = useMemo(() => Object.keys(errors).length === 0 && !submitting, [errors, submitting]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      const payload = {
        institution_name: institutionName.trim(),
        institution_domain: institutionDomain.trim() || null,
        degree: degree.trim() || null,
        field_of_study: fieldOfStudy.trim() || null,
        start_date: startDate || null,
        end_date: isCurrent ? null : (endDate || null),
        description: description.trim() || null,
      };

      const res = await fetch(`/api/users/${encodeURIComponent(username)}/education`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add education');

      showToast('success', 'Education added');
      setTimeout(() => router.push(`/profile/${encodeURIComponent(username)}/education/edit`), 400);
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
                <Link href={`/profile/${encodeURIComponent(username)}/education/edit`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-5 w-5 mr-1" /> Back
                </Link>
                <h1 className="text-2xl font-semibold">Add Education</h1>
              </div>
            </div>

            {/* Institution */}
            <div>
              <div className="text-emerald-400 font-semibold mb-2">Institution</div>
              <UniversityAutocomplete
                value={institutionName}
                domain={institutionDomain}
                onChange={(sel) => {
                  setInstitutionName(sel.name);
                  if (sel.domain) setInstitutionDomain(sel.domain);
                }}
                placeholder="Institution Name"
                className="mb-1"
              />
              {errors.institutionName && <p className="text-xs text-red-400 mb-2">{errors.institutionName}</p>}
              <div className="flex items-center gap-2 mt-2">
                {institutionDomain && (
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${institutionDomain}&sz=32`}
                    alt=""
                    className="h-5 w-5 rounded"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <input
                  type="text"
                  placeholder="Domain (e.g. mit.edu)"
                  className="w-full px-4 py-3 rounded-xl bg-background/50 border border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={institutionDomain}
                  onChange={(e) => setInstitutionDomain(e.target.value)}
                />
              </div>
            </div>

            <hr className="my-6 border-border" />

            {/* Degree & Field */}
            <div>
              <div className="text-emerald-400 font-semibold mb-2">Degree Details</div>
              <input
                type="text"
                placeholder="Degree (e.g. Bachelor of Science)"
                className="w-full px-4 py-3 rounded-xl bg-background/50 border border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
              />
              <input
                type="text"
                placeholder="Field of Study (e.g. Computer Science)"
                className="w-full px-4 py-3 rounded-xl bg-background/50 border border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
                value={fieldOfStudy}
                onChange={(e) => setFieldOfStudy(e.target.value)}
              />
              <textarea
                placeholder="Description (optional)"
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-background/50 border border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Period */}
            <div className="mt-6">
              <div className="text-emerald-400 font-semibold mb-2">Period</div>
              <div className="grid grid-cols-1 gap-3">
                <input
                  type="date"
                  className={`w-full px-4 py-3 rounded-xl bg-background/50 border focus:outline-none focus:ring-2 ${errors.startDate ? 'border-red-500/50 focus:ring-red-500' : 'border-emerald-500/40 focus:ring-emerald-500'}`}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                {errors.startDate && <p className="text-xs text-red-400 -mt-1">{errors.startDate}</p>}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isCurrent} onChange={(e) => { setIsCurrent(e.target.checked); if (e.target.checked) setEndDate(''); }} />
                  Currently studying here
                </label>
                <input
                  type="date"
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
                onClick={() => router.push(`/profile/${encodeURIComponent(username)}/education/edit`)}
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
