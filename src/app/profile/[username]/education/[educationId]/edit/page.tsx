"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import UniversityAutocomplete from '@/components/profile/UniversityAutocomplete';

type EducationRow = {
  id: string;
  institution_name: string;
  institution_domain: string | null;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

export default function EditOneEducationPage() {
  const params = useParams() as { username?: string; educationId?: string };
  const username = (params?.username || '').toString();
  const educationId = (params?.educationId || '').toString();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [institutionName, setInstitutionName] = useState('');
  const [institutionDomain, setInstitutionDomain] = useState('');
  const [degree, setDegree] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [description, setDescription] = useState('');

  const [orig, setOrig] = useState<EducationRow | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 2400);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/education?id=${encodeURIComponent(educationId)}`);
      if (!res.ok) throw new Error('Failed to load education');
      const json = await res.json();
      const ed = (json?.data?.education || [])[0] as EducationRow | undefined;
      if (!ed) throw new Error('Education not found');

      setInstitutionName(ed.institution_name || '');
      setInstitutionDomain(ed.institution_domain || '');
      setDegree(ed.degree || '');
      setFieldOfStudy(ed.field_of_study || '');
      setStartDate(ed.start_date ? ed.start_date.substring(0, 10) : '');
      setEndDate(ed.end_date ? ed.end_date.substring(0, 10) : '');
      setIsCurrent(!ed.end_date && !!ed.start_date);
      setDescription(ed.description || '');
      setOrig(ed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [username, educationId]);

  useEffect(() => {
    if (username && educationId) void load();
  }, [load, username, educationId]);

  const dirty = useMemo(() => {
    if (!orig) return false;
    const norm = (v: string | null | undefined) => (v ?? '').trim() || null;
    return (
      institutionName.trim() !== (orig.institution_name || '') ||
      norm(institutionDomain) !== norm(orig.institution_domain) ||
      norm(degree) !== norm(orig.degree) ||
      norm(fieldOfStudy) !== norm(orig.field_of_study) ||
      norm(startDate) !== norm(orig.start_date?.substring(0, 10)) ||
      norm(isCurrent ? '' : endDate) !== norm(orig.end_date?.substring(0, 10)) ||
      norm(description) !== norm(orig.description)
    );
  }, [orig, institutionName, institutionDomain, degree, fieldOfStudy, startDate, endDate, isCurrent, description]);

  const handleSave = async () => {
    if (saving || !dirty) return;
    try {
      setSaving(true);
      const payload = {
        id: educationId,
        institution_name: institutionName.trim(),
        institution_domain: institutionDomain.trim() || null,
        degree: degree.trim() || null,
        field_of_study: fieldOfStudy.trim() || null,
        start_date: startDate || null,
        end_date: isCurrent ? null : (endDate || null),
        description: description.trim() || null,
      };

      const res = await fetch(`/api/users/${encodeURIComponent(username)}/education`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save changes');

      // Update orig
      setOrig({
        id: educationId,
        institution_name: institutionName.trim(),
        institution_domain: institutionDomain.trim() || null,
        degree: degree.trim() || null,
        field_of_study: fieldOfStudy.trim() || null,
        start_date: startDate || null,
        end_date: isCurrent ? null : (endDate || null),
        description: description.trim() || null,
      });
      showToast('success', 'Changes saved');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 w-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto w-full">
          <div className="bg-card/60 border border-border rounded-2xl shadow-sm p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Link href={`/profile/${encodeURIComponent(username)}/education/edit`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-5 w-5 mr-1" /> Back
                </Link>
                <h1 className="text-2xl font-semibold">Edit Education</h1>
              </div>
            </div>

            {loading && <div className="text-sm text-muted-foreground">Loading...</div>}
            {error && <div className="text-sm text-red-400">{error}</div>}

            {!loading && !error && (
              <>
                <div className="space-y-3 mb-6">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Institution</label>
                    <UniversityAutocomplete
                      value={institutionName}
                      domain={institutionDomain}
                      onChange={(sel) => {
                        setInstitutionName(sel.name);
                        if (sel.domain) setInstitutionDomain(sel.domain);
                      }}
                      placeholder="Institution Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Domain</label>
                    <div className="flex items-center gap-2">
                      {institutionDomain && (
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${institutionDomain}&sz=32`}
                          alt=""
                          className="h-5 w-5 rounded"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <input
                        value={institutionDomain}
                        onChange={(e) => setInstitutionDomain(e.target.value)}
                        className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none"
                        placeholder="mit.edu"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Degree</label>
                    <input
                      value={degree}
                      onChange={(e) => setDegree(e.target.value)}
                      className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none"
                      placeholder="Bachelor of Science"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Field of Study</label>
                    <input
                      value={fieldOfStudy}
                      onChange={(e) => setFieldOfStudy(e.target.value)}
                      className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none"
                      placeholder="Computer Science"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Description</label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none"
                      placeholder="Optional description"
                    />
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none disabled:opacity-50"
                        disabled={isCurrent}
                      />
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isCurrent}
                      onChange={(e) => { setIsCurrent(e.target.checked); if (e.target.checked) setEndDate(''); }}
                    />
                    Currently studying here
                  </label>
                </div>
              </>
            )}

            <div className="mt-8 flex items-center justify-end">
              <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${saving || !dirty ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white'}`}
              >
                <Check className="h-4 w-4" /> Save Changes
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
