import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = await createAuthClient();
  // Support fetching by id, email, or username via query params
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const email = searchParams.get('email');
  const username = searchParams.get('username');

  let query = supabase.from('users').select('id, username, full_name, avatar_url, tagline, current_city, user_type, is_verified, is_onboarding_done, created_at, last_seen');
  if (id) query = query.eq('id', id);
  if (email) query = query.eq('email', email);
  if (username) query = query.eq('username', username);

  const { data, error } = await query.single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ data });
}
