import { NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';
import { getExperiments, createExperiment } from '@/lib/feed/experiments';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const experiments = await getExperiments(supabase);
    return NextResponse.json({ experiments });
  } catch (error) {
    console.error('Error fetching experiments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow designated admin users to create experiments
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (!user.email || !adminEmails.includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const experiment = await createExperiment(supabase, body);

    if (!experiment) {
      return NextResponse.json({ error: 'Failed to create experiment' }, { status: 500 });
    }

    return NextResponse.json({ experiment });
  } catch (error) {
    console.error('Error creating experiment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
