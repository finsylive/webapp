import { createAuthClient } from '@/utils/supabase-server';
import { NextResponse } from 'next/server';
import { recordView } from '@/api/startups';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await recordView(id, user?.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording view:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
