"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StartupCreateWizard } from '@/components/startups/StartupCreateWizard';
import Link from 'next/link';
import { Rocket, FolderKanban, ArrowLeft, Building2 } from 'lucide-react';
import { type EntityType } from '@/api/startups';
import { fetchOrganizations, type OrganizationListItem, type OrganizationRelationType } from '@/api/organizations';

type OrgProjectConnectionMode = 'standalone' | 'organization';

export default function CreateStartupPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    }>
      <CreateStartupPageContent />
    </Suspense>
  );
}

function CreateStartupPageContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type') as EntityType | null;
  const [entityType, setEntityType] = useState<EntityType | null>(
    typeParam === 'startup' || typeParam === 'org_project' ? typeParam : null
  );
  const [availableOrganizations, setAvailableOrganizations] = useState<OrganizationListItem[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);
  const [connectionMode, setConnectionMode] = useState<OrgProjectConnectionMode>('standalone');
  const [selectedClubSlug, setSelectedClubSlug] = useState('');
  const [selectedFacilitatorSlug, setSelectedFacilitatorSlug] = useState('');
  const [facilitatorRelationType, setFacilitatorRelationType] = useState<OrganizationRelationType>('supported');
  const [manualFacilitatorName, setManualFacilitatorName] = useState('');
  const [hostOrganizationName, setHostOrganizationName] = useState('');

  useEffect(() => {
    if (!user || isLoading) return;
    setLoadingOrganizations(true);
    fetchOrganizations()
      .then(({ data }) => setAvailableOrganizations(data ?? []))
      .catch((error) => console.error('Failed to load organizations', error))
      .finally(() => setLoadingOrganizations(false));
  }, [user, isLoading]);

  const selectableOrganizations = useMemo(
    () => availableOrganizations.filter((org) => org.org_type === 'club'),
    [availableOrganizations]
  );
  const selectableFacilitators = useMemo(
    () => availableOrganizations.filter((org) => org.org_type !== 'club'),
    [availableOrganizations]
  );

  const selectedClub = selectableOrganizations.find((org) => org.slug === selectedClubSlug) || null;
  const selectedFacilitator = selectableFacilitators.find((org) => org.slug === selectedFacilitatorSlug) || null;

  useEffect(() => {
    if (entityType !== 'org_project') {
      setConnectionMode('standalone');
      setSelectedClubSlug('');
      setHostOrganizationName('');
    }
    if (entityType !== 'startup') {
      setSelectedFacilitatorSlug('');
      setFacilitatorRelationType('supported');
      setManualFacilitatorName('');
    }
  }, [entityType]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Please sign in to create a profile.</p>
        </div>
      </DashboardLayout>
    );
  }

  // Type picker — shown before wizard
  if (!entityType) {
    return (
      <DashboardLayout>
        <div className="py-6 sm:py-10">
          <div className="max-w-2xl mx-auto px-4 sm:px-0">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </button>
            <h1 className="text-xl font-bold text-foreground">What are you building?</h1>
            <p className="text-sm text-muted-foreground mt-1">Pick the type that fits. You can change this later.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
              {/* Org Project Card */}
              <button
                onClick={() => setEntityType('org_project')}
                className="group text-left p-5 bg-card border-2 border-border/40 rounded-2xl hover:border-primary/40 hover:bg-primary/[0.03] transition-all duration-150"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors duration-150 mb-3">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-foreground block">Org Project</span>
                <span className="text-xs text-muted-foreground mt-1 block leading-relaxed">
                  Lab, competition team, initiative, or club project. You can keep it standalone or link it to an organization later in this flow.
                </span>
              </button>

              {/* Startup Card */}
              <button
                onClick={() => setEntityType('startup')}
                className="group text-left p-5 bg-card border-2 border-border/40 rounded-2xl hover:border-primary/40 hover:bg-primary/[0.03] transition-all duration-150"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors duration-150 mb-3">
                  <Rocket className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-foreground block">Startup</span>
                <span className="text-xs text-muted-foreground mt-1 block leading-relaxed">
                  Registered company or venture seeking funding. Full fundraising tools and investor visibility.
                </span>
              </button>

              <Link
                href="/organizations/create"
                className="group text-left p-5 bg-card border-2 border-border/40 rounded-2xl hover:border-primary/40 hover:bg-primary/[0.03] transition-all duration-150"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors duration-150 mb-3">
                  <Building2 className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-foreground block">Startup Facilitator</span>
                <span className="text-xs text-muted-foreground mt-1 block leading-relaxed">
                  Incubator, accelerator, or e-cell. Setup continues in the business app.
                </span>
              </Link>

              <Link
                href="/organizations/create?type=club"
                className="group text-left p-5 bg-card border-2 border-border/40 rounded-2xl hover:border-primary/40 hover:bg-primary/[0.03] transition-all duration-150"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors duration-150 mb-3">
                  <Building2 className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-foreground block">Organization</span>
                <span className="text-xs text-muted-foreground mt-1 block leading-relaxed">
                  Create an org profile for a club, society, or campus body.
                </span>
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Wizard
  return (
    <DashboardLayout>
      <div className="py-6 sm:py-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-0 mb-6">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => setEntityType(null)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Change type
            </button>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
              entityType === 'org_project'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {entityType === 'org_project' ? (
                <><FolderKanban className="h-3 w-3" /> Org Project</>
              ) : (
                <><Rocket className="h-3 w-3" /> Startup</>
              )}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {entityType === 'org_project' ? 'Create your org project' : 'Create your startup profile'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {entityType === 'org_project'
              ? 'Showcase your project, team, and work to the community.'
              : 'Fill in the details to get your startup listed on the platform.'}
          </p>
        </div>
        {entityType === 'org_project' && (
          <div className="max-w-2xl mx-auto px-4 sm:px-0 mb-6">
            <div className="rounded-2xl border border-border/50 bg-card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Affiliation and connections</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Org projects can stay standalone or sit under an organization such as a club or society.
                  </p>
                </div>
                <Link
                  href="/organizations/create?type=club"
                  className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm font-medium hover:bg-accent/40"
                >
                  <Building2 className="h-4 w-4" />
                  Create club
                </Link>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  {
                    id: 'standalone',
                    title: 'Standalone',
                    body: 'Use this for projects that are independent or only have a host institution like IIT Madras.',
                  },
                  {
                    id: 'organization',
                    title: 'Under an organization',
                    body: 'Link this project to a club or campus organization after it is created.',
                  },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setConnectionMode(option.id as OrgProjectConnectionMode)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      connectionMode === option.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border/60 bg-background hover:border-primary/30'
                    }`}
                  >
                    <div className="text-sm font-semibold text-foreground">{option.title}</div>
                    <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{option.body}</div>
                  </button>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Host institution or umbrella organization
                  </label>
                  <input
                    value={hostOrganizationName}
                    onChange={(e) => setHostOrganizationName(e.target.value)}
                    placeholder="e.g. IIT Madras, CFI IIT Madras, Department of Mechanical Engineering"
                    className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use this when the project belongs under an institution or body that may not have a profile in the app yet.
                  </p>
                </div>

                {connectionMode === 'organization' && (
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-foreground">Choose an organization</label>
                    <select
                      value={selectedClubSlug}
                      onChange={(e) => setSelectedClubSlug(e.target.value)}
                      className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                    >
                      <option value="">{loadingOrganizations ? 'Loading organizations…' : 'Select an organization'}</option>
                      {selectableOrganizations.map((org) => (
                        <option key={org.id} value={org.slug}>{org.name}</option>
                      ))}
                    </select>
                    {selectableOrganizations.length === 0 && !loadingOrganizations && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        No organization profiles are available yet. Create one first, then come back to attach this org project.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-border/50 bg-background px-4 py-3 text-xs text-muted-foreground">
                {connectionMode === 'organization' && selectedClub
                  ? `This org project will be created first and then linked to ${selectedClub.name}.`
                  : 'You can create the org project first and add or change organization connections later from the relevant dashboards.'}
              </div>
            </div>
          </div>
        )}
        {entityType === 'startup' && (
          <div className="max-w-2xl mx-auto px-4 sm:px-0 mb-6">
            <div className="rounded-2xl border border-border/50 bg-card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Startup facilitator connection</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Startups can optionally connect to a startup facilitator such as an incubator, accelerator, or e-cell.
                  </p>
                </div>
                <Link
                  href="/organizations/create"
                  className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm font-medium hover:bg-accent/40"
                >
                  <Building2 className="h-4 w-4" />
                  Create facilitator
                </Link>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Connect startup facilitator</label>
                  <select
                    value={selectedFacilitatorSlug}
                    onChange={(e) => setSelectedFacilitatorSlug(e.target.value)}
                    className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    <option value="">{loadingOrganizations ? 'Loading facilitators…' : 'No facilitator selected'}</option>
                    {selectableFacilitators.map((org) => (
                      <option key={org.id} value={org.slug}>{org.name}</option>
                    ))}
                  </select>
                  {selectableFacilitators.length === 0 && !loadingOrganizations && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No startup facilitators are available yet. Facilitator profiles are created in business.ments.app and appear here once published.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Connection type</label>
                  <select
                    value={facilitatorRelationType}
                    onChange={(e) => setFacilitatorRelationType(e.target.value as OrganizationRelationType)}
                    className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    <option value="supported">Supported</option>
                    <option value="incubated">Incubated</option>
                    <option value="accelerated">Accelerated</option>
                    <option value="partnered">Partnered</option>
                    <option value="mentored">Mentored</option>
                    <option value="funded">Funded</option>
                    <option value="community_member">Community member</option>
                  </select>
                </div>
              </div>

              {selectableFacilitators.length === 0 && !loadingOrganizations && (
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-foreground">Startup facilitator name</label>
                  <input
                    value={manualFacilitatorName}
                    onChange={(e) => setManualFacilitatorName(e.target.value)}
                    placeholder="e.g. IITM Incubation Cell, Campus E-Cell, NSRCEL"
                    className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Use this if the facilitator does not exist in the database yet. It will be saved as plain text on the startup profile.
                  </p>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-border/50 bg-background px-4 py-3 text-xs text-muted-foreground">
                {selectedFacilitator
                  ? `This startup will be created first and then linked to ${selectedFacilitator.name} as ${facilitatorRelationType.replace(/_/g, ' ')}.`
                  : manualFacilitatorName.trim()
                    ? `This startup will record ${manualFacilitatorName.trim()} as its startup facilitator until a profile exists in the database.`
                    : 'Leave this blank if the startup is not connected to any startup facilitator yet.'}
              </div>
            </div>
          </div>
        )}
        <StartupCreateWizard
          entityType={entityType}
          orgProjectConnection={entityType === 'org_project' ? {
            hostOrganizationName,
            organizationSlug: connectionMode === 'organization' ? selectedClubSlug || null : null,
            organizationName: connectionMode === 'organization' ? selectedClub?.name || null : null,
            relationType: connectionMode === 'organization' ? 'club_project' : null,
          } : undefined}
          startupFacilitatorConnection={entityType === 'startup' ? {
            organizationSlug: selectedFacilitatorSlug || null,
            organizationName: selectedFacilitator?.name || manualFacilitatorName.trim() || null,
            relationType: facilitatorRelationType,
          } : undefined}
        />
      </div>
    </DashboardLayout>
  );
}
