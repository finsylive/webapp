export type OrganizationType =
  | 'incubator'
  | 'accelerator'
  | 'ecell'
  | 'college_incubator'
  | 'facilitator'
  | 'venture_studio'
  | 'grant_body'
  | 'community'
  | 'other';

export type OrganizationRole = 'owner' | 'admin' | 'reviewer' | 'editor';
export type OrganizationRelationType = 'incubated' | 'accelerated' | 'partnered' | 'mentored' | 'funded' | 'community_member';
export type OrganizationRelationStatus = 'requested' | 'accepted' | 'active' | 'alumni' | 'rejected' | 'withdrawn';
export type FacilitatorVerificationStatus = 'unverified' | 'pending_review' | 'verified' | 'rejected';

export type OrganizationListItem = {
  id: string;
  slug: string;
  name: string;
  org_type: OrganizationType;
  short_bio: string | null;
  website: string | null;
  logo_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  is_verified: boolean;
  verification_status: FacilitatorVerificationStatus;
  is_published: boolean;
  sectors: string[];
  support_types: string[];
  created_at: string;
};

export type OrganizationStartupRelation = {
  id: string;
  startup_id: string;
  relation_type: OrganizationRelationType;
  status: OrganizationRelationStatus;
  requested_at?: string | null;
  responded_at?: string | null;
  start_date: string | null;
  end_date: string | null;
  startup: {
    id: string;
    brand_name: string;
    description: string | null;
    stage: string;
    entity_type: 'startup' | 'org_project';
    logo_url: string | null;
    city: string | null;
    country: string | null;
  } | null;
};

export type StartupOrgRequest = {
  id: string;
  startup_id: string;
  startup_name: string;
  relation_type: OrganizationRelationType;
  status: OrganizationRelationStatus;
  requested_at: string | null;
  organization: {
    id: string;
    slug: string;
    name: string;
    org_type: OrganizationType;
    logo_url: string | null;
    short_bio: string | null;
  };
};

export type OrganizationProfile = OrganizationListItem & {
  description: string | null;
  contact_email: string | null;
  banner_url: string | null;
  university_name: string | null;
  stage_focus: string[];
  created_by: string;
  updated_at: string;
  verification_requested_at: string | null;
  verification_reviewed_at: string | null;
  verification_submitted_by: string | null;
  verification_rejection_reason: string | null;
  verification_details: {
    official_email?: string | null;
    role_title?: string | null;
    evidence_links?: string[];
    proof_summary?: string | null;
  };
  is_admin: boolean;
  member_role: OrganizationRole | null;
  relations: OrganizationStartupRelation[];
};

export type CreateOrganizationInput = {
  name: string;
  org_type: OrganizationType;
  short_bio?: string;
  description?: string;
  website?: string;
  contact_email?: string;
  logo_url?: string;
  banner_url?: string;
  city?: string;
  state?: string;
  country?: string;
  university_name?: string;
  sectors?: string[];
  stage_focus?: string[];
  support_types?: string[];
  is_published?: boolean;
};

export type FacilitatorVerificationInput = {
  official_email: string;
  role_title?: string;
  evidence_links?: string[];
  proof_summary?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Request failed');
  }
  return json;
}

export async function fetchOrganizations(opts: { search?: string; org_type?: string; mine?: boolean } = {}) {
  const params = new URLSearchParams();
  if (opts.search) params.set('search', opts.search);
  if (opts.org_type) params.set('org_type', opts.org_type);
  if (opts.mine) params.set('mine', 'true');

  const res = await fetch(`/api/organizations${params.toString() ? `?${params}` : ''}`, {
    cache: 'no-store',
  });
  return parseJson<{ data: OrganizationListItem[] }>(res);
}

export async function fetchOrganizationBySlug(slug: string) {
  const res = await fetch(`/api/organizations/${slug}`, { cache: 'no-store' });
  return parseJson<{ data: OrganizationProfile }>(res);
}

export async function createOrganization(input: CreateOrganizationInput) {
  const res = await fetch('/api/organizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJson<{ data: OrganizationProfile }>(res);
}

export async function sendOrganizationRequest(
  slug: string,
  input: {
    startup_id: string;
    relation_type: OrganizationRelationType;
  }
) {
  const res = await fetch(`/api/organizations/${slug}/relations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJson<{ data: OrganizationStartupRelation }>(res);
}

export async function deleteOrganizationRelation(slug: string, startup_id: string) {
  const res = await fetch(`/api/organizations/${slug}/relations`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startup_id }),
  });
  return parseJson<{ success: true }>(res);
}

export async function fetchStartupOrgRequests() {
  const res = await fetch('/api/startups/org-requests', { cache: 'no-store' });
  return parseJson<{ data: StartupOrgRequest[] }>(res);
}

export async function respondToOrgRequest(id: string, action: 'accept' | 'reject') {
  const res = await fetch(`/api/startups/org-requests/${id}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  return parseJson<{ data: { id: string; status: OrganizationRelationStatus } }>(res);
}

export async function applyForFacilitatorVerification(
  slug: string,
  input: FacilitatorVerificationInput
) {
  const res = await fetch(`/api/organizations/${slug}/verification/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJson<{
    data: {
      verification_status: FacilitatorVerificationStatus;
      verification_requested_at: string | null;
      verification_reviewed_at: string | null;
      verification_rejection_reason: string | null;
      verification_details: OrganizationProfile['verification_details'];
      is_verified: boolean;
    };
  }>(res);
}
