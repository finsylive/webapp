"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import CompanyAutocomplete from '@/components/profile/CompanyAutocomplete';

type PositionRow = {
  id: string;
  experience_id: string;
  position: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

type ExperienceRow = {
  id: string;
  company_name: string;
  domain?: string | null;
};

export default function EditOneExperiencePage() {
  const params = useParams() as { username?: string; experienceId?: string };
  const username = (params?.username || '').toString();
  const experienceId = (params?.experienceId || '').toString();
  // router not needed here

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [domain, setDomain] = useState('');
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [origCompanyName, setOrigCompanyName] = useState('');
  const [origDomain, setOrigDomain] = useState('');
  const [origPositions, setOrigPositions] = useState<Record<string, PositionRow>>({});

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 2400);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const expPromise = fetch(`/api/users/${encodeURIComponent(username)}/work-experience?id=${encodeURIComponent(experienceId)}`).then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load experiences')));
      const posPromise = fetch(`/api/users/${encodeURIComponent(username)}/positions?experienceId=${encodeURIComponent(experienceId)}`)
        .then(r => r.ok ? r.json() : Promise.resolve({ data: [] }))
        .catch(() => ({ data: [] }));
      const [expRes, posRes] = await Promise.all([expPromise, posPromise]);
      const exp = (expRes?.data?.experiences || [])[0] as (ExperienceRow & { positions?: PositionRow[] }) | undefined;
      if (!exp) throw new Error('Experience not found');
      const initialCompany = exp.company_name || '';
      const initialDomain = (exp.domain || '') as string;
      setCompanyName(initialCompany);
      setOrigCompanyName(initialCompany);
      setDomain(initialDomain);
      setOrigDomain(initialDomain);
      let allPos: PositionRow[] = (posRes?.data || []);
      if ((!allPos || allPos.length === 0) && Array.isArray(exp.positions)) {
        allPos = exp.positions as PositionRow[];
      }
      if (process.env.NODE_ENV !== 'production') {
        // simple debug log to help diagnose empty positions
        console.log('[EditExperience] positions fetched:', (posRes?.data || []).length, 'fallback used:', (!posRes?.data || posRes.data.length===0) && Array.isArray(exp.positions));
      }
      setPositions(allPos);
      const orig: Record<string, PositionRow> = {};
      for (const p of allPos) orig[p.id] = { ...p };
      setOrigPositions(orig);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [username, experienceId]);

  useEffect(() => { if (username && experienceId) void load(); }, [load, username, experienceId]);

  const dirtyCompany = useMemo(() => companyName.trim() !== origCompanyName || (domain || '').trim() !== (origDomain || ''), [companyName, domain, origCompanyName, origDomain]);

  const saveAll = async () => {
    if (savingAll) return;
    try {
      setSavingAll(true);
      const tasks: Promise<void>[] = [];

      if (dirtyCompany) {
        tasks.push(fetch(`/api/users/${encodeURIComponent(username)}/work-experience`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: experienceId, company_name: companyName.trim(), domain: (domain || '').trim() || null })
        }).then(r => { if (!r.ok) throw new Error('Failed to update company'); }));
      }

      // positions patches (only changed fields)
      // normalize helper so '' and undefined are treated as null for comparisons
      const norm = (v: string | null | undefined) => {
        const s = (v ?? '').toString().trim();
        return s.length ? s : null;
      };
      for (const p of positions) {
        const base = origPositions[p.id];
        if (!base) continue;
        const patch: { id: string; position?: string; description?: string | null; startDate?: string | null; endDate?: string | null } = { id: p.id };
        let changed = false;
        if ((p.position || '').trim() !== (base.position || '').trim()) { patch.position = (p.position || '').trim(); changed = true; }
        if ((p.description || '').trim() !== (base.description || '').trim()) { patch.description = norm(p.description); changed = true; }
        if (norm(p.start_date) !== norm(base.start_date)) { patch.startDate = norm(p.start_date); changed = true; }
        if (norm(p.end_date) !== norm(base.end_date)) { patch.endDate = norm(p.end_date); changed = true; }
        if (changed) {
          tasks.push(fetch(`/api/users/${encodeURIComponent(username)}/positions`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch)
          }).then(r => { if (!r.ok) throw new Error('Failed to update a position'); }));
        }
      }

      if (tasks.length === 0) {
        showToast('success', 'Nothing to save');
        return;
      }
      await Promise.all(tasks);
      // reset originals
      setOrigCompanyName(companyName.trim());
      setOrigDomain((domain || '').trim());
      const nextOrig: Record<string, PositionRow> = {};
      for (const p of positions) nextOrig[p.id] = { ...p };
      setOrigPositions(nextOrig);
      showToast('success', 'Changes saved');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to save changes');
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 w-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto w-full">
          <div className="bg-card/60 border border-border rounded-2xl shadow-sm p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Link href={`/profile/${encodeURIComponent(username)}/experiences/edit`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-5 w-5 mr-1" /> Back
                </Link>
                <h1 className="text-2xl font-semibold">Edit Experience</h1>
              </div>
            </div>

            {loading && (
              <div className="text-sm text-muted-foreground">Loading…</div>
            )}
            {error && <div className="text-sm text-red-400">{error}</div>}

            {!loading && !error && (
              <>
                <div className="space-y-3 mb-8">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Company Name</label>
                    <CompanyAutocomplete
                      value={companyName}
                      domain={domain}
                      onChange={(sel) => {
                        setCompanyName(sel.name);
                        if (sel.domain) setDomain(sel.domain);
                      }}
                      placeholder="Company"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Domain</label>
                    <div className="flex items-center gap-2">
                      {domain && (
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                          alt=""
                          className="h-5 w-5 rounded"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <input
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none"
                        placeholder="example.com"
                      />
                    </div>
                  </div>
                  <div className="h-2" />
                </div>

                <div>
                  <h2 className="text-lg font-semibold mb-3">Positions</h2>
                  {positions.length === 0 && (
                    <div className="text-xs text-muted-foreground mb-2">No positions found or failed to load positions.</div>
                  )}
                  <ul className="space-y-6">
                    {positions.map((p) => (
                      <li key={p.id} className="p-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="md:col-span-2 text-emerald-400 font-semibold">Position Details</div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Position</label>
                            <input
                              value={p.position}
                              onChange={(e) => setPositions(prev => prev.map(x => x.id === p.id ? { ...x, position: e.target.value } : x))}
                              className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Start Date</label>
                              <input
                                type="date"
                                value={p.start_date || ''}
                                onChange={(e) => setPositions(prev => prev.map(x => x.id === p.id ? { ...x, start_date: e.target.value } : x))}
                                className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">End Date</label>
                              <input
                                type="date"
                                value={p.end_date || ''}
                                onChange={(e) => setPositions(prev => prev.map(x => x.id === p.id ? { ...x, end_date: e.target.value } : x))}
                                className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none disabled:opacity-50"
                                disabled={!p.end_date}
                              />
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <label className="inline-flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={!p.end_date}
                                onChange={(e) => setPositions(prev => prev.map(x => x.id === p.id ? { ...x, end_date: e.target.checked ? null : (x.end_date || '') } : x))}
                              />
                              I currently work here
                            </label>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs text-muted-foreground mb-1">Description</label>
                            <textarea
                              rows={4}
                              value={p.description || ''}
                              onChange={(e) => setPositions(prev => prev.map(x => x.id === p.id ? { ...x, description: e.target.value } : x))}
                              className="w-full rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2 outline-none"
                            />
                          </div>
                          <div className="md:col-span-2" />
                        </div>
                      </li>
                    ))}
                    {positions.length === 0 && (
                      <li className="text-sm text-muted-foreground">No positions found.</li>
                    )}
                  </ul>
                </div>
              </>
            )}

            <div className="mt-8 flex items-center justify-end">
              <button
                onClick={saveAll}
                disabled={savingAll}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${savingAll ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white'}`}
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
