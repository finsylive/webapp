import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAuthClient } from '@/utils/supabase-server';

/**
 * DELETE /api/users/account
 * Permanently soft-deletes the authenticated user's account.
 * - Calls soft_delete_user RPC (hashes PII, deletes messages)
 * - Removes the auth user via admin client
 */
export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createAuthClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const reason = body.reason || 'User requested permanent deletion';

        // Call the soft_delete_user RPC
        const { error: rpcError } = await supabase.rpc('soft_delete_user', {
            p_user_id: user.id,
            p_reason: reason,
        });

        if (rpcError) {
            console.error('soft_delete_user RPC error:', rpcError);
            return NextResponse.json(
                { error: rpcError.message || 'Failed to delete account' },
                { status: 500 }
            );
        }

        // Remove the auth user entirely (requires service role key)
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceKey) {
            try {
                const adminClient = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    serviceKey
                );
                await adminClient.auth.admin.deleteUser(user.id);
            } catch (adminErr) {
                // Log but don't fail — data is already scrubbed
                console.error('Failed to delete auth user (non-critical):', adminErr);
            }
        } else {
            console.warn('SUPABASE_SERVICE_ROLE_KEY not set — auth user not removed (data already scrubbed)');
        }

        // Sign out the current session
        await supabase.auth.signOut();

        return NextResponse.json({ success: true, message: 'Account permanently deleted' });
    } catch (error: unknown) {
        console.error('Delete account error:', error);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/**
 * PATCH /api/users/account
 * Handles deactivate and reactivate actions.
 * Body: { action: 'deactivate' | 'reactivate' }
 */
export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createAuthClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const body = await req.json();
        const { action } = body;

        if (!action || !['deactivate', 'reactivate'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid action. Must be "deactivate" or "reactivate".' },
                { status: 400 }
            );
        }

        if (action === 'deactivate') {
            const { error: rpcError } = await supabase.rpc('deactivate_user', {
                p_user_id: user.id,
            });

            if (rpcError) {
                console.error('deactivate_user RPC error:', rpcError);
                return NextResponse.json(
                    { error: rpcError.message || 'Failed to deactivate account' },
                    { status: 500 }
                );
            }

            // Sign out after deactivation
            await supabase.auth.signOut();

            return NextResponse.json({
                success: true,
                message: 'Account deactivated. You can reactivate anytime by signing in again.',
            });
        }

        if (action === 'reactivate') {
            const { error: rpcError } = await supabase.rpc('reactivate_user', {
                p_user_id: user.id,
            });

            if (rpcError) {
                console.error('reactivate_user RPC error:', rpcError);
                return NextResponse.json(
                    { error: rpcError.message || 'Failed to reactivate account' },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                message: 'Account reactivated successfully.',
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: unknown) {
        console.error('Account action error:', error);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
