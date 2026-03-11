import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// DELETE /api/messages/delete-bulk - Delete multiple selected messages
export async function DELETE(req: NextRequest) {
  const supabase = await createAuthClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { message_ids, conversation_id } = await req.json();
    if (!message_ids || !Array.isArray(message_ids) || message_ids.length === 0) {
      return NextResponse.json({ error: 'Missing or empty message_ids array' }, { status: 400 });
    }

    if (!conversation_id) {
      return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
    }

    // Verify user is a participant
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

    // Delete reactions for selected messages
    await supabase
      .from('message_reactions')
      .delete()
      .in('message_id', message_ids);

    // Delete the selected messages
    const { error: deleteErr } = await supabase
      .from('messages')
      .delete()
      .in('id', message_ids)
      .eq('conversation_id', conversation_id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: message_ids.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
