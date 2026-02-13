import { NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Run all queries in parallel
    const [suggestedUsers, trendingPosts, recommendedJobs, recommendedGigs] = await Promise.all([
      // Suggested users: users the current user doesn't follow
      (async () => {
        const { data: followRows } = await supabase
          .from('user_follows')
          .select('followee_id')
          .eq('follower_id', userId);

        const followingIds = new Set((followRows || []).map(r => r.followee_id));
        followingIds.add(userId); // exclude self

        const { data: users } = await supabase
          .from('users')
          .select('id, username, full_name, avatar_url, tagline, is_verified')
          .order('is_verified', { ascending: false })
          .limit(40);

        if (!users) return [];

        return users
          .filter(u => !followingIds.has(u.id))
          .slice(0, 8);
      })(),

      // Trending posts: top 5 by like count from the last 7 days
      (async () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: recentPosts } = await supabase
          .from('posts')
          .select('id, content, created_at, author_id')
          .eq('deleted', false)
          .is('parent_post_id', null)
          .neq('author_id', userId)
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(100);

        if (!recentPosts || recentPosts.length === 0) return [];

        const postIds = recentPosts.map(p => p.id);
        const authorIds = [...new Set(recentPosts.map(p => p.author_id))];

        // Batch fetch likes and author info
        const [likesRes, authorsRes] = await Promise.all([
          supabase.from('post_likes').select('post_id').in('post_id', postIds),
          supabase.from('users').select('id, username, full_name, avatar_url').in('id', authorIds),
        ]);

        const likesMap = new Map<string, number>();
        likesRes.data?.forEach(l => {
          likesMap.set(l.post_id, (likesMap.get(l.post_id) || 0) + 1);
        });

        const authorsMap = new Map<string, { username: string; full_name: string; avatar_url: string | null }>();
        authorsRes.data?.forEach(a => {
          authorsMap.set(a.id, { username: a.username, full_name: a.full_name, avatar_url: a.avatar_url });
        });

        // Sort by like count descending and take top 5
        return recentPosts
          .map(p => ({
            id: p.id,
            content: p.content,
            created_at: p.created_at,
            likes: likesMap.get(p.id) || 0,
            author: authorsMap.get(p.author_id) || { username: 'unknown', full_name: 'Unknown', avatar_url: null },
          }))
          .sort((a, b) => b.likes - a.likes)
          .slice(0, 5);
      })(),
      // Recommended jobs: latest active jobs
      (async () => {
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id, title, company, location, salary_range, job_type, deadline')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(8);

        return jobs || [];
      })(),

      // Recommended gigs: latest active gigs
      (async () => {
        const { data: gigs } = await supabase
          .from('gigs')
          .select('id, title, description, budget, duration, skills_required, deadline')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(8);

        return gigs || [];
      })(),
    ]);

    return NextResponse.json({ suggestedUsers, trendingPosts, recommendedJobs, recommendedGigs });
  } catch (error) {
    console.error('Error in recommendations API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
