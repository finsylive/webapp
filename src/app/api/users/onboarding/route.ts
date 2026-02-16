import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// PATCH /api/users/onboarding — Update user role, onboarding step, or mark onboarding complete
export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createAuthClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const body = await req.json();
        const { user_type, onboarding_step, is_onboarding_done, profile_updates } = body;

        // Build the update object
        const updates: Record<string, unknown> = {};

        if (user_type && ['normal_user', 'founder', 'investor'].includes(user_type)) {
            updates.user_type = user_type;
        }

        if (typeof onboarding_step === 'number') {
            updates.onboarding_step = onboarding_step;
        }

        if (typeof is_onboarding_done === 'boolean') {
            updates.is_onboarding_done = is_onboarding_done;
        }

        // Allow updating basic profile fields during onboarding
        if (profile_updates && typeof profile_updates === 'object') {
            const allowedFields = ['full_name', 'username', 'tagline', 'about', 'current_city', 'avatar_url'];
            for (const field of allowedFields) {
                if (field in profile_updates) {
                    updates[field] = profile_updates[field];
                }
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', user.id)
            .select('id, user_type, is_onboarding_done, onboarding_step, username, full_name, tagline, about, current_city, avatar_url')
            .single();

        if (error) {
            console.error('Error updating onboarding:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Onboarding update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET /api/users/onboarding — Get current onboarding status
export async function GET() {
    try {
        const supabase = await createAuthClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('users')
            .select('id, user_type, is_onboarding_done, onboarding_step, username, full_name, tagline, about, current_city, avatar_url')
            .eq('id', user.id)
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
