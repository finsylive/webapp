"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useRef } from 'react';
import { Reorder } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, GripVertical, Building2, Pencil } from 'lucide-react';

// Types aligned with our API at /api/users/[username]/work-experience

type PositionRow = {
  id: string;
  experience_id: string;
  position: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  sort_order: number | null;
};

export type ExperienceRow = {
  id: string;
  company_name: string;
  domain?: string | null;
  sort_order?: number | null;
  positions: PositionRow[];
};

export default function EditExperiencesPage() {
  const params = useParams() as { username?: string };
  const username = (params?.username || '').toString();
  const router = useRouter();

  const [items, setItems] = useState<ExperienceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Removed unused local form state and submitting flag

  const loadExperiences = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/work-experience`);
      if (!res.ok) throw new Error('Failed to load experiences');
      const json = await res.json();
      const list: ExperienceRow[] = json?.data?.experiences ?? [];
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load experiences');
    } finally {
      setLoading(false);
    }
  };

  const deleteExperience = async (id: string) => {
    if (!username) return;
    // optimistic UI
    const prev = items;
    setDeletingId(id);
    setItems((cur) => cur.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/work-experience?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setSavedAt(Date.now());
    } catch (e) {
      // revert on failure
      setItems(prev);
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (!username) return;
    void loadExperiences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const total = useMemo(() => items.length, [items]);

  // Debounced auto-save of order
  useEffect(() => {
    if (!username) return;
    if (!items || items.length === 0) return;
    // clear previous timer
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setSavingOrder(true);
        const order = items.map((it) => it.id);
        const res = await fetch(`/api/users/${encodeURIComponent(username)}/work-experience`, {
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
    }, 500); // half-second debounce after last change

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [items, username]);

  // Removed unused resetForm helper

  // Removed unused handleSubmitAdd function to satisfy lints

  return (
    <DashboardLayout>
      <div className="flex-1 w-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto w-full">
          <div className="bg-card/60 border border-border rounded-2xl shadow-sm p-6 sm:p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Link href={`/profile/${encodeURIComponent(username)}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-5 w-5 mr-1" /> Back
                </Link>
                <h1 className="text-2xl font-semibold">Edit Experiences</h1>
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-3">
                <span>Drag to reorder your experiences</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs ${savingOrder ? 'border-emerald-500/40 text-emerald-300' : 'border-border text-muted-foreground'}`}>
                  {savingOrder ? 'Saving…' : savedAt ? 'Saved' : ''}
                </span>
              </div>
            </div>

            {/* Content */}
            {loading && <div className="text-sm text-muted-foreground">Loading experiences…</div>}
            {error && <div className="text-sm text-red-400">{error}</div>}

            <Reorder.Group
              axis="y"
              values={items}
              onReorder={setItems}
              className="grid grid-cols-1 gap-5"
            >
              {items.map((exp) => (
                <Reorder.Item
                  key={exp.id}
                  value={exp}
                  layout
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.995 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="rounded-2xl border border-border/80 bg-card/70 p-5 sm:p-6 shadow-sm hover:shadow-md hover:ring-1 hover:ring-emerald-400/20 relative cursor-grab active:cursor-grabbing"
                >
                  {/* Company Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-lg font-semibold flex items-center gap-2">
                        <span>{exp.company_name}</span>
                      </div>
                      {exp.domain && (
                        <a
                          href={/^https?:\/\//i.test(exp.domain || '') ? (exp.domain as string) : `https://${exp.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 text-sm hover:underline"
                        >
                          {exp.domain}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/50 border border-border text-sm text-muted-foreground select-none">
                        <GripVertical className="h-4 w-4" />
                        Drag to reorder
                      </div>
                      <Link
                        href={`/profile/${encodeURIComponent(username)}/experiences/${encodeURIComponent(exp.id)}/edit`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-sm"
                        title="Edit this experience"
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </Link>
                      <button
                        type="button"
                        className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground disabled:opacity-40"
                        title="Delete experience"
                        onClick={() => deleteExperience(exp.id)}
                        disabled={deletingId === exp.id}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Positions */}
                  <div className="mt-3">
                    <div className="text-sm text-muted-foreground mb-1">Positions</div>
                    <ul className="space-y-2">
                      {(exp.positions || []).map((p) => (
                        <li key={p.id} className="flex items-start gap-2">
                          <span className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                          <div className="text-sm">
                            <div className="font-medium">{p.position}</div>
                            {p.description && (
                              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {p.description}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                      {(!exp.positions || exp.positions.length === 0) && (
                        <li className="text-sm text-muted-foreground">No positions added</li>
                      )}
                    </ul>
                  </div>

                  {/* Icon on left for visual consistency */}
                  <div className="absolute -left-3 top-6 hidden sm:block">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-400/30 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-emerald-400" />
                    </div>
                  </div>
                </Reorder.Item>
              ))}

              {total === 0 && !loading && (
                <div className="text-sm text-muted-foreground">No experiences yet.</div>
              )}
            </Reorder.Group>

            {/* Floating Add button */}
            <button
              type="button"
              onClick={() => router.push(`/profile/${encodeURIComponent(username)}/experiences/create`)}
              className="fixed right-6 bottom-6 z-50 h-14 w-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg inline-flex items-center justify-center"
              title="Add experience"
            >
              <Plus className="h-7 w-7" />
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
