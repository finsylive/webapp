"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useRef } from 'react';
import { Reorder } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, GripVertical, GraduationCap, Pencil } from 'lucide-react';

type EducationRow = {
  id: string;
  institution_name: string;
  institution_domain?: string | null;
  degree?: string | null;
  field_of_study?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  sort_order?: number | null;
};

export default function EditEducationListPage() {
  const params = useParams() as { username?: string };
  const username = (params?.username || '').toString();
  const router = useRouter();

  const [items, setItems] = useState<EducationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEducation = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/education`);
      if (!res.ok) throw new Error('Failed to load education');
      const json = await res.json();
      setItems(json?.data?.education ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load education');
    } finally {
      setLoading(false);
    }
  };

  const deleteEducation = async (id: string) => {
    if (!username) return;
    const prev = items;
    setDeletingId(id);
    setItems((cur) => cur.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/education?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setSavedAt(Date.now());
    } catch {
      setItems(prev);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (!username) return;
    void loadEducation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const total = useMemo(() => items.length, [items]);

  // Debounced auto-save of order
  useEffect(() => {
    if (!username || !items || items.length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setSavingOrder(true);
        const order = items.map((it) => it.id);
        const res = await fetch(`/api/users/${encodeURIComponent(username)}/education`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order }),
        });
        if (!res.ok) throw new Error('Failed to save order');
        setSavedAt(Date.now());
      } catch (e) {
        console.error(e);
      } finally {
        setSavingOrder(false);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [items, username]);

  const formatDate = (d?: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  };

  return (
    <DashboardLayout>
      <div className="flex-1 w-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto w-full">
          <div className="bg-card/60 border border-border rounded-2xl shadow-sm p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Link href={`/profile/${encodeURIComponent(username)}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-5 w-5 mr-1" /> Back
                </Link>
                <h1 className="text-2xl font-semibold">Edit Education</h1>
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-3">
                <span>Drag to reorder</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs ${savingOrder ? 'border-emerald-500/40 text-emerald-300' : 'border-border text-muted-foreground'}`}>
                  {savingOrder ? 'Saving...' : savedAt ? 'Saved' : ''}
                </span>
              </div>
            </div>

            {loading && <div className="text-sm text-muted-foreground">Loading education...</div>}
            {error && <div className="text-sm text-red-400">{error}</div>}

            <Reorder.Group
              axis="y"
              values={items}
              onReorder={setItems}
              className="grid grid-cols-1 gap-5"
            >
              {items.map((ed) => (
                <Reorder.Item
                  key={ed.id}
                  value={ed}
                  layout
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.995 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="rounded-2xl border border-border/80 bg-card/70 p-5 sm:p-6 shadow-sm hover:shadow-md hover:ring-1 hover:ring-emerald-400/20 relative cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {ed.institution_domain ? (
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${ed.institution_domain}&sz=64`}
                          alt=""
                          className="h-6 w-6 rounded"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : null}
                      <div>
                        <div className="text-lg font-semibold">{ed.institution_name}</div>
                        {(ed.degree || ed.field_of_study) && (
                          <div className="text-sm text-muted-foreground">
                            {[ed.degree, ed.field_of_study].filter(Boolean).join(' - ')}
                          </div>
                        )}
                        {(ed.start_date || ed.end_date) && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(ed.start_date) || '?'} — {ed.end_date ? formatDate(ed.end_date) : 'Present'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/50 border border-border text-sm text-muted-foreground select-none">
                        <GripVertical className="h-4 w-4" />
                        Drag
                      </div>
                      <Link
                        href={`/profile/${encodeURIComponent(username)}/education/${encodeURIComponent(ed.id)}/edit`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-sm"
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </Link>
                      <button
                        type="button"
                        className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground disabled:opacity-40"
                        onClick={() => deleteEducation(ed.id)}
                        disabled={deletingId === ed.id}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="absolute -left-3 top-6 hidden sm:block">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-400/30 flex items-center justify-center">
                      <GraduationCap className="h-5 w-5 text-emerald-400" />
                    </div>
                  </div>
                </Reorder.Item>
              ))}

              {total === 0 && !loading && (
                <div className="text-sm text-muted-foreground">No education added yet.</div>
              )}
            </Reorder.Group>

            <button
              type="button"
              onClick={() => router.push(`/profile/${encodeURIComponent(username)}/education/create`)}
              className="fixed right-6 bottom-6 z-50 h-14 w-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg inline-flex items-center justify-center"
              title="Add education"
            >
              <Plus className="h-7 w-7" />
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
