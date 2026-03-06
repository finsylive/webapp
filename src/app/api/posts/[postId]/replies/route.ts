import { NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

export async function GET(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const supabase = await createAuthClient();
    const { postId } = await params;

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        author:author_id!inner(id, username, avatar_url, full_name, is_verified, account_status),
        media:post_media(*)
      `)
      .eq('parent_post_id', postId)
      .eq('author.account_status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data || [];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    // Helper to normalize avatar URLs (handle storage paths)
    const toPublicUrl = (u?: string | null): string | null => {
      if (!u) return null;
      if (/^https?:\/\//i.test(u)) return u;
      if (/^s3:\/\//i.test(u)) return u; // let edge proxy handle s3 scheme
      if (!supabaseUrl) return u; // fallback raw
      return `${supabaseUrl}/storage/v1/object/public/${u.replace(/^\//, '')}`;
    };

    // Normalize avatar URLs for authors
    for (const r of rows as Array<{ author?: { avatar_url?: string | null } }>) {
      if (r.author) {
        r.author.avatar_url = toPublicUrl(r.author.avatar_url);
      }
    }

    return NextResponse.json(rows, { status: 200 });
  } catch (e: unknown) {
    const error = e as Error | undefined;
    return NextResponse.json({ error: error?.message || 'Failed to fetch replies' }, { status: 500 });
  }
}
