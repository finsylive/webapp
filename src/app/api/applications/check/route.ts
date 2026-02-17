import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createAdminClient } from '@/utils/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ applied: false });
    }

    const { searchParams } = new URL(req.url);
    const job_id = searchParams.get('job_id');
    const gig_id = searchParams.get('gig_id');

    if (!job_id && !gig_id) {
      return NextResponse.json({ error: 'job_id or gig_id required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const refCol = job_id ? 'job_id' : 'gig_id';
    const refVal = job_id || gig_id;

    const { data } = await admin
      .from('applications')
      .select('id, status, overall_score')
      .eq(refCol, refVal!)
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      return NextResponse.json({
        applied: true,
        application_id: data.id,
        status: data.status,
        overall_score: data.overall_score,
      });
    }

    return NextResponse.json({ applied: false });
  } catch {
    return NextResponse.json({ applied: false });
  }
}
