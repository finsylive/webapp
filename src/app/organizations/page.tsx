'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { fetchOrganizations, type OrganizationListItem, type OrganizationType } from '@/api/organizations';
import { Building2, Globe, MapPin, Plus, Search, Sparkles } from 'lucide-react';

const ORG_TYPES: { value: '' | OrganizationType; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'incubator', label: 'Incubators' },
  { value: 'accelerator', label: 'Accelerators' },
  { value: 'ecell', label: 'E-Cells' },
  { value: 'college_incubator', label: 'College Incubators' },
  { value: 'facilitator', label: 'Facilitators' },
  { value: 'community', label: 'Communities' },
  { value: 'other', label: 'Other' },
];

function formatLocation(org: OrganizationListItem) {
  return [org.city, org.state, org.country].filter(Boolean).join(', ');
}

function OrganizationCard({ org, showDashboardLink = false }: { org: OrganizationListItem; showDashboardLink?: boolean }) {
  return (
    <div className="group rounded-2xl border border-border/40 bg-card p-5 shadow-sm transition-colors hover:border-primary/25 hover:bg-accent/10">
      <div className="flex items-start gap-4">
        {org.logo_url ? (
          <img src={org.logo_url} alt={org.name} className="h-14 w-14 rounded-2xl object-cover border border-border/40" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/15">
            <Building2 className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-foreground group-hover:text-primary">{org.name}</h3>
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {org.org_type.replace(/_/g, ' ')}
            </span>
          </div>
          {org.short_bio && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{org.short_bio}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-3">
            {formatLocation(org) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {formatLocation(org)}
              </span>
            )}
            {org.website && (
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />
                Website
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/organizations/${org.slug}`}
          className="inline-flex items-center justify-center rounded-xl border border-border/60 px-3 py-2 text-sm font-medium hover:bg-accent/30"
        >
          View profile
        </Link>
        {showDashboardLink && (
          <Link
            href={`/organizations/${org.slug}/dashboard`}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            Open dashboard
          </Link>
        )}
      </div>
    </div>
  );
}

export default function OrganizationsPage() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([]);
  const [myOrganizations, setMyOrganizations] = useState<OrganizationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [orgType, setOrgType] = useState<'' | OrganizationType>('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [publicRes, myRes] = await Promise.all([
          fetchOrganizations({ search, org_type: orgType || undefined }),
          user ? fetchOrganizations({ mine: true }) : Promise.resolve({ data: [] as OrganizationListItem[] }),
        ]);
        setOrganizations(publicRes.data);
        setMyOrganizations(myRes.data);
      } catch (error) {
        console.error('Failed to load organizations:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [orgType, search, user]);

  const visibleMine = useMemo(
    () => myOrganizations.filter((org) => !organizations.some((publicOrg) => publicOrg.id === org.id)),
    [myOrganizations, organizations]
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border border-border/50 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Startup Support
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">Startup Facilitators</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Explore incubators, accelerators, e-cells, and support bodies. Create a public profile for your startup facilitator and showcase accepted startups.
              </p>
            </div>
            <Link
              href="/organizations/create"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Create Facilitator Profile
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_220px]">
          <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-card px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search startup facilitators"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <select
            value={orgType}
            onChange={(e) => setOrgType(e.target.value as '' | OrganizationType)}
            className="rounded-2xl border border-border/50 bg-card px-4 py-3 text-sm outline-none"
          >
            {ORG_TYPES.map((type) => (
              <option key={type.label} value={type.value}>{type.label}</option>
            ))}
          </select>
        </section>

        {user && myOrganizations.length > 0 && (
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Managed by you</h2>
              <p className="text-sm text-muted-foreground">Startup facilitator profiles you can manage through the dedicated dashboard.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {myOrganizations.map((org) => (
                <OrganizationCard key={org.id} org={org} showDashboardLink />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Published facilitator profiles</h2>
            <p className="text-sm text-muted-foreground">Discover public support bodies on the platform.</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : organizations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 px-6 py-12 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No startup facilitator profiles found for the current filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {organizations.map((org) => (
                <OrganizationCard key={org.id} org={org} />
              ))}
              {visibleMine.map((org) => (
                <OrganizationCard key={org.id} org={org} />
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
