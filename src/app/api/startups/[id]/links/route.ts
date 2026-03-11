import { createAdminClient, createAuthClient } from '@/utils/supabase-server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_LINKS = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    const { data: startup } = await admin
      .from('startup_profiles')
      .select('is_published, owner_id')
      .eq('id', id)
      .single();

    if (!startup) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!startup.is_published) {
      let userId: string | undefined;
      try {
        const authClient = await createAuthClient();
        const { data: { user } } = await authClient.auth.getUser();
        userId = user?.id;
      } catch { /* not authenticated */ }

      if (userId !== startup.owner_id) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    const { data, error } = await admin
      .from('startup_links')
      .select('*')
      .eq('startup_id', id)
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: startup } = await admin
      .from('startup_profiles')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!startup || startup.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { links } = await request.json();
    const validLinks = (links || []).slice(0, MAX_LINKS);

    const { error: rpcError } = await admin.rpc('upsert_startup_links', {
      p_startup_id: id,
      p_links: JSON.stringify(validLinks.map((l: { title: string; url: string; icon_name?: string; display_order: number }) => ({
        title: l.title,
        url: l.url,
        icon_name: l.icon_name || null,
        display_order: l.display_order,
      }))),
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    const { data } = await admin
      .from('startup_links')
      .select('*')
      .eq('startup_id', id)
      .order('display_order', { ascending: true });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
