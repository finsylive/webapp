import { createAdminClient, createAuthClient } from '@/utils/supabase-server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_SECTIONS = 20;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    // Check if startup exists and is published (or requester is owner)
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
      .from('startup_text_sections')
      .select('*')
      .eq('startup_id', id)
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching text sections:', error);
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

    // Verify ownership
    const { data: startup } = await admin
      .from('startup_profiles')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!startup || startup.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { sections } = await request.json();
    const validSections = (sections || []).slice(0, MAX_SECTIONS);

    // Atomic upsert via Postgres function (delete + insert in one transaction)
    const { error: rpcError } = await admin.rpc('upsert_startup_text_sections', {
      p_startup_id: id,
      p_sections: JSON.stringify(validSections.map((s: { heading: string; content: string; display_order: number }) => ({
        heading: s.heading,
        content: s.content,
        display_order: s.display_order,
      }))),
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    const { data } = await admin
      .from('startup_text_sections')
      .select('*')
      .eq('startup_id', id)
      .order('display_order', { ascending: true });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating text sections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
