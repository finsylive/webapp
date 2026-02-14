import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

type PlatformKey = 'github' | 'figma' | 'dribbble' | 'behance' | 'linkedin' | 'youtube' | 'notion' | 'substack' | 'custom';

type PlatformLinkRow = {
  portfolio_id: string;
  platform: PlatformKey;
  link?: string | null;
};

type Portfolio = {
  id: string;
  user_id: string;
  title?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
  platforms?: PlatformKey[];
  platforms_links?: PlatformLinkRow[];
};

// GET /api/users/[username]/portfolios
export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const supabase = await createAuthClient();
    const { username } = await params;
    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });

    // resolve user id
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', username)
      .maybeSingle();

    if (userError) console.warn('[portfolios API] user fetch error:', userError.message);
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // fetch portfolios for user
    const { data: portfolios, error: pfError } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userRow.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (pfError) {
      console.warn('[portfolios API] fetch error:', pfError.message);
      return NextResponse.json({ data: [] });
    }

    // Try to enrich with platforms from a related table if it exists
    let enriched: Portfolio[] = portfolios || [];
    try {
      const ids = (portfolios || []).map((p: Portfolio) => p.id).filter(Boolean);
      if (ids.length > 0) {
        const { data: platRows, error: platErr } = await supabase
          .from('portfolio_platforms')
          .select('portfolio_id, platform, link')
          .in('portfolio_id', ids);

        if (!platErr && platRows) {
          const byPid: Record<string, PlatformLinkRow[]> = {};
          for (const r of platRows as PlatformLinkRow[]) {
            const arr = byPid[r.portfolio_id] || (byPid[r.portfolio_id] = []);
            arr.push({ portfolio_id: r.portfolio_id, platform: r.platform, link: r.link });
          }
          enriched = enriched.map((p: Portfolio) => ({
            ...p,
            platforms: (byPid[p.id]?.map((x) => x.platform as PlatformKey) || null),
            platforms_links: (byPid[p.id] || null),
          }));
        }
      }
    } catch (e) {
      // If the relation/table doesn't exist, ignore and return base rows.
      console.warn('[portfolios API] platforms enrichment skipped:', e);
    }

    return NextResponse.json({ data: enriched });
  } catch (e) {
    console.error('Error in portfolios API:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/users/[username]/portfolios
// Upserts the user's latest portfolio and replaces its platforms
export async function POST(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const supabase = await createAuthClient();
    const { username } = await params;
    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === 'string' ? body.title : undefined;
    const description = typeof body?.description === 'string' ? body.description : undefined;
    const forceNew = Boolean(body?.forceNew);
    const platformsRaw = Array.isArray(body?.platforms) ? body.platforms : [];

    // resolve user id
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', username)
      .maybeSingle();
    if (userError) console.warn('[portfolios POST] user fetch error:', userError.message);
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // find latest portfolio or create one
    let portfolioId: string | undefined = undefined;
    if (!forceNew) {
      const { data: latest, error: latestErr } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', userRow.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestErr) console.warn('[portfolios POST] latest fetch error:', latestErr.message);
      portfolioId = latest?.id as string | undefined;
    }

    if (!portfolioId) {
      const { data: inserted, error: insErr } = await supabase
        .from('portfolios')
        .insert({ user_id: userRow.id, title: title ?? null, description: description ?? null })
        .select('*')
        .maybeSingle();
      if (insErr || !inserted) {
        const msg = insErr?.message || 'Failed to create portfolio';
        console.error('[portfolios POST] insert error:', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
      portfolioId = inserted.id as string;
    } else {
      // update existing
      const { error: updErr } = await supabase
        .from('portfolios')
        .update({
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
        })
        .eq('id', portfolioId);
      if (updErr) console.warn('[portfolios POST] update error:', updErr.message);
    }

    // normalize platforms
    const norm = (platformsRaw as unknown[]).map((p) => {
      if (typeof p === 'string') return { platform: p, link: null };
      if (p && typeof p === 'object') {
        const obj = p as Record<string, unknown>;
        return { platform: String(obj.platform || ''), link: obj.link ? String(obj.link) : null };
      }
      return null;
    }).filter(Boolean) as { platform: string; link: string | null }[];

    if (portfolioId && norm.length > 0) {
      // replace existing mapping: delete then insert
      const { error: delErr } = await supabase
        .from('portfolio_platforms')
        .delete()
        .eq('portfolio_id', portfolioId);
      if (delErr) console.warn('[portfolios POST] delete platforms error:', delErr.message);

      // ensure link protocol
      const rows = norm.map((x) => {
        let link = x.link ? x.link.trim() : null;
        if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
        return { portfolio_id: portfolioId!, platform: x.platform, link };
      });
      const { error: insPlatErr } = await supabase
        .from('portfolio_platforms')
        .insert(rows);
      if (insPlatErr) {
        console.warn('[portfolios POST] insert platforms error:', insPlatErr.message);
      }
    } else if (portfolioId) {
      // if empty array provided, clear existing
      const { error: delErr } = await supabase
        .from('portfolio_platforms')
        .delete()
        .eq('portfolio_id', portfolioId);
      if (delErr) console.warn('[portfolios POST] clear platforms error:', delErr.message);
    }

    return NextResponse.json({ success: true, portfolio_id: portfolioId });
  } catch (e) {
    console.error('Error in portfolios POST API:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/users/[username]/portfolios?id=PORTFOLIO_ID (optional id)
// Deletes the specified portfolio; if no id provided, deletes the latest for the user
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const supabase = await createAuthClient();
    const { username } = await params;
    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');

    // resolve user id
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', username)
      .maybeSingle();
    if (userError) console.warn('[portfolios DELETE] user fetch error:', userError.message);
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let portfolioId = idParam || undefined;
    if (!portfolioId) {
      const { data: latest, error: latestErr } = await supabase
        .from('portfolios')
        .select('id')
        .eq('user_id', userRow.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestErr) console.warn('[portfolios DELETE] latest fetch error:', latestErr.message);
      portfolioId = latest?.id as string | undefined;
    }

    if (!portfolioId) {
      return NextResponse.json({ error: 'No portfolio to delete' }, { status: 404 });
    }

    // delete platform links first (in case FK cascade is not set)
    const { error: delLinksErr } = await supabase
      .from('portfolio_platforms')
      .delete()
      .eq('portfolio_id', portfolioId);
    if (delLinksErr) {
      console.warn('[portfolios DELETE] delete links error:', delLinksErr.message);
    }

    // delete the portfolio
    const { error: delErr } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', portfolioId)
      .eq('user_id', userRow.id);
    if (delErr) {
      console.error('[portfolios DELETE] delete portfolio error:', delErr.message);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: portfolioId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete portfolio';
    console.error('[portfolios DELETE] unexpected error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
