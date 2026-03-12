'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { fetchOrganizationBySlug, type OrganizationProfile, type OrganizationStartupRelation } from '@/api/organizations';
import { ArrowLeft, Building2, Globe, Mail, MapPin, School, Settings2, Sparkles } from 'lucide-react';

function formatLocation(org: OrganizationProfile) {
  return [org.city, org.state, org.country].filter(Boolean).join(', ');
}

function visibleRelations(relations: OrganizationStartupRelation[]) {
  return relations.filter((relation) => ['accepted', 'active', 'alumni'].includes(relation.status));
}

export default function OrganizationDetailPage() {
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

  const publicRelations = visibleRelations(organization?.relations || []);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Link href="/organizations" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to startup facilitators
        </Link>

        {loading ? (
          <div className="space-y-4">
            <div className="h-48 rounded-3xl bg-muted animate-pulse" />
            <div className="h-40 rounded-3xl bg-muted animate-pulse" />
            <div className="h-56 rounded-3xl bg-muted animate-pulse" />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-border/50 bg-card px-6 py-12 text-center">
            <p className="text-red-500">{error}</p>
          </div>
        ) : organization ? (
          <>
            {organization.banner_url && (
              <div className="h-52 overflow-hidden rounded-3xl border border-border/40">
                <img src={organization.banner_url} alt={organization.name} className="h-full w-full object-cover" />
              </div>
            )}

            <section className="rounded-3xl border border-border/40 bg-card p-6 shadow-sm">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {organization.logo_url ? (
                  <img
                    src={organization.logo_url}
                    alt={organization.name}
                    className={`h-20 w-20 rounded-3xl border border-border/40 object-cover ${organization.banner_url ? '-mt-16 ring-4 ring-card' : ''}`}
                  />
                ) : (
                  <div className={`flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary ${organization.banner_url ? '-mt-16 ring-4 ring-card' : ''}`}>
                    <Building2 className="h-9 w-9" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">{organization.name}</h1>
                    <span className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {organization.org_type.replace(/_/g, ' ')}
                    </span>
                    {organization.is_verified && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-500">
                        <Sparkles className="h-3 w-3" />
                        Verified
                      </span>
                    )}
                  </div>

                  {organization.short_bio && (
                    <p className="mt-3 text-base text-muted-foreground leading-relaxed">{organization.short_bio}</p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {formatLocation(organization) && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" />
                        {formatLocation(organization)}
                      </span>
                    )}
                    {organization.website && (
                      <a href={organization.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
                        <Globe className="h-4 w-4" />
                        Website
                      </a>
                    )}
                    {organization.contact_email && (
                      <a href={`mailto:${organization.contact_email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                        <Mail className="h-4 w-4" />
                        Contact
                      </a>
                    )}
                    {organization.university_name && (
                      <span className="inline-flex items-center gap-1.5">
                        <School className="h-4 w-4" />
                        {organization.university_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {(organization.description || organization.support_types.length > 0 || organization.sectors.length > 0 || organization.stage_focus.length > 0) && (
              <section className="rounded-3xl border border-border/40 bg-card p-6 shadow-sm space-y-5">
                {organization.description && (
                  <div>
                    <h2 className="text-sm font-semibold text-foreground mb-2">About</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{organization.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {organization.support_types.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Support</h3>
                      <div className="flex flex-wrap gap-2">
                        {organization.support_types.map((item) => (
                          <span key={item} className="rounded-full bg-primary/8 px-3 py-1 text-xs font-medium text-primary border border-primary/15">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {organization.sectors.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sectors</h3>
                      <div className="flex flex-wrap gap-2">
                        {organization.sectors.map((item) => (
                          <span key={item} className="rounded-full bg-accent/50 px-3 py-1 text-xs font-medium text-foreground/80">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {organization.stage_focus.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Stage focus</h3>
                      <div className="flex flex-wrap gap-2">
                        {organization.stage_focus.map((item) => (
                          <span key={item} className="rounded-full bg-accent/50 px-3 py-1 text-xs font-medium text-foreground/80">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-border/40 bg-card p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">Associated startups</h2>
                <p className="text-sm text-muted-foreground">
                  Accepted, active, and alumni startups linked to this startup facilitator.
                </p>
              </div>

              {publicRelations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 px-6 py-10 text-center">
                  <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">No startups are publicly linked yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {publicRelations.map((relation) => (
                    <Link
                      key={relation.id}
                      href={`/startups/${relation.startup?.id}`}
                      className="rounded-2xl border border-border/50 p-4 hover:bg-accent/20"
                    >
                      <div className="flex items-start gap-3">
                        {relation.startup?.logo_url ? (
                          <img src={relation.startup.logo_url} alt={relation.startup.brand_name} className="h-12 w-12 rounded-2xl border border-border/40 object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Building2 className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-foreground">{relation.startup?.brand_name}</h3>
                            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {relation.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {relation.relation_type.replace(/_/g, ' ')} · {relation.startup?.stage}
                          </p>
                          {relation.startup?.description && (
                            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{relation.startup.description}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {organization.is_admin && (
              <section className="rounded-3xl border border-border/40 bg-card p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Facilitator admin</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage startup relations and facilitator-facing operations from the dashboard, not the public profile.
                    </p>
                  </div>
                  <Link
                    href={`/organizations/${organization.slug}/dashboard`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    <Settings2 className="h-4 w-4" />
                    Open dashboard
                  </Link>
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
