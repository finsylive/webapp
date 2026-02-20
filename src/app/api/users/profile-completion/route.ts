import { NextResponse } from 'next/server';
import { createAuthClient, createAdminClient } from '@/utils/supabase-server';
import { calculateProfileCompletion } from '@/utils/profileCompletion';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    const [profileRes, experienceRes, educationRes] = await Promise.all([
      admin
        .from('users')
        .select('username, full_name, avatar_url, banner_image, tagline, about, current_city, skills')
        .eq('id', user.id)
        .single(),
      admin
        .from('work_experiences')
        .select('id')
        .eq('user_id', user.id)
        .limit(1),
      admin
        .from('education')
        .select('id')
        .eq('user_id', user.id)
        .limit(1),
    ]);

    const result = calculateProfileCompletion(
      profileRes.data,
      (experienceRes.data || []).length,
      (educationRes.data || []).length,
    );

    return NextResponse.json({ ...result, username: profileRes.data?.username || null });
  } catch (error) {
    console.error('Error in profile-completion API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
