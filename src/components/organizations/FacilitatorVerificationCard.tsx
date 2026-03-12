'use client';

import { useMemo, useState } from 'react';
import type { OrganizationProfile } from '@/api/organizations';
import { applyForFacilitatorVerification } from '@/api/organizations';
import { BadgeCheck, Loader2, Mail, ShieldCheck, Sparkles } from 'lucide-react';

const inputClass = 'w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15';

function statusTone(status: OrganizationProfile['verification_status']) {
  switch (status) {
    case 'verified':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600';
    case 'pending_review':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-600';
    case 'rejected':
      return 'border-red-500/20 bg-red-500/10 text-red-600';
    default:
      return 'border-border/60 bg-muted/30 text-muted-foreground';
  }
}

export function FacilitatorVerificationCard({
  organization,
  onUpdate,
}: {
  organization: OrganizationProfile;
  onUpdate: (patch: Partial<OrganizationProfile>) => void;
}) {
  const [officialEmail, setOfficialEmail] = useState(organization.verification_details?.official_email || organization.contact_email || '');
  const [roleTitle, setRoleTitle] = useState(organization.verification_details?.role_title || '');
  const [evidenceLinks, setEvidenceLinks] = useState((organization.verification_details?.evidence_links || []).join(', '));
  const [proofSummary, setProofSummary] = useState(organization.verification_details?.proof_summary || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canApply = organization.verification_status === 'unverified' || organization.verification_status === 'rejected';
  const statusCopy = useMemo(() => {
    switch (organization.verification_status) {
      case 'verified':
        return 'This startup facilitator is verified. Founders will see the verified badge on the public profile and in discovery.';
      case 'pending_review':
        return 'Your verification request is pending manual review. Keep the profile complete and make sure the website and contact details stay accurate.';
      case 'rejected':
        return organization.verification_rejection_reason || 'The last verification request was not approved. Update the details below and resubmit.';
      default:
        return 'Verification helps founders trust facilitator requests and improves discovery placement across the product.';
    }
  }, [organization.verification_rejection_reason, organization.verification_status]);

  const handleSubmit = async () => {
    if (!officialEmail.trim()) {
      setError('Official email is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { data } = await applyForFacilitatorVerification(organization.slug, {
        official_email: officialEmail.trim(),
        role_title: roleTitle.trim(),
        evidence_links: evidenceLinks
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        proof_summary: proofSummary.trim(),
      });

      onUpdate({
        verification_status: data.verification_status,
        verification_requested_at: data.verification_requested_at,
        verification_reviewed_at: data.verification_reviewed_at,
        verification_rejection_reason: data.verification_rejection_reason,
        verification_details: data.verification_details,
        is_verified: data.is_verified,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit verification request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border/50 bg-card p-6 shadow-sm space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Trust & Verification
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">Startup facilitator verification</h2>
          <p className="mt-1 text-sm text-muted-foreground">{statusCopy}</p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${statusTone(organization.verification_status)}`}>
          {organization.verification_status === 'verified' ? <BadgeCheck className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
          {organization.verification_status.replace(/_/g, ' ')}
        </div>
      </div>

      {organization.verification_requested_at && (
        <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Requested on {new Date(organization.verification_requested_at).toLocaleDateString()}
          {organization.verification_reviewed_at ? ` · Reviewed on ${new Date(organization.verification_reviewed_at).toLocaleDateString()}` : ''}
        </div>
      )}

      {canApply && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Official email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={officialEmail}
                onChange={(e) => setOfficialEmail(e.target.value)}
                placeholder="team@facilitator.org"
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Your role</label>
            <input
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Program lead, founder office, incubator manager"
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-foreground">Evidence links</label>
            <input
              value={evidenceLinks}
              onChange={(e) => setEvidenceLinks(e.target.value)}
              placeholder="Website, LinkedIn page, cohort page, university page"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted-foreground">Use commas to separate multiple links.</p>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-foreground">Proof summary</label>
            <textarea
              rows={4}
              value={proofSummary}
              onChange={(e) => setProofSummary(e.target.value)}
              placeholder="Explain what this facilitator is, who runs it, and why it should be verified."
              className={inputClass}
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {canApply && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {organization.verification_status === 'rejected' ? 'Resubmit verification' : 'Request verification'}
          </button>
        </div>
      )}
    </section>
  );
}
