import { NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

/**
 * POST /api/startups/founders/respond
 * Accept or decline a co-founder request.
 * Body: { founderId: string, action: 'accept' | 'decline' }
 */
export async function POST(request: Request) {
  try {
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { founderId, action } = await request.json();

    if (!founderId || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request. Required: founderId, action (accept|decline)' }, { status: 400 });
    }

    // Use admin client to bypass RLS for DB operations
    const supabase = await createAuthClient();

    // Verify this founder record belongs to the current user
    const { data: founder, error: fetchError } = await supabase
      .from('startup_founders')
      .select('id, user_id, startup_id, status')
      .eq('id', founderId)
      .single();

    if (fetchError || !founder) {
      return NextResponse.json({ error: 'Founder record not found' }, { status: 404 });
    }

    if (founder.user_id !== user.id) {
      return NextResponse.json({ error: 'You can only respond to your own co-founder requests' }, { status: 403 });
    }

    if (founder.status !== 'pending') {
      return NextResponse.json({ error: `Request already ${founder.status}` }, { status: 400 });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    const { error: updateError } = await supabase
      .from('startup_founders')
      .update({ status: newStatus })
      .eq('id', founderId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Error responding to co-founder request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
