import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';
import type { AssignCategoryRequest } from '@/types/messaging';

// GET /api/conversation-categories?conversationId=... OR ?userId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const supabase = await createAuthClient();
  const conversationId = searchParams.get('conversationId');
  const userId = searchParams.get('userId');

  try {
    if (conversationId) {
      // Original behavior: Get categories for a specific conversation
      const { data, error } = await supabase
        .from('conversation_categories')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return NextResponse.json(data);
    } else if (userId) {
      // New behavior: Get all conversation-category mappings for a user
      const { data: mappings, error } = await supabase
        .from('conversation_categories')
        .select(`
          conversation_id,
          category_id,
          chat_categories!inner(
            user_id
          )
        `)
        .eq('chat_categories.user_id', userId);

      if (error) throw error;

      // Transform the data to include only the fields we need
      const result = mappings?.map(mapping => ({
        conversation_id: mapping.conversation_id,
        category_id: mapping.category_id
      })) || [];

      return NextResponse.json(result);
    } else {
      return NextResponse.json({ error: 'Missing conversationId or userId' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Error fetching conversation categories:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST /api/conversation-categories - Assign conversation to category
export async function POST(req: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const body: AssignCategoryRequest = await req.json();
    const { conversation_id, category_id } = body;

    // Get user from headers (set by middleware)
    const user_id = req.headers.get('x-user-id');

    if (!user_id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!conversation_id || !category_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify user owns the category
    const { data: category, error: categoryError } = await supabase
      .from('chat_categories')
      .select('*')
      .eq('id', category_id)
      .eq('user_id', user_id)
      .single();

    if (categoryError || !category) {
      return NextResponse.json({ error: 'Category not found or access denied' }, { status: 403 });
    }

    // Verify user has access to the conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .or(`user1_id.eq.${user_id},user2_id.eq.${user_id}`)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 403 });
    }

    // Check if already assigned (handle duplicate gracefully)
    const { data: existing } = await supabase
      .from('conversation_categories')
      .select('id')
      .eq('conversation_id', conversation_id)
      .eq('category_id', category_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        message: 'Conversation already assigned to category',
        id: existing.id
      });
    }

    // Insert the assignment
    const { data, error } = await supabase
      .from('conversation_categories')
      .insert({ conversation_id, category_id })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });

  } catch (error: unknown) {
    console.error('Error assigning category:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// PATCH /api/conversation-categories
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, category_id } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const supabase = await createAuthClient();
    const { data, error } = await supabase
      .from('conversation_categories')
      .update({ category_id })
      .eq('id', id)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/conversation-categories
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const user_id = req.headers.get('x-user-id');
    if (!user_id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { error } = await supabase
      .from('conversation_categories')
      .delete()
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
