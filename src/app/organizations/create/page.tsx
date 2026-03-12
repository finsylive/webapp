'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { createOrganization, type OrganizationType } from '@/api/organizations';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';

const ORG_TYPES: { value: OrganizationType; label: string; hint: string }[] = [
  { value: 'incubator', label: 'Incubator', hint: 'Longer-term startup support, mentorship, and infrastructure.' },
  { value: 'accelerator', label: 'Accelerator', hint: 'Cohort-based startup support with structured outcomes.' },
  { value: 'ecell', label: 'E-Cell', hint: 'Entrepreneurship cells and student-led startup communities.' },
  { value: 'college_incubator', label: 'College Incubator', hint: 'University-backed incubation and startup support.' },
  { value: 'facilitator', label: 'Facilitator', hint: 'Project facilitators, support networks, and partner bodies.' },
  { value: 'community', label: 'Community', hint: 'Builder communities, startup clubs, and networks.' },
  { value: 'other', label: 'Other', hint: 'A support organization that does not fit the preset types.' },
];

function splitTags(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

const UNIVERSITY_TYPES: OrganizationType[] = ['incubator', 'ecell', 'college_incubator'];
const SECTOR_TYPES: OrganizationType[] = ['incubator', 'accelerator', 'venture_studio', 'grant_body', 'facilitator'];
const STAGE_FOCUS_TYPES: OrganizationType[] = ['incubator', 'accelerator', 'venture_studio', 'grant_body'];
const SUPPORT_TYPES_TYPES: OrganizationType[] = ['incubator', 'accelerator', 'college_incubator', 'facilitator', 'community', 'venture_studio', 'grant_body'];

function isUniversityLinkedType(type: OrganizationType) {
  return UNIVERSITY_TYPES.includes(type);
}

function shouldShowSectors(type: OrganizationType) {
  return SECTOR_TYPES.includes(type);
}

function shouldShowStageFocus(type: OrganizationType) {
  return STAGE_FOCUS_TYPES.includes(type);
}

function shouldShowSupportTypes(type: OrganizationType) {
  return SUPPORT_TYPES_TYPES.includes(type);
}

export default function CreateOrganizationPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    org_type: 'incubator' as OrganizationType,
    short_bio: '',
    description: '',
    website: '',
    contact_email: '',
    city: '',
    state: '',
    country: '',
    university_name: '',
    sectors: '',
    stage_focus: '',
    support_types: '',
    is_published: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orgType = form.org_type;

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
          <p className="text-muted-foreground">Please sign in to create an organization profile.</p>
          <Link href="/organizations" className="mt-4 text-sm font-medium text-primary">Back to organizations</Link>
        </div>
      </DashboardLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { data } = await createOrganization({
        ...form,
        sectors: splitTags(form.sectors),
        stage_focus: splitTags(form.stage_focus),
        support_types: splitTags(form.support_types),
      });
      router.push(`/organizations/${data.slug}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create startup facilitator');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/organizations" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to startup facilitators
          </Link>
          <div className="mt-4 flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Create startup facilitator profile</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Set up a public profile for your incubator, accelerator, e-cell, or support body. You can start simple and expand later.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-border/50 bg-card p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-foreground mb-2">Startup facilitator name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                placeholder="Nirmaan Incubator"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-foreground mb-2">Facilitator type</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {ORG_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, org_type: type.value }))}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      form.org_type === type.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border/60 hover:border-primary/20 hover:bg-accent/20'
                    }`}
                  >
                    <div className="text-sm font-semibold text-foreground">{type.label}</div>
                    <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{type.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 rounded-2xl border border-border/60 bg-muted/20 px-4 py-4">
              <p className="text-sm font-medium text-foreground">
                {orgType === 'accelerator' && 'You are setting up an accelerator profile. We will focus on program-facing and startup-facing details.'}
                {orgType === 'incubator' && 'You are setting up an incubator profile. We will focus on support model, sectors, and startup stages.'}
                {orgType === 'ecell' && 'You are setting up an e-cell profile. We will focus on campus and student-community details.'}
                {orgType === 'college_incubator' && 'You are setting up a college incubator profile. We will capture university context and incubation focus.'}
                {orgType === 'facilitator' && 'You are setting up a facilitator profile. We will focus on the kind of support and partnerships you provide.'}
                {orgType === 'community' && 'You are setting up a community profile. We will focus on network identity and what members get from joining.'}
                {orgType === 'other' && 'You are setting up a startup facilitator profile. We will keep the onboarding broad and flexible.'}
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-foreground mb-2">Short bio</label>
              <input
                value={form.short_bio}
                onChange={(e) => setForm((prev) => ({ ...prev, short_bio: e.target.value }))}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                placeholder={
                  isUniversityLinkedType(orgType)
                    ? 'Campus-backed startup support for students and early builders.'
                    : orgType === 'accelerator'
                      ? 'Cohort-based support for early-stage startups.'
                      : 'What does this startup facilitator do in one line?'
                }
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-foreground mb-2">Description</label>
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                placeholder="What does your startup facilitator do, who does it help, and what outcomes do you support?"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Website</label>
              <input
                value={form.website}
                onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                placeholder="https://example.org"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Contact email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm((prev) => ({ ...prev, contact_email: e.target.value }))}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                placeholder="team@example.org"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">City</label>
              <input
                value={form.city}
                onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">State</label>
              <input
                value={form.state}
                onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Country</label>
              <input
                value={form.country}
                onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </div>

            {isUniversityLinkedType(orgType) && (
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {orgType === 'incubator' ? 'University / Parent institution' : 'University name'}
                </label>
                <input
                  value={form.university_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, university_name: e.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  placeholder={
                    orgType === 'ecell'
                      ? 'Which campus or university is this e-cell part of?'
                      : orgType === 'college_incubator'
                        ? 'Which university runs this incubator?'
                        : 'If this incubator is tied to a university or parent institution, add it here'
                  }
                />
              </div>
            )}

            {shouldShowSectors(orgType) && (
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-foreground mb-2">Sectors</label>
                <input
                  value={form.sectors}
                  onChange={(e) => setForm((prev) => ({ ...prev, sectors: e.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  placeholder={
                    orgType === 'accelerator'
                      ? 'B2B SaaS, fintech, climate, healthtech'
                      : 'AI, climate, fintech, healthtech'
                  }
                />
              </div>
            )}

            {shouldShowStageFocus(orgType) && (
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Stage focus</label>
                <input
                  value={form.stage_focus}
                  onChange={(e) => setForm((prev) => ({ ...prev, stage_focus: e.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  placeholder="idea, mvp, scaling"
                />
              </div>
            )}

            {shouldShowSupportTypes(orgType) && (
              <div className={shouldShowStageFocus(orgType) ? '' : 'md:col-span-2'}>
                <label className="block text-sm font-semibold text-foreground mb-2">Support types</label>
                <input
                  value={form.support_types}
                  onChange={(e) => setForm((prev) => ({ ...prev, support_types: e.target.value }))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  placeholder={
                    orgType === 'community'
                      ? 'community, events, peer network'
                      : orgType === 'facilitator'
                        ? 'mentorship, pilots, partnerships'
                        : 'mentorship, workspace, grants'
                  }
                />
              </div>
            )}
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setForm((prev) => ({ ...prev, is_published: e.target.checked }))}
              className="h-4 w-4"
            />
            <div>
              <div className="text-sm font-semibold text-foreground">Publish immediately</div>
              <div className="text-xs text-muted-foreground">Turn this off if you want to finish the profile before it becomes public.</div>
            </div>
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link href="/organizations" className="inline-flex items-center justify-center rounded-2xl border border-border px-5 py-3 text-sm font-medium">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
              Create startup facilitator
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
