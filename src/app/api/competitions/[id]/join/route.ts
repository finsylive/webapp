import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;

    // Always derive userId from the verified session — never trust the request body
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = user.id;

    const admin = await createAuthClient();

    // Check if competition exists and hasn't ended
    const { data: comp, error: compError } = await admin
      .from('competitions')
      .select('id, deadline')
      .eq('id', competitionId)
      .maybeSingle();

    if (compError) {
      return NextResponse.json({ error: compError.message }, { status: 500 });
    }
    if (!comp) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    if (comp.deadline) {
      const deadlineTime = Date.parse(comp.deadline);
      if (isFinite(deadlineTime) && deadlineTime < Date.now()) {
        return NextResponse.json({ error: 'Competition has ended' }, { status: 400 });
      }
    }

    // Read optional projectId from body (safe — userId comes from session not body)
    let projectId: string | null = null;
    try {
      const body = await req.json();
      projectId = body?.projectId ?? null;
    } catch {
      // body is optional
    }

    // Insert entry record — rely on the unique constraint to detect duplicates atomically
    const { error: insertError } = await admin
      .from('competition_entries')
      .insert({ competition_id: competitionId, submitted_by: userId, project_id: projectId });

    if (insertError) {
      // Unique constraint violation → already joined
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Already joined', alreadyJoined: true }, { status: 409 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;

    // Derive userId from the verified session
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const admin = await createAuthClient();

    // Check if competition exists and hasn't ended
    const { data: comp, error: compError } = await admin
      .from('competitions')
      .select('id, deadline')
      .eq('id', competitionId)
      .maybeSingle();

    if (compError) {
      return NextResponse.json({ error: compError.message }, { status: 500 });
    }
    if (!comp) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    if (comp.deadline) {
      const deadlineTime = Date.parse(comp.deadline);
      if (isFinite(deadlineTime) && deadlineTime < Date.now()) {
        return NextResponse.json({ error: 'Competition has ended' }, { status: 400 });
      }
    }

    const { error: deleteError } = await admin
      .from('competition_entries')
      .delete()
      .eq('competition_id', competitionId)
      .eq('submitted_by', user.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
