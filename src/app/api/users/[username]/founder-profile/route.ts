import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// GET /api/users/[username]/founder-profile
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await params;
        const supabase = await createAuthClient();

        // Look up user by username
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { data, error } = await supabase
            .from('founder_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error) {
            return NextResponse.json({ error: 'Founder profile not found' }, { status: 404 });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/users/[username]/founder-profile — Create founder profile
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await params;
        const supabase = await createAuthClient();

        // Verify the authenticated user owns this username
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { data: dbUser, error: userError } = await supabase
            .from('users')
            .select('id, username')
            .eq('username', username)
            .single();

        if (userError || !dbUser || dbUser.id !== authUser.id) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }

        const body = await req.json();
        const {
            company_name, industry, stage, team_size, pitch,
            looking_for, website, linkedin, location,
            is_actively_raising, raise_amount
        } = body;

        const { data, error } = await supabase
            .from('founder_profiles')
            .upsert({
                user_id: authUser.id,
                company_name: company_name || null,
                industry: industry || null,
                stage: stage || null,
                team_size: team_size || null,
                pitch: pitch || null,
                looking_for: looking_for || [],
                website: website || null,
                linkedin: linkedin || null,
                location: location || null,
                is_actively_raising: is_actively_raising || false,
                raise_amount: raise_amount || null,
            }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) {
            console.error('Error creating founder profile:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Founder profile error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT /api/users/[username]/founder-profile — Update founder profile
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await params;
        const supabase = await createAuthClient();

        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { data: dbUser } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (!dbUser || dbUser.id !== authUser.id) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }

        const body = await req.json();
        const updates: Record<string, unknown> = {};
        const allowedFields = [
            'company_name', 'industry', 'stage', 'team_size', 'pitch',
            'looking_for', 'website', 'linkedin', 'location',
            'is_actively_raising', 'raise_amount'
        ];

        for (const field of allowedFields) {
            if (field in body) {
                updates[field] = body[field];
            }
        }

        const { data, error } = await supabase
            .from('founder_profiles')
            .update(updates)
            .eq('user_id', authUser.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
