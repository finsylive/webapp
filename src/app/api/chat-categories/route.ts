import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';
import type {
  ChatCategory,
  CreateCategoryRequest,
  CreateCategoryResponse
} from '@/types/messaging';

// GET /api/chat-categories?userId=... - Get categories with unread counts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    const supabase = await createAuthClient();

    // Get categories
    const { data: categories, error } = await supabase
      .from('chat_categories')
      .select('id, user_id, name, color, created_at, updated_at')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;

    if (!categories || categories.length === 0) {
      return NextResponse.json([]);
    }

    // Batch: get ALL conversation-category mappings for this user's categories
    const categoryIds = categories.map(c => c.id);
    const { data: allMappings } = await supabase
      .from('conversation_categories')
      .select('category_id, conversation_id')
      .in('category_id', categoryIds);

    // Build category -> conversationIds map
    const catConvMap = new Map<string, string[]>();
    for (const m of (allMappings || [])) {
      const arr = catConvMap.get(m.category_id) || [];
      arr.push(m.conversation_id);
      catConvMap.set(m.category_id, arr);
    }

    // Batch: get unread counts for ALL conversations across all categories
    const allConvIds = [...new Set((allMappings || []).map(m => m.conversation_id))];
    const unreadByConv = new Map<string, number>();
    if (allConvIds.length > 0) {
      const { data: unreadMessages } = await supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', allConvIds)
        .neq('sender_id', userId)
        .eq('is_read', false);

      for (const msg of (unreadMessages || [])) {
        unreadByConv.set(msg.conversation_id, (unreadByConv.get(msg.conversation_id) || 0) + 1);
      }
    }

    // Assemble enhanced categories — no extra queries needed
    const enhancedCategories: ChatCategory[] = categories.map(category => {
      const conversationIds = catConvMap.get(category.id) || [];
      const unreadCount = conversationIds.reduce((sum, cid) => sum + (unreadByConv.get(cid) || 0), 0);
      return {
        ...category,
        conversation_ids: conversationIds,
        unread_count: unreadCount
      };
    });

    return NextResponse.json(enhancedCategories);
  } catch (error: unknown) {
    console.error('Error fetching categories:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST /api/chat-categories
export async function POST(req: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const body: CreateCategoryRequest = await req.json();
    const { name, color } = body;

    const user_id = req.headers.get('x-user-id');
    if (!user_id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!name) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 });
    }

    // Check if category name already exists for this user
    const { data: existing } = await supabase
      .from('chat_categories')
      .select('id')
      .eq('user_id', user_id)
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('chat_categories')
      .insert({
        user_id,
        name: name.trim(),
        color: color || null
      })
      .select('id, user_id, name, color, created_at, updated_at')
      .single();

    if (error) throw error;

    const response: CreateCategoryResponse = {
      category: {
        ...data,
        conversation_ids: [],
        unread_count: 0
      } as ChatCategory
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating category:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// PATCH /api/chat-categories
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const body = await req.json();
    const { id, name, color } = body;
    const user_id = req.headers.get('x-user-id');
    if (!user_id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { data, error } = await supabase
      .from('chat_categories')
      .update({ name, color })
      .eq('id', id)
      .eq('user_id', user_id)
      .select('id, user_id, name, color, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// DELETE /api/chat-categories
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const user_id = req.headers.get('x-user-id');
    if (!user_id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { error } = await supabase
      .from('chat_categories')
      .delete()
      .eq('id', id)
      .eq('user_id', user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}