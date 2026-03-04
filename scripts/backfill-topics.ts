/**
 * Backfill content_embeddings for existing posts that don't have topic tags.
 * Uses the same keyword extraction logic as the feed engine (no API cost).
 *
 * Run with: npx tsx scripts/backfill-topics.ts
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ---- Keyword extraction logic (same as topic-extractor.ts) ----

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or',
  'if', 'while', 'about', 'up', 'it', 'its', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him',
  'his', 'she', 'her', 'they', 'them', 'their', 'what', 'which', 'who',
]);

const TOPIC_MAP: Record<string, string[]> = {
  technology: ['tech', 'software', 'code', 'programming', 'developer', 'engineering', 'build', 'app'],
  ai: ['artificial', 'intelligence', 'machine', 'learning', 'model', 'neural', 'deep', 'chatgpt', 'llm'],
  startups: ['startup', 'founder', 'venture', 'seed', 'series', 'pitch', 'launch', 'mvp', 'scale'],
  design: ['design', 'ux', 'ui', 'figma', 'prototype', 'user', 'interface', 'creative'],
  career: ['career', 'job', 'hiring', 'interview', 'resume', 'skills', 'work', 'role', 'position'],
  funding: ['funding', 'investment', 'investor', 'raise', 'round', 'capital', 'valuation'],
  product: ['product', 'feature', 'release', 'roadmap', 'feedback', 'user', 'customer'],
  community: ['community', 'team', 'collaborate', 'together', 'network', 'connect', 'event'],
};

function extractKeywords(content: string): { topics: string[]; keywords: string[] } {
  const text = content.toLowerCase();

  const words = text
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));

  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  const topics: string[] = [];
  for (const [topic, triggers] of Object.entries(TOPIC_MAP)) {
    if (triggers.some((t) => text.includes(t))) {
      topics.push(topic);
    }
  }
  if (topics.length === 0) topics.push('general');

  return { topics: topics.slice(0, 5), keywords: keywords.slice(0, 10) };
}

// ---- Main backfill logic ----

async function backfill() {
  console.log('Fetching posts without embeddings...');

  // Get all non-deleted posts with content
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('id, content')
    .eq('deleted', false)
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (postsError) {
    console.error('Error fetching posts:', postsError);
    process.exit(1);
  }

  if (!posts || posts.length === 0) {
    console.log('No posts found.');
    return;
  }

  // Check which already have embeddings
  const { data: existing } = await supabase
    .from('content_embeddings')
    .select('post_id')
    .in('post_id', posts.map((p) => p.id));

  const existingIds = new Set((existing || []).map((e) => e.post_id));
  const toProcess = posts.filter((p) => !existingIds.has(p.id) && p.content);

  console.log(`Found ${posts.length} total posts, ${existingIds.size} already have embeddings.`);
  console.log(`Processing ${toProcess.length} posts...`);

  let success = 0;
  let skipped = 0;

  for (const post of toProcess) {
    const { topics, keywords } = extractKeywords(post.content);

    if (topics.length === 0 && keywords.length === 0) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from('content_embeddings').upsert(
      {
        post_id: post.id,
        topics,
        keywords,
        sentiment: 0,
        language: 'en',
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'post_id' }
    );

    if (error) {
      console.warn(`  Failed for post ${post.id}:`, error.message);
    } else {
      success++;
    }

    // Progress log every 50 posts
    if ((success + skipped) % 50 === 0) {
      console.log(`  Progress: ${success} stored, ${skipped} skipped (no topics)...`);
    }
  }

  console.log(`\nBackfill complete: ${success} stored, ${skipped} skipped.`);
}

backfill().catch(console.error);
