// projects api

export type UUID = string;

export type Project = {
  id: UUID;
  owner_id: UUID;
  title: string;
  category: UUID;
  tagline: string | null;
  cover_url: string | null;
  logo_url: string | null;
  visibility: 'public' | 'private' | 'unlisted';
  created_at: string;
};

export type ProjectLink = {
  id: UUID;
  project_id: UUID;
  title: string;
  url: string;
  icon_name?: string | null;
  display_order: number;
  created_at: string;
};

export type ProjectSlide = {
  id: UUID;
  project_id: UUID;
  slide_url: string;
  caption?: string | null;
  slide_number: number;
  created_at: string;
};

export type ProjectTextSection = {
  id: UUID;
  project_id: UUID;
  heading: string;
  content: string;
  display_order: number;
  created_at: string;
};

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = payload?.error || `Request failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return payload as T;
}

// ---------------- Projects ----------------

export async function listProjects(username: string): Promise<{ data: Project[] }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects`);
}

export async function createProject(
  username: string,
  body: {
    title: string;
    category: UUID;
    tagline?: string | null;
    cover_url?: string | null;
    logo_url?: string | null;
    visibility?: 'public' | 'private' | 'unlisted';
  }
): Promise<{ data: Project }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getProject(
  username: string,
  projectId: UUID
): Promise<{ data: Project }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}`);
}

export async function updateProject(
  username: string,
  projectId: UUID,
  patch: Partial<Pick<Project, 'title' | 'category' | 'tagline' | 'cover_url' | 'logo_url' | 'visibility'>>
): Promise<{ data: Project }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export async function deleteProject(username: string, projectId: UUID): Promise<{ ok: true }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
}

// ---------------- Links ----------------

export async function listProjectLinks(username: string, projectId: UUID): Promise<{ data: ProjectLink[] }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/links`);
}

export async function addProjectLink(
  username: string,
  projectId: UUID,
  body: { title: string; url: string; icon_name?: string | null; display_order?: number }
): Promise<{ data: ProjectLink }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/links`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateProjectLink(
  username: string,
  projectId: UUID,
  linkId: UUID,
  patch: Partial<Pick<ProjectLink, 'title' | 'url' | 'icon_name' | 'display_order'>>
): Promise<{ data: ProjectLink }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/links/${encodeURIComponent(linkId)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export async function deleteProjectLink(username: string, projectId: UUID, linkId: UUID): Promise<{ ok: true }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/links/${encodeURIComponent(linkId)}`, {
    method: 'DELETE',
  });
}

// ---------------- Slides ----------------

export async function listProjectSlides(username: string, projectId: UUID): Promise<{ data: ProjectSlide[] }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/slides`);
}

export async function addProjectSlide(
  username: string,
  projectId: UUID,
  body: { slide_url: string; caption?: string | null; slide_number: number }
): Promise<{ data: ProjectSlide }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/slides`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateProjectSlide(
  username: string,
  projectId: UUID,
  slideId: UUID,
  patch: Partial<Pick<ProjectSlide, 'slide_url' | 'caption' | 'slide_number'>>
): Promise<{ data: ProjectSlide }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/slides/${encodeURIComponent(slideId)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export async function deleteProjectSlide(username: string, projectId: UUID, slideId: UUID): Promise<{ ok: true }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/slides/${encodeURIComponent(slideId)}`, {
    method: 'DELETE',
  });
}

// ---------------- Text Sections ----------------

export async function listProjectTextSections(username: string, projectId: UUID): Promise<{ data: ProjectTextSection[] }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/text_sections`);
}

export async function addProjectTextSection(
  username: string,
  projectId: UUID,
  body: { heading: string; content: string; display_order?: number }
): Promise<{ data: ProjectTextSection }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/text_sections`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateProjectTextSection(
  username: string,
  projectId: UUID,
  sectionId: UUID,
  patch: Partial<Pick<ProjectTextSection, 'heading' | 'content' | 'display_order'>>
): Promise<{ data: ProjectTextSection }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/text_sections/${encodeURIComponent(sectionId)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export async function deleteProjectTextSection(username: string, projectId: UUID, sectionId: UUID): Promise<{ ok: true }>
{
  return jsonFetch(`/api/users/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}/text_sections/${encodeURIComponent(sectionId)}`, {
    method: 'DELETE',
  });
}
