import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// DELETE /api/messages/clear - Clear chat for the current user only (per-user soft clear)
export async function DELETE(req: NextRequest) {
  const supabase = await createAuthClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { conversation_id } = await req.json();
    if (!conversation_id) {
      return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
    }

    // Verify user is a participant and determine which user slot they are
    const { data: convo, error: convoErr } = await supabase
      .from('conversations')
      .select('id, user1_id, user2_id')
      .eq('id', conversation_id)
      .single();

    if (convoErr || !convo) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (convo.user1_id !== user.id && convo.user2_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Set the cleared_at timestamp for this user (messages before this time won't be shown)
    const now = new Date().toISOString();
    const clearedField = convo.user1_id === user.id ? 'user1_cleared_at' : 'user2_cleared_at';

    const { error: updateErr } = await supabase
      .from('conversations')
      .update({ [clearedField]: now })
      .eq('id', conversation_id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
