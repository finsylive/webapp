import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';
import type {
  Message,
  SendMessageRequest,
  SendMessageResponse,
  PaginatedMessages
} from '@/types/messaging';

// GET /api/messages - Fetch messages for a conversation with pagination
export async function GET(req: NextRequest) {
  const supabase = await createAuthClient();
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');
  const limit = parseInt(searchParams.get('limit') || '20');
  const beforeMessageId = searchParams.get('beforeMessageId');
  const afterMessageId = searchParams.get('afterMessageId');

  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
  }

  try {
    // Get the current user to determine their cleared_at timestamp
    const { data: { user } } = await supabase.auth.getUser();
    let clearedAt: string | null = null;

    if (user) {
      const { data: convo } = await supabase
        .from('conversations')
        .select('user1_id, user2_id, user1_cleared_at, user2_cleared_at')
        .eq('id', conversationId)
        .single();

      if (convo) {
        clearedAt = convo.user1_id === user.id
          ? convo.user1_cleared_at
          : convo.user2_cleared_at;
      }
    }

    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // Fetch one extra to check if there are more

    // Filter out messages before the user's cleared_at timestamp
    if (clearedAt) {
      query = query.gt('created_at', clearedAt);
    }

    // Handle pagination
    if (beforeMessageId) {
      const { data: beforeMessage } = await supabase
        .from('messages')
        .select('created_at')
        .eq('id', beforeMessageId)
        .single();

      if (beforeMessage) {
        query = query.lt('created_at', beforeMessage.created_at);
      }
    }

    if (afterMessageId) {
      const { data: afterMessage } = await supabase
        .from('messages')
        .select('created_at')
        .eq('id', afterMessageId)
        .single();

      if (afterMessage) {
        query = query.gt('created_at', afterMessage.created_at);
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    const messages = data || [];
    const hasMore = messages.length > limit;

    // Remove the extra message if we fetched limit + 1
    if (hasMore) {
      messages.pop();
    }

    // Get unique sender IDs and reply-to IDs
    const senderIds = [...new Set(messages.map((m: { sender_id: string }) => m.sender_id).filter(Boolean))];
    const replyToIds = [...new Set(messages.map((m: { reply_to_id: string | null }) => m.reply_to_id).filter(Boolean))];

    // Fetch sender details
    const { data: senders } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, is_verified')
      .in('id', senderIds);

    // Fetch reply-to messages
    const { data: replyToMessages } = await supabase
      .from('messages')
      .select('id, content, sender_id, created_at')
      .in('id', replyToIds);

    // Create lookup maps
    const senderMap = new Map(senders?.map((s: { id: string; username: string; full_name: string; avatar_url: string | null; is_verified: boolean }) => [s.id, s]) || []);
    const replyToMap = new Map(replyToMessages?.map((r: { id: string; content: string; sender_id: string; created_at: string }) => [r.id, r]) || []);

    // Attach sender and reply_to data to messages
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedMessages = messages.map((msg: any) => ({
      ...msg,
      sender: senderMap.get(msg.sender_id) || null,
      reply_to: msg.reply_to_id ? replyToMap.get(msg.reply_to_id) || null : null
    }));

    // Reverse to get chronological order (oldest first)
    enrichedMessages.reverse();

    const response: PaginatedMessages = {
      messages: enrichedMessages as Message[],
      has_more: hasMore,
      next_cursor: hasMore ? enrichedMessages[enrichedMessages.length - 1]?.id : undefined,
      prev_cursor: enrichedMessages.length > 0 ? enrichedMessages[0]?.id : undefined
    };

    return NextResponse.json(response);

  } catch (error: unknown) {
    console.error('Error fetching messages:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// DELETE /api/messages/reactions - remove a reaction
export async function DELETE(req: NextRequest) {
  const supabase = await createAuthClient();
  const url = new URL(req.url);
  if (url.pathname.endsWith('/reactions')) {
    try {
      const { message_id, user_id } = await req.json();
      if (!message_id || !user_id) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', message_id)
        .eq('user_id', user_id);
      if (error) return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
      return NextResponse.json({ success: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });
}

// POST /api/messages - create a new message with enhanced features
export async function POST(req: NextRequest) {
  const supabase = await createAuthClient();
  const url = new URL(req.url);

  // Handle reactions: POST /api/messages/reactions
  if (url.pathname.endsWith('/reactions')) {
    try {
      const body = await req.json();
      const { message_id, user_id, reaction } = body;
      if (!message_id || !user_id || !reaction) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('message_reactions')
        .upsert([{ message_id, user_id, reaction }], { onConflict: 'user_id,message_id' })
        .select();
      if (error) return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
      return NextResponse.json(data && data[0] ? data[0] : null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Internal server error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  try {
    // Verify authentication from session (not headers)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const sender_id = user.id;

    const body: SendMessageRequest = await req.json();
    const {
      conversation_id,
      content,
      reply_to_id,
      media_url
    } = body;

    if (!conversation_id || !content) {
      console.error('Missing required fields:', { conversation_id, content: !!content });
      return NextResponse.json({
        error: 'Missing required fields',
        details: { conversation_id: !!conversation_id, content: !!content }
      }, { status: 400 });
    }

    // Verify user has access to this conversation
    // auth.uid() is set from the session, so RLS will allow the row if user is a participant
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .maybeSingle();

    if (convError) {
      console.error('Conversation query error:', convError);
      return NextResponse.json({
        error: 'Failed to verify conversation access',
        details: convError.message
      }, { status: 500 });
    }

    if (!conversation) {
      return NextResponse.json({
        error: 'Conversation not found or access denied'
      }, { status: 403 });
    }

    // Check if conversation is approved (for chat request system)
    if (conversation.status === 'rejected') {
      return NextResponse.json({ error: 'Cannot send message to rejected conversation' }, { status: 403 });
    }

    // Insert message
    const { data: messageData, error } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        sender_id,
        content,
        reply_to_id,
        media_url,
        is_read: false
      })
      .select('*')
      .single();

    if (error) {
      console.error('Message insert error:', error);
      return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
    }

    // Fetch sender details
    const { data: sender } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, is_verified')
      .eq('id', sender_id)
      .single();

    // Fetch reply-to message if exists
    let replyToMessage = null;
    if (reply_to_id) {
      const { data: replyTo } = await supabase
        .from('messages')
        .select('id, content, sender_id, created_at')
        .eq('id', reply_to_id)
        .single();
      replyToMessage = replyTo;
    }

    // Enrich the message with sender and reply_to data
    const enrichedMessage = {
      ...messageData,
      sender: sender || null,
      reply_to: replyToMessage
    };

    // Auto-approve conversation if it's pending and this is the first message
    if (conversation.status === 'pending') {
      await supabase
        .from('conversations')
        .update({ status: 'approved' })
        .eq('id', conversation_id);
    }

    const response: SendMessageResponse = {
      message: enrichedMessage as Message
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error: unknown) {
    console.error('Error sending message:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
