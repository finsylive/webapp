import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// GET /api/users/[username]/investor-profile
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await params;
        const supabase = await createAuthClient();

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { data, error } = await supabase
            .from('investor_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error) {
            return NextResponse.json({ error: 'Investor profile not found' }, { status: 404 });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/users/[username]/investor-profile — Create investor profile
export async function POST(
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
            firm_name, investor_type, check_size_min, check_size_max,
            preferred_stages, preferred_sectors, portfolio_count, thesis,
            linkedin, website, location, is_actively_investing
        } = body;

        const { data, error } = await supabase
            .from('investor_profiles')
            .upsert({
                user_id: authUser.id,
                firm_name: firm_name || null,
                investor_type: investor_type || null,
                check_size_min: check_size_min || null,
                check_size_max: check_size_max || null,
                preferred_stages: preferred_stages || [],
                preferred_sectors: preferred_sectors || [],
                portfolio_count: typeof portfolio_count === 'number' ? portfolio_count : 0,
                thesis: thesis || null,
                linkedin: linkedin || null,
                website: website || null,
                location: location || null,
                is_actively_investing: typeof is_actively_investing === 'boolean' ? is_actively_investing : true,
            }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) {
            console.error('Error creating investor profile:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Investor profile error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT /api/users/[username]/investor-profile — Update investor profile
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
            'firm_name', 'investor_type', 'check_size_min', 'check_size_max',
            'preferred_stages', 'preferred_sectors', 'portfolio_count', 'thesis',
            'linkedin', 'website', 'location', 'is_actively_investing'
        ];

        for (const field of allowedFields) {
            if (field in body) {
                updates[field] = body[field];
            }
        }

        const { data, error } = await supabase
            .from('investor_profiles')
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
