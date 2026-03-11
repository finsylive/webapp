import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// DELETE /api/messages/clear - Clear all messages in a conversation
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

    // Delete all reactions for messages in this conversation first
    const { data: msgIds } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversation_id);

    if (msgIds && msgIds.length > 0) {
      await supabase
        .from('message_reactions')
        .delete()
        .in('message_id', msgIds.map((m: { id: string }) => m.id));
    }

    // Delete all messages
    const { error: deleteErr } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversation_id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // Reset last_message on conversation
    await supabase
      .from('conversations')
      .update({ last_message: null })
      .eq('id', conversation_id);

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
