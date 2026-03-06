import { NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const admin = await createAuthClient();

    // Fetch aggregated daily analytics
    const { data: dailyAnalytics } = await admin
      .from('feed_analytics_daily')
      .select('*')
      .gte('date', since.split('T')[0])
      .order('date', { ascending: true });

    // Fetch real-time summary from feed_events
    const [impressionsResult, engagementsResult, dwellResult, usersResult] = await Promise.all([
      admin
        .from('feed_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'impression')
        .gte('created_at', since),
      admin
        .from('feed_events')
        .select('id', { count: 'exact', head: true })
        .in('event_type', ['like', 'reply', 'share', 'bookmark', 'click'])
        .gte('created_at', since),
      admin
        .from('feed_events')
        .select('metadata')
        .eq('event_type', 'dwell')
        .gte('created_at', since)
        .limit(1000),
      admin
        .from('feed_events')
        .select('user_id')
        .gte('created_at', since)
        .limit(10000),
    ]);

    const totalImpressions = impressionsResult.count || 0;
    const totalEngagements = engagementsResult.count || 0;
    const engagementRate = totalImpressions > 0 ? totalEngagements / totalImpressions : 0;

    const dwellValues = (dwellResult.data || [])
      .map((e: { metadata: Record<string, unknown> }) => Number(e.metadata?.dwell_ms) || 0)
      .filter((v: number) => v > 0);
    const avgDwell = dwellValues.length > 0
      ? dwellValues.reduce((a: number, b: number) => a + b, 0) / dwellValues.length
      : 0;

    const uniqueUsers = new Set(
      (usersResult.data || []).map((e: { user_id: string }) => e.user_id)
    ).size;

    // Top performing posts
    const { data: topPosts } = await admin
      .from('post_features')
      .select('post_id, engagement_score')
      .order('engagement_score', { ascending: false })
      .limit(10);

    return NextResponse.json({
      summary: {
        total_impressions: totalImpressions,
        total_engagements: totalEngagements,
        engagement_rate: Math.round(engagementRate * 10000) / 100,
        avg_dwell_ms: Math.round(avgDwell),
        unique_users: uniqueUsers,
      },
      daily: dailyAnalytics || [],
      top_posts: topPosts || [],
    });
  } catch (error) {
    console.error('Error in feed analytics API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
