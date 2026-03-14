'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { createClub, fetchOrganizations, getCreateFacilitatorRedirectUrl } from '@/api/organizations';
import { ArrowLeft, ExternalLink, Loader2, Save } from 'lucide-react';

function tagsToArray(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export default function CreateOrganizationPage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>}>
      <CreateOrganizationContent />
    </Suspense>
  );
}

function CreateOrganizationContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isClubMode = (searchParams.get('type') || '').toLowerCase() === 'club';
  const [loading, setLoading] = useState(true);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingClub, setSubmittingClub] = useState(false);
  const [clubForm, setClubForm] = useState({
    organisation_name: '',
    short_bio: '',
    description: '',
    website: '',
    contact_email: '',
    logo_url: '',
    banner_url: '',
    city: '',
    state: '',
    country: '',
    university_name: '',
    sectors: '',
    stage_focus: '',
    support_types: '',
  });

  useEffect(() => {
    if (isLoading || !user) return;
    if (isClubMode) {
      setLoading(false);
      return;
    }

    const resolveDestination = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await fetchOrganizations({ mine: true });
        const facilitatorOrg = data.find((item) => item.org_type !== 'club');
        if (facilitatorOrg) {
          router.replace(`/organizations/${facilitatorOrg.slug}/dashboard`);
          return;
        }

        const redirectUrl = getCreateFacilitatorRedirectUrl('/startups?tab=facilitators');
        setTargetUrl(redirectUrl);
        window.location.assign(redirectUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to prepare organization setup');
      } finally {
        setLoading(false);
      }
    };

    resolveDestination();
  }, [isClubMode, isLoading, router, user]);

  const handleClubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingClub(true);
    setError(null);
    try {
      const { data } = await createClub({
        ...clubForm,
        sectors: tagsToArray(clubForm.sectors),
        stage_focus: tagsToArray(clubForm.stage_focus),
        support_types: tagsToArray(clubForm.support_types),
      });
      router.replace(`/organizations/${data.slug}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create club profile');
    } finally {
      setSubmittingClub(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground">Please sign in to continue.</p>
          <Link href="/organizations" className="mt-4 text-sm font-medium text-primary">
            Back to organizations
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/organizations" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to organizations
        </Link>

        <div className="rounded-3xl border border-border/50 bg-card p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isClubMode ? 'Create Club Profile' : 'Startup facilitator setup lives in business.ments.app'}
          </h1>

          {isClubMode ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Clubs reuse the current organization layer. This creates a club profile directly in the app so you can connect org projects to it from the dashboard.
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Facilitator creation and business verification are managed in the business app. After setup there, you will come back here to manage the in-app profile and startup assignments.
            </p>
          )}

          {isClubMode ? (
            <form onSubmit={handleClubSubmit} className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-foreground">Club name</label>
                <input
                  value={clubForm.organisation_name}
                  onChange={(e) => setClubForm((prev) => ({ ...prev, organisation_name: e.target.value }))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-foreground">Short bio</label>
                <input
                  value={clubForm.short_bio}
                  onChange={(e) => setClubForm((prev) => ({ ...prev, short_bio: e.target.value }))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-foreground">Description</label>
                <textarea
                  rows={4}
                  value={clubForm.description}
                  onChange={(e) => setClubForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Contact email</label>
                <input
                  value={clubForm.contact_email}
                  onChange={(e) => setClubForm((prev) => ({ ...prev, contact_email: e.target.value }))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Website</label>
                <input
                  value={clubForm.website}
                  onChange={(e) => setClubForm((prev) => ({ ...prev, website: e.target.value }))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">City</label>
                <input
                  value={clubForm.city}
                  onChange={(e) => setClubForm((prev) => ({ ...prev, city: e.target.value }))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">State</label>
                <input
                  value={clubForm.state}
                  onChange={(e) => setClubForm((prev) => ({ ...prev, state: e.target.value }))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Country</label>
                <input
                  value={clubForm.country}
                  onChange={(e) => setClubForm((prev) => ({ ...prev, country: e.target.value }))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Institution</label>
                <input
                  value={clubForm.university_name}
                  onChange={(e) => setClubForm((prev) => ({ ...prev, university_name: e.target.value }))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Logo URL</label>
                <input
                  value={clubForm.logo_url}
                  onChange={(e) => setClubForm((prev) => ({ ...prev, logo_url: e.target.value }))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Banner URL</label>
                <input
                  value={clubForm.banner_url}
                  onChange={(e) => setClubForm((prev) => ({ ...prev, banner_url: e.target.value }))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-foreground">Sectors</label>
                <input
                  value={clubForm.sectors}
                  onChange={(e) => setClubForm((prev) => ({ ...prev, sectors: e.target.value }))}
                  placeholder="Robotics, AI, Manufacturing"
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Stage focus</label>
                <input
                  value={clubForm.stage_focus}
                  onChange={(e) => setClubForm((prev) => ({ ...prev, stage_focus: e.target.value }))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Support types</label>
                <input
                  value={clubForm.support_types}
                  onChange={(e) => setClubForm((prev) => ({ ...prev, support_types: e.target.value }))}
                  placeholder="labs, mentorship, competitions"
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              {error && <p className="md:col-span-2 text-sm text-red-500">{error}</p>}

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submittingClub}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {submittingClub ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Create club
                </button>
              </div>
            </form>
          ) : loading ? (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting to business.ments.app...
            </div>
          ) : (
            <div className="mt-6 space-y-3 text-center">
              {error && <p className="text-sm text-red-500">{error}</p>}
              {targetUrl && (
                <a
                  href={targetUrl}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                  Continue in business.ments.app
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
