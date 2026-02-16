import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;
    const body = await req.json();
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Check if competition exists
    const { data: comp, error: compError } = await supabase
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

    // Check if deadline has passed
    if (comp.deadline) {
      const deadlineTime = Date.parse(comp.deadline);
      if (isFinite(deadlineTime) && deadlineTime < Date.now()) {
        return NextResponse.json({ error: 'Competition has ended' }, { status: 400 });
      }
    }

    // Check if user already joined
    const { data: existing } = await supabase
      .from('competition_entries')
      .select('submitted_by')
      .eq('competition_id', competitionId)
      .eq('submitted_by', userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Already joined', alreadyJoined: true }, { status: 409 });
    }

    // Insert entry record (project_id is nullable)
    const projectId = body.projectId || null;
    const { error: insertError } = await supabase
      .from('competition_entries')
      .insert({ competition_id: competitionId, submitted_by: userId, project_id: projectId });

    if (insertError) {
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
    const body = await req.json();
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Check if competition exists and hasn't ended
    const { data: comp, error: compError } = await supabase
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

    // Delete the entry
    const { error: deleteError } = await supabase
      .from('competition_entries')
      .delete()
      .eq('competition_id', competitionId)
      .eq('submitted_by', userId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
