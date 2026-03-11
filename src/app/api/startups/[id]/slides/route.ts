import { createAdminClient, createAuthClient } from '@/utils/supabase-server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_SLIDES = 50;

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
      .from('startup_slides')
      .select('*')
      .eq('startup_id', id)
      .order('slide_number', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching slides:', error);
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

    const { slides } = await request.json();
    const validSlides = (slides || []).slice(0, MAX_SLIDES);

    const { error: rpcError } = await admin.rpc('upsert_startup_slides', {
      p_startup_id: id,
      p_slides: JSON.stringify(validSlides.map((s: { slide_url: string; caption?: string; slide_number: number }) => ({
        slide_url: s.slide_url,
        caption: s.caption || null,
        slide_number: s.slide_number,
      }))),
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    const { data } = await admin
      .from('startup_slides')
      .select('*')
      .eq('startup_id', id)
      .order('slide_number', { ascending: true });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating slides:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
