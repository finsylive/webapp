import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// PATCH /api/messages/read - Mark messages as read
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversation_id, message_ids } = body;
    
    // Get user from headers (set by middleware) or body (fallback)
    let user_id = req.headers.get('x-user-id');
    if (!user_id && body.user_id) {
      user_id = body.user_id; // Fallback for backward compatibility
    }
    
    if (!user_id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

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
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get('userId');
    const conversation_id = searchParams.get('conversationId');

    if (!user_id) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

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