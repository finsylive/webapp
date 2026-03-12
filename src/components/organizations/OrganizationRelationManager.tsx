'use client';

import { useState } from 'react';
import type {
  OrganizationRelationType,
  OrganizationStartupRelation,
} from '@/api/organizations';
import { deleteOrganizationRelation, sendOrganizationRequest } from '@/api/organizations';
import { Search, Send, Trash2, Loader2, Building2 } from 'lucide-react';

type SearchResult = {
  id: string;
  brand_name: string;
  description: string | null;
  stage: string;
  entity_type: 'startup' | 'org_project';
  logo_url: string | null;
  city: string | null;
  country: string | null;
};

const RELATION_TYPES: OrganizationRelationType[] = [
  'incubated',
  'accelerated',
  'partnered',
  'mentored',
  'funded',
  'community_member',
];

export function OrganizationRelationManager({
  slug,
  initialRelations,
  onRelationsChange,
}: {
  slug: string;
  initialRelations: OrganizationStartupRelation[];
  onRelationsChange?: (relations: OrganizationStartupRelation[]) => void;
}) {
  const [relations, setRelations] = useState(initialRelations);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [relationType, setRelationType] = useState<OrganizationRelationType>('incubated');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRelations = (next: OrganizationStartupRelation[]) => {
    setRelations(next);
    onRelationsChange?.(next);
  };

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: '12',
        search: search.trim(),
      });
      const res = await fetch(`/api/startups?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to search startups');
      }
      setResults(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search startups');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await sendOrganizationRequest(slug, {
        startup_id: selected.id,
        relation_type: relationType,
      });

      const existingIndex = relations.findIndex((item) => item.startup_id === data.startup_id);
      const next = [...relations];
      if (existingIndex >= 0) {
        next[existingIndex] = data;
      } else {
        next.unshift(data);
      }
      updateRelations(next);
      setSelected(null);
      setSearch('');
      setResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save relation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (startupId: string) => {
    setError(null);
    try {
      await deleteOrganizationRelation(slug, startupId);
      updateRelations(relations.filter((item) => item.startup_id !== startupId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove relation');
    }
  };

  return (
    <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Request Startup Associations</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Startup facilitator admins can only send requests. The startup owner must accept before the startup appears under this facilitator profile.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_0.9fr_auto] gap-3">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Search startups
          </label>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by startup name"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:bg-accent/60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>
          {selected && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
              Selected: <span className="font-semibold text-foreground">{selected.brand_name}</span>
            </div>
          )}
          {results.length > 0 && !selected && (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              {results.map((startup) => (
                <button
                  key={startup.id}
                  type="button"
                  onClick={() => setSelected(startup)}
                  className="w-full text-left px-3 py-3 border-b last:border-b-0 border-border/50 hover:bg-accent/40"
                >
                  <div className="text-sm font-semibold text-foreground">{startup.brand_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {startup.stage} {startup.city || startup.country ? `· ${[startup.city, startup.country].filter(Boolean).join(', ')}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Relation
          </label>
          <select
            value={relationType}
            onChange={(e) => setRelationType(e.target.value as OrganizationRelationType)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            {RELATION_TYPES.map((item) => (
              <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selected || submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send request
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Requests and linked startups
        </h4>
        {relations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            No requests or linked startups yet.
          </div>
        ) : (
          <div className="space-y-2">
            {relations.map((relation) => (
              <div
                key={relation.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">
                    {relation.startup?.brand_name || relation.startup_id}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {relation.relation_type.replace(/_/g, ' ')} · {relation.status.replace(/_/g, ' ')}
                  </div>
                  {relation.status === 'requested' && (
                    <div className="text-[11px] text-amber-600 mt-1">
                      Waiting for startup owner approval
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(relation.startup_id)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                  title="Remove relation"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
