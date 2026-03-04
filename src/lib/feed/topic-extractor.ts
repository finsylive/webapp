import Groq from 'groq-sdk';
import { GROQ_MODEL, GROQ_TEMPERATURE } from './constants';
import { createAdminClient } from '@/utils/supabase-server';
import type { ContentEmbedding } from './types';

let groqClient: Groq | null = null;

function getGroq(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null;
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

/**
 * Extract topics and keywords from post content using Groq LLM.
 * Falls back to simple keyword extraction if Groq is unavailable.
 */
export async function extractTopics(
  postId: string,
  content: string,
  postType: string
): Promise<ContentEmbedding> {
  const groq = getGroq();

  if (groq && content && content.length > 20) {
    try {
      return await extractWithGroq(groq, postId, content, postType);
    } catch (error) {
      console.warn('Groq topic extraction failed, using fallback:', error);
    }
  }

  return extractWithFallback(postId, content);
}

async function extractWithGroq(
  groq: Groq,
  postId: string,
  content: string,
  postType: string
): Promise<ContentEmbedding> {
  const truncated = content.substring(0, 1000);

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: GROQ_TEMPERATURE,
    max_tokens: 256,
    messages: [
      {
        role: 'system',
        content:
          'You are a content analysis system. Extract topics and keywords from social media posts. Respond ONLY with valid JSON.',
      },
      {
        role: 'user',
        content: `Analyze this ${postType} post and extract:
1. 3-5 topic tags (broad categories like "technology", "startups", "ai", "design", "career", "product", "funding", "engineering")
2. 5-10 keywords (specific terms from the content)
3. Sentiment score (-1 to 1, where -1 is very negative, 0 is neutral, 1 is very positive)

Post content: "${truncated}"

Respond with JSON: {"topics": [...], "keywords": [...], "sentiment": 0.0}`,
      },
    ],
  });

  const responseText = completion.choices[0]?.message?.content?.trim() || '';

  // Parse JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return extractWithFallback(postId, content);
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    post_id: postId,
    topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 5).map(String) : [],
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10).map(String) : [],
    sentiment: typeof parsed.sentiment === 'number' ? Math.max(-1, Math.min(1, parsed.sentiment)) : 0,
    language: 'en',
    computed_at: new Date().toISOString(),
  };
}

/**
 * Simple keyword extraction fallback when Groq is unavailable.
 */
function extractWithFallback(postId: string, content: string): ContentEmbedding {
  const text = (content || '').toLowerCase();

  // Common stop words to filter
  const stopWords = new Set([
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

  // Extract words
  const words = text
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  // Count word frequency
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  // Top keywords by frequency
  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  // Topic mapping based on keyword presence
  const topicMap: Record<string, string[]> = {
    technology: ['tech', 'software', 'code', 'programming', 'developer', 'engineering', 'build', 'app'],
    ai: ['artificial', 'intelligence', 'machine', 'learning', 'model', 'neural', 'deep', 'chatgpt', 'llm'],
    startups: ['startup', 'founder', 'venture', 'seed', 'series', 'pitch', 'launch', 'mvp', 'scale'],
    design: ['design', 'ux', 'ui', 'figma', 'prototype', 'user', 'interface', 'creative'],
    career: ['career', 'job', 'hiring', 'interview', 'resume', 'skills', 'work', 'role', 'position'],
    funding: ['funding', 'investment', 'investor', 'raise', 'round', 'capital', 'valuation'],
    product: ['product', 'feature', 'release', 'roadmap', 'feedback', 'user', 'customer'],
    community: ['community', 'team', 'collaborate', 'together', 'network', 'connect', 'event'],
  };

  const topics: string[] = [];
  for (const [topic, triggers] of Object.entries(topicMap)) {
    if (triggers.some((t) => text.includes(t))) {
      topics.push(topic);
    }
  }

  if (topics.length === 0) topics.push('general');

  return {
    post_id: postId,
    topics: topics.slice(0, 5),
    keywords: keywords.slice(0, 10),
    sentiment: 0,
    language: 'en',
    computed_at: new Date().toISOString(),
  };
}

/**
 * Extract topics/keywords from post content and store directly in content_embeddings.
 * Uses keyword fallback (no API cost). Called server-side on post creation.
 */
export async function extractAndStoreTopics(postId: string, content: string): Promise<void> {
  const embedding = extractWithFallback(postId, content);

  // Only store if we found something meaningful
  if (embedding.topics.length === 0 && embedding.keywords.length === 0) return;

  const supabase = createAdminClient();
  await supabase
    .from('content_embeddings')
    .upsert(
      {
        post_id: postId,
        topics: embedding.topics,
        keywords: embedding.keywords,
        sentiment: embedding.sentiment ?? 0,
        language: embedding.language ?? 'en',
        computed_at: embedding.computed_at,
      },
      { onConflict: 'post_id' }
    );
}
