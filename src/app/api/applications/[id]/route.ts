import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase-server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('applications')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch application' }, { status: 500 });
  }
}
