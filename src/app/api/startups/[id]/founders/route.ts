import { createAuthClient } from '@/utils/supabase-server';
import { NextResponse } from 'next/server';
import { sendCofounderInviteEmail } from '@/utils/cofounder-invite-email';

export const dynamic = 'force-dynamic';

// GET — founders list is public (shown on startup profiles)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createAuthClient();
    const { data, error } = await supabase
      .from('startup_founders')
      .select('*')
      .eq('startup_id', id)
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching founders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Auth check using the user's session cookies
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client for all DB operations (bypasses RLS so we can send notifications to other users)
    const supabase = await createAuthClient();

    // Enforce ownership — only the startup owner may manage the founders list
    const { data: startup } = await supabase
      .from('startup_profiles')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!startup) {
      return NextResponse.json({ error: 'Startup not found' }, { status: 404 });
    }
    if (startup.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { founders, startupName } = await request.json();

    // Fetch actor's name for invite emails
    const { data: actorRow } = await supabase
      .from('users')
      .select('full_name, username')
      .eq('id', user.id)
      .maybeSingle();
    const inviterName = actorRow?.full_name || actorRow?.username || 'Someone';

    // Get existing founders to preserve accepted statuses and already-invited emails
    const { data: existing } = await supabase
      .from('startup_founders')
      .select('user_id, email, status')
      .eq('startup_id', id);

    const acceptedUserIds = new Set(
      (existing || [])
        .filter((f: { user_id: string | null; status: string }) => f.user_id && f.status === 'accepted')
        .map((f: { user_id: string | null }) => f.user_id)
    );

    // Track emails that were already invited so we don't spam
    const alreadyInvitedEmails = new Set(
      (existing || [])
        .filter((f: { email: string | null; user_id: string | null }) => f.email && !f.user_id)
        .map((f: { email: string | null }) => f.email as string)
    );

    // Delete existing founders and re-insert
    const { error: deleteError } = await supabase
      .from('startup_founders')
      .delete()
      .eq('startup_id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (!founders || founders.length === 0) {
      return NextResponse.json({ success: true });
    }

    // For founders with email but no user_id, check if they're already on Ments
    // Query the users table directly by email — O(1) vs listing all 10k auth users
    const emailFounders: { email: string }[] = founders.filter(
      (f: { user_id?: string | null; email?: string | null }) => !f.user_id && f.email
    );

    const emailToUserId: Record<string, { id: string; username: string }> = {};
    if (emailFounders.length > 0) {
      try {
        const emailList = emailFounders.map(f => f.email);
        // Direct table lookup is far more efficient than auth.admin.listUsers(perPage:10000)
        const { data: ments_users } = await supabase
          .from('users')
          .select('id, username, email')
          .in('email', emailList)
          .eq('account_status', 'active');

        for (const mu of (ments_users || [])) {
          if (mu.email) {
            emailToUserId[mu.email] = { id: mu.id, username: mu.username };
          }
        }
      } catch {
        // non-critical, continue without auto-linking
      }
    }

    const rows = founders.map((f: {
      name: string;
      role?: string | null;
      avatar_url?: string | null;
      email?: string | null;
      user_id?: string | null;
      ments_username?: string | null;
      display_order: number;
    }) => {
      // Auto-link if we found a Ments user for this email
      const resolvedUser = (!f.user_id && f.email) ? emailToUserId[f.email] : null;
      const userId = f.user_id || resolvedUser?.id || null;
      const mentsUsername = f.ments_username || resolvedUser?.username || null;

      return {
        startup_id: id,
        name: f.name,
        role: f.role || null,
        email: (!userId && f.email) ? f.email : null, // only store email for non-Ments founders
        user_id: userId,
        ments_username: mentsUsername,
        avatar_url: f.avatar_url || null,
        display_order: f.display_order,
        status: userId
          ? acceptedUserIds.has(userId) ? 'accepted' : 'pending'
          : 'accepted',
      };
    });

    const { data: inserted, error: insertError } = await supabase
      .from('startup_founders')
      .insert(rows)
      .select('id, user_id, email, name, status');

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Send in-app notifications for newly pending Ments founders
    const pendingFounders = (inserted || []).filter(
      (f: { id: string; user_id: string | null; name: string; status: string }) => f.status === 'pending' && f.user_id
    );

    if (pendingFounders.length > 0) {
      const notifInserts = pendingFounders.map((f: { id: string; user_id: string; name: string }) => ({
        recipient_id: f.user_id,
        type: 'cofounder_request',
        content: `You've been added as a co-founder of ${startupName || 'a startup'}`,
        is_read: false,
        actor_id: user.id,
        extra: {
          startup_id: id,
          startup_name: startupName || '',
          requester_id: user.id,
          founder_id: f.id,
          founder_name: f.name,
        },
      }));
      const { error: notifError } = await supabase.from('inapp_notification').insert(notifInserts);
      if (notifError) {
        console.error('Failed to insert cofounder notifications:', notifError.message);
      }
    }

    // Send invite emails to new non-Ments founders (skip already-invited emails)
    const inviteFounders = (inserted || []).filter(
      (f: { email: string | null; user_id: string | null }) => f.email && !f.user_id
    );

    for (const f of inviteFounders) {
      if (alreadyInvitedEmails.has(f.email)) continue; // don't re-invite
      try {
        await sendCofounderInviteEmail({
          toEmail: f.email,
          startupName: startupName || 'a startup',
          inviterName,
        });
      } catch (emailErr) {
        console.error(`Failed to send invite email to ${f.email}:`, emailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating founders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
