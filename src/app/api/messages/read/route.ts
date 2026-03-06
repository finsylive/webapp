import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// PATCH /api/messages/read - Mark messages as read
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createAuthClient();

    // Verify session — always use session, never trust body user_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const user_id = user.id;

    const body = await req.json();
    const { conversation_id, message_ids } = body;

    if (!conversation_id) {
      return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
    }

    // Verify user has access to this conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .or(`user1_id.eq.${user_id},user2_id.eq.${user_id}`)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 403 });
    }

    let query = supabase
      .from('messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('conversation_id', conversation_id)
      .neq('sender_id', user_id) // Don't mark own messages as read
      .eq('is_read', false);

    // If specific message IDs provided, only mark those
    if (message_ids && Array.isArray(message_ids) && message_ids.length > 0) {
      query = query.in('id', message_ids);
    }

    const { data, error } = await query.select('id, is_read');

    if (error) {
      return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated_count: data?.length || 0,
      updated_messages: data
    });

  } catch (error: unknown) {
    console.error('Error marking messages as read:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// GET /api/messages/read - Get unread count for user
export async function GET(req: NextRequest) {
  try {
    const supabase = await createAuthClient();

    // Verify session — derive user_id from session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    // Accept userId param for compatibility but enforce it matches session
    const requestedUserId = searchParams.get('userId');
    if (requestedUserId && requestedUserId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const user_id = user.id;
    const conversation_id = searchParams.get('conversationId');

    if (conversation_id) {
      // Get unread count for specific conversation
      const { data, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .eq('conversation_id', conversation_id)
        .neq('sender_id', user_id)
        .eq('is_read', false);

      if (error) throw error;

      return NextResponse.json({
        conversation_id,
        unread_count: data?.length || 0
      });
    } else {
      // Get total unread count using the RPC function from documentation
      const { data, error } = await supabase.rpc('get_unread_message_count', {
        user_id: user_id
      });

      if (error) throw error;

      return NextResponse.json({
        total_unread_count: data || 0
      });
    }

  } catch (error: unknown) {
    console.error('Error getting unread count:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}