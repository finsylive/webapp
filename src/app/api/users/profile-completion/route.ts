import { NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';
import { calculateProfileCompletion } from '@/utils/profileCompletion';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [profileRes, experienceRes, educationRes] = await Promise.all([
      supabase
        .from('users')
        .select('full_name, avatar_url, banner_image, cover_url, tagline, about, bio, current_city, skills')
        .eq('id', user.id)
        .single(),
      supabase
        .from('work_experiences')
        .select('id')
        .eq('user_id', user.id)
        .limit(1),
      supabase
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

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in profile-completion API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
