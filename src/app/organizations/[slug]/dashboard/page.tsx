'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { fetchOrganizationBySlug, type OrganizationProfile } from '@/api/organizations';
import { FacilitatorVerificationCard } from '@/components/organizations/FacilitatorVerificationCard';
import { OrganizationRelationManager } from '@/components/organizations/OrganizationRelationManager';
import { ArrowLeft, Building2, Eye, Globe, Loader2, MapPin, Sparkles } from 'lucide-react';

function formatLocation(org: OrganizationProfile) {
  return [org.city, org.state, org.country].filter(Boolean).join(', ');
}

export default function OrganizationDashboardPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [organization, setOrganization] = useState<OrganizationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await fetchOrganizationBySlug(slug);
        setOrganization(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load organization');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const publicRelationsCount = useMemo(
    () => (organization?.relations || []).filter((relation) => ['accepted', 'active', 'alumni'].includes(relation.status)).length,
    [organization]
  );

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Link href="/organizations" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to startup facilitators
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Startup facilitator dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage how your startup facilitator appears and which startups are publicly associated with it.
              </p>
            </div>
          </div>
          {organization && (
            <Link
              href={`/organizations/${organization.slug}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent/30"
            >
              <Eye className="h-4 w-4" />
              View public profile
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-border/50 bg-card px-6 py-12 text-center">
            <p className="text-red-500">{error}</p>
          </div>
        ) : organization ? (
          organization.is_admin ? (
            <>
              <section className="rounded-3xl border border-border/50 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-6 sm:p-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      {organization.member_role || 'admin'}
                    </div>
                    <div className="mt-4 flex items-start gap-4">
                      {organization.logo_url ? (
                        <img src={organization.logo_url} alt={organization.name} className="h-16 w-16 rounded-3xl border border-border/40 object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                          <Building2 className="h-8 w-8" />
                        </div>
                      )}
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">{organization.name}</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          {organization.org_type.replace(/_/g, ' ')}
                          {formatLocation(organization) ? ` · ${formatLocation(organization)}` : ''}
                        </p>
                        {organization.short_bio && (
                          <p className="mt-3 text-sm text-muted-foreground">{organization.short_bio}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:min-w-[260px]">
                    <div className="rounded-2xl border border-border/50 bg-card/70 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visibility</div>
                      <div className="mt-2 text-lg font-semibold text-foreground">
                        {organization.is_published ? 'Public' : 'Draft'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-card/70 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Public startups</div>
                      <div className="mt-2 text-lg font-semibold text-foreground">{publicRelationsCount}</div>
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-card/70 px-4 py-4 col-span-2">
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {organization.website && (
                          <a href={organization.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
                            <Globe className="h-3.5 w-3.5" />
                            Website
                          </a>
                        )}
                        {formatLocation(organization) && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {formatLocation(organization)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <OrganizationRelationManager
                slug={organization.slug}
                initialRelations={organization.relations}
                onRelationsChange={(relations) => setOrganization((prev) => prev ? { ...prev, relations } : prev)}
              />

              <FacilitatorVerificationCard
                organization={organization}
                onUpdate={(patch) => setOrganization((prev) => (prev ? { ...prev, ...patch } : prev))}
              />
            </>
          ) : (
            <div className="rounded-3xl border border-border/50 bg-card px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">You do not have access to manage this startup facilitator.</p>
              <Link href={`/organizations/${slug}`} className="mt-4 inline-flex text-sm font-medium text-primary">
                View public profile
              </Link>
            </div>
          )
        ) : null}
      </div>
    </DashboardLayout>
  );
}
