import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { 
  EnrichedConversation, 
  CreateConversationRequest, 
  CreateConversationResponse,
  ConversationSearchParams 
} from '@/types/messaging';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GET: List all conversations for a user with optimized query
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const categoryId = searchParams.get('categoryId');
  const hasUnread = searchParams.get('hasUnread') === 'true';
  const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null;
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    console.log('Fetching conversations for userId:', userId);
    
    // Get basic conversation data first
    const { data: conversationData, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('updated_at', { ascending: false })
      .limit(limit);

    console.log('Conversations query result:', { conversationData, error });

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    if (!conversationData || conversationData.length === 0) {
      console.log('No conversations found for user:', userId);
      return NextResponse.json([]);
    }

    // Get all unique user IDs from conversations
    const userIds = new Set<string>();
    conversationData.forEach(conv => {
      userIds.add(conv.user1_id);
      userIds.add(conv.user2_id);
    });

    // Fetch user details in a separate query
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, is_verified')
      .in('id', Array.from(userIds));

    if (usersError) throw usersError;

    // Create a map for quick user lookup
    const userMap = new Map();
    usersData?.forEach(user => {
      userMap.set(user.id, user);
    });

    // Transform to match expected format
    const conversations = conversationData.map(conv => {
      const isUser1 = conv.user1_id === userId;
      const otherUserId = isUser1 ? conv.user2_id : conv.user1_id;
      const otherUser = userMap.get(otherUserId) || {};
      const user1 = userMap.get(conv.user1_id) || {};
      const user2 = userMap.get(conv.user2_id) || {};
      
      return {
        conversation_id: conv.id,
        other_user_id: otherUserId,
        other_username: otherUser.username || '',
        other_full_name: otherUser.full_name || '',
        other_avatar_url: otherUser.avatar_url || null,
        other_is_verified: otherUser.is_verified || false,
        last_message: conv.last_message,
        updated_at: conv.updated_at,
        unread_count: 0, // TODO: Calculate unread count
        status: conv.status || 'approved',
        user1_id: conv.user1_id,
        user2_id: conv.user2_id,
        user1_username: user1.username,
        user2_username: user2.username,
        user1_full_name: user1.full_name,
        user2_full_name: user2.full_name,
        user1_avatar_url: user1.avatar_url,
        user2_avatar_url: user2.avatar_url,
        user1_is_verified: user1.is_verified,
        user2_is_verified: user2.is_verified
      };
    });

    return NextResponse.json(conversations);
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new conversation using safe function
export async function POST(req: NextRequest) {
  try {
    const body: CreateConversationRequest = await req.json();
    const { user1_id, user2_id, initial_message } = body;

    if (!user1_id || !user2_id) {
      return NextResponse.json({ error: 'Missing user1_id or user2_id' }, { status: 400 });
    }

    if (user1_id === user2_id) {
      return NextResponse.json({ error: 'Cannot create conversation with self' }, { status: 400 });
    }

    // Check if conversation already exists
    const { data: existing, error: existError } = await supabase
      .from('conversations')
      .select('id, status')
      .or(`and(user1_id.eq.${user1_id},user2_id.eq.${user2_id}),and(user1_id.eq.${user2_id},user2_id.eq.${user1_id})`)
      .maybeSingle();

    if (existError) throw existError;

    let conversation;
    let was_created = false;

    if (existing) {
      conversation = existing;
    } else {
      // Create new conversation
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          user1_id,
          user2_id,
          status: 'approved' // Default to approved for now
        })
        .select()
        .single();

      if (createError) throw createError;
      conversation = newConv;
      was_created = true;
    }

    let message = null;

    // Send initial message if provided
    if (initial_message && was_created) {
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user1_id,
          content: initial_message,
          is_read: false
        })
        .select()
        .single();

      if (!messageError) {
        message = messageData;
      }
    }

    const response: CreateConversationResponse = {
      conversation: {
        id: conversation.id,
        user1_id: conversation.user1_id,
        user2_id: conversation.user2_id,
        status: conversation.status,
        last_message: message?.content || null,
        created_at: conversation.created_at || new Date().toISOString(),
        updated_at: conversation.updated_at || new Date().toISOString()
      },
      message,
      was_created
    };

    return NextResponse.json(response, { 
      status: was_created ? 201 : 200 
    });

  } catch (error: any) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Update conversation (e.g., last_message, status)
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, last_message, status } = body;
  if (!id) {
    return NextResponse.json({ error: 'Missing conversation id' }, { status: 400 });
  }
  const updates: Partial<{ last_message: string; status: string | number; updated_at: string }> = {
    updated_at: new Date().toISOString(),
  };
  if (last_message !== undefined) updates.last_message = last_message;
  if (status !== undefined) updates.status = status;
  const { data, error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// DELETE: Remove a conversation by id
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing conversation id' }, { status: 400 });
  }
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
