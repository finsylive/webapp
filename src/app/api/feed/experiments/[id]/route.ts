import { NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';
import { updateExperiment } from '@/lib/feed/experiments';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const admin = await createAuthClient();
    const { data: experiment, error } = await admin
      .from('feed_experiments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    // Get assignment counts per variant
    const { data: assignments } = await admin
      .from('feed_experiment_assignments')
      .select('variant_id')
      .eq('experiment_id', id);

    const variantCounts: Record<string, number> = {};
    (assignments || []).forEach((a: { variant_id: string }) => {
      variantCounts[a.variant_id] = (variantCounts[a.variant_id] || 0) + 1;
    });

    return NextResponse.json({ experiment, variant_counts: variantCounts });
  } catch (error) {
    console.error('Error fetching experiment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow designated admin users to update experiments
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (!user.email || !adminEmails.includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const updated = await updateExperiment(supabase, id, body);

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update experiment' }, { status: 500 });
    }

    return NextResponse.json({ experiment: updated });
  } catch (error) {
    console.error('Error updating experiment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
