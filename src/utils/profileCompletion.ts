export interface ProfileCompletionResult {
  percent: number;
  completed: number;
  total: number;
  missing: string[];
}

interface ProfileData {
  full_name?: string | null;
  avatar_url?: string | null;
  banner_image?: string | null;
  tagline?: string | null;
  about?: string | null;
  current_city?: string | null;
  skills?: string[] | null;
}

export function calculateProfileCompletion(
  profile: ProfileData | null,
  experienceCount: number,
  educationCount: number,
): ProfileCompletionResult {
  const fields = [
    { label: 'Full Name', done: !!profile?.full_name },
    { label: 'Avatar', done: !!profile?.avatar_url },
    { label: 'Cover Image', done: !!profile?.banner_image },
    { label: 'Tagline', done: !!profile?.tagline },
    { label: 'Bio', done: !!profile?.about },
    { label: 'City', done: !!profile?.current_city },
    { label: 'Skills', done: !!(profile?.skills && profile.skills.length > 0) },
    { label: 'Experience', done: experienceCount > 0 },
    { label: 'Education', done: educationCount > 0 },
  ];

  const completed = fields.filter(f => f.done).length;
  const total = fields.length;
  const percent = Math.round((completed / total) * 100);
  const missing = fields.filter(f => !f.done).map(f => f.label);

  return { percent, completed, total, missing };
}
