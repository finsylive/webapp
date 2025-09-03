import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { 
  ChatCategory, 
  CreateCategoryRequest, 
  CreateCategoryResponse 
} from '@/types/messaging';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/chat-categories?userId=... - Get categories with unread counts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    // Get categories
    const { data: categories, error } = await supabase
      .from('chat_categories')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;

    // Enhance categories with conversation counts and unread counts
    const enhancedCategories = await Promise.all(
      categories.map(async (category) => {
        // Get conversations in this category
        const { data: categoryConversations } = await supabase
          .from('conversation_categories')
          .select('conversation_id')
          .eq('category_id', category.id);

        const conversationIds = categoryConversations?.map(cc => cc.conversation_id) || [];

        let unreadCount = 0;
        if (conversationIds.length > 0) {
          // Get unread messages for conversations in this category
          const { data: unreadMessages } = await supabase
            .from('messages')
            .select('id', { count: 'exact' })
            .in('conversation_id', conversationIds)
            .neq('sender_id', userId)
            .eq('is_read', false);

          unreadCount = unreadMessages?.length || 0;
        }

        const enhancedCategory: ChatCategory = {
          ...category,
          conversation_ids: conversationIds,
          unread_count: unreadCount
        };

        return enhancedCategory;
      })
    );

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
    const body: CreateCategoryRequest = await req.json();
    const { name, color } = body;
    
    // Get user from headers (set by middleware) or body (fallback)
    let user_id = req.headers.get('x-user-id');
    if (!user_id && body.user_id) {
      user_id = body.user_id; // Fallback for backward compatibility
    }
    
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
      .select('*')
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
    const body = await req.json();
    const { id, name, color } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { data, error } = await supabase
      .from('chat_categories')
      .update({ name, color })
      .eq('id', id)
      .select('*')
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
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { error } = await supabase
      .from('chat_categories')
      .delete()
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}