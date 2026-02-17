import { NextResponse } from 'next/server';
import { createAuthClient, createAdminClient } from '@/utils/supabase-server';
import Groq from 'groq-sdk';

type Resource = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  provider: string | null;
  tags: string[] | null;
  eligibility: string | null;
};

type Startup = {
  brand_name: string | null;
  keywords: string[] | null;
  stage: string | null;
  description: string | null;
  is_actively_raising: boolean;
  registered_address: string | null;
};

type UserProfile = {
  tagline: string | null;
  about: string | null;
  current_city: string | null;
  user_type: string | null;
};

// Score a resource based on keyword overlap with startup profile
function scoreResource(resource: Resource, startups: Startup[], profile: UserProfile | null): number {
  let score = 0;

  // Collect all startup keywords (lowercase)
  const startupKeywords: string[] = [];
  for (const s of startups) {
    if (s.keywords?.length) {
      startupKeywords.push(...s.keywords.map(k => k.toLowerCase()));
    }
    if (s.brand_name) startupKeywords.push(s.brand_name.toLowerCase());
    if (s.stage) startupKeywords.push(s.stage.toLowerCase());
    if (s.description) {
      // Extract meaningful words from description
      const words = s.description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      startupKeywords.push(...words.slice(0, 20));
    }
  }

  // Add user profile signals
  if (profile?.tagline) {
    startupKeywords.push(...profile.tagline.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  }
  if (profile?.current_city) {
    startupKeywords.push(profile.current_city.toLowerCase());
  }

  const searchText = [
    resource.title,
    resource.description,
    resource.provider,
    resource.eligibility,
    ...(resource.tags || []),
    resource.category,
  ].filter(Boolean).join(' ').toLowerCase();

  // Score based on keyword matches
  for (const keyword of startupKeywords) {
    if (searchText.includes(keyword)) {
      score += 2;
    }
  }

  // Bonus for tag overlap
  if (resource.tags?.length) {
    for (const tag of resource.tags) {
      const tagLower = tag.toLowerCase();
      if (startupKeywords.some(k => tagLower.includes(k) || k.includes(tagLower))) {
        score += 3;
      }
    }
  }

  // Bonus for funding-related resources if startup is raising
  if (startups.some(s => s.is_actively_raising)) {
    const fundingTerms = ['funding', 'grant', 'investment', 'investor', 'raise', 'capital', 'seed', 'venture', 'finance'];
    if (fundingTerms.some(t => searchText.includes(t))) {
      score += 5;
    }
  }

  // Bonus for stage-matching
  const stages = startups.map(s => s.stage?.toLowerCase()).filter(Boolean);
  if (stages.some(st => searchText.includes(st!))) {
    score += 3;
  }

  // Bonus for location match
  const locations = startups.map(s => s.registered_address?.toLowerCase()).filter(Boolean);
  if (profile?.current_city) locations.push(profile.current_city.toLowerCase());
  if (locations.some(loc => searchText.includes(loc!))) {
    score += 4;
  }

  return score;
}

function buildReason(resource: Resource, startups: Startup[]): string {
  const keywords = startups.flatMap(s => s.keywords || []);
  const isRaising = startups.some(s => s.is_actively_raising);
  const stages = startups.map(s => s.stage).filter(Boolean);
  const searchText = [resource.title, resource.description, ...(resource.tags || [])].join(' ').toLowerCase();

  const fundingTerms = ['funding', 'grant', 'investment', 'investor', 'capital', 'seed', 'venture'];
  if (isRaising && fundingTerms.some(t => searchText.includes(t))) {
    return 'Relevant for your current fundraising needs';
  }

  const matchedKeywords = keywords.filter(k => searchText.includes(k.toLowerCase()));
  if (matchedKeywords.length > 0) {
    return `Matches your startup's focus on ${matchedKeywords.slice(0, 2).join(', ')}`;
  }

  if (stages.length && stages.some(s => searchText.includes(s!.toLowerCase()))) {
    return `Suitable for ${stages[0]} stage startups`;
  }

  const categoryLabels: Record<string, string> = {
    accelerator_incubator: 'accelerator/incubator',
    company_offer: 'startup tool',
    tool: 'tool for startups',
    bank_offer: 'financial offering',
    scheme: 'government scheme',
    govt_scheme: 'government scheme',
  };
  const catLabel = categoryLabels[resource.category] || resource.category;
  return `Recommended ${catLabel} for your startup`;
}

export async function GET() {
  try {
    // Get authenticated user
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ recommendations: [] });
    }

    // Use admin client to bypass RLS
    const supabase = createAdminClient();

    // Fetch user profile, startup profiles, and resources in parallel
    const [profileRes, startupsRes, resourcesRes] = await Promise.all([
      supabase
        .from('users')
        .select('tagline, about, current_city, user_type')
        .eq('id', user.id)
        .single(),
      supabase
        .from('startup_profiles')
        .select('brand_name, keywords, stage, description, is_actively_raising, registered_address')
        .eq('owner_id', user.id)
        .limit(3),
      supabase
        .from('resources')
        .select('id, title, description, category, provider, tags, eligibility')
        .eq('is_active', true)
        .limit(200),
    ]);

    const profile = (profileRes.data as UserProfile | null);
    const startups = (startupsRes.data as Startup[] | null) || [];
    const resources = (resourcesRes.data as Resource[] | null) || [];

    if (resources.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    // --- Strategy 1: Try AI-powered recommendations if Groq key exists ---
    if (process.env.GROQ_API_KEY && (startups.length > 0 || profile)) {
      try {
        const startupContext = startups.map(s => {
          const parts = [
            `Startup: ${s.brand_name || 'Unnamed'}`,
            s.stage ? `Stage: ${s.stage}` : '',
            s.keywords?.length ? `Industry: ${s.keywords.join(', ')}` : '',
            s.description ? `About: ${s.description.slice(0, 200)}` : '',
            s.is_actively_raising ? 'Currently raising funding' : '',
            s.registered_address ? `Location: ${s.registered_address}` : '',
          ];
          return parts.filter(Boolean).join(' | ');
        }).filter(Boolean).join('\n');

        const userContext = [
          profile?.user_type ? `Role: ${profile.user_type}` : '',
          profile?.current_city ? `City: ${profile.current_city}` : '',
          profile?.tagline ? `Tagline: ${profile.tagline}` : '',
        ].filter(Boolean).join(' | ');

        const resourceList = resources.map((r, i) =>
          `[${i}] "${r.title}" (${r.category})${r.provider ? ` by ${r.provider}` : ''} — ${(r.description || '').slice(0, 60)}${r.tags?.length ? ` [${r.tags.join(', ')}]` : ''}`
        ).join('\n');

        const hasStartup = startups.length > 0;

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'You recommend startup resources. Return ONLY a JSON object with a "picks" array. No other text.',
            },
            {
              role: 'user',
              content: hasStartup
                ? `My startup:\n${startupContext}\n\nMe: ${userContext || 'N/A'}\n\nResources:\n${resourceList}\n\nPick the 5 most relevant resources for my startup. Prioritize: matching industry/keywords, stage-appropriate, funding resources if raising, location-relevant.\n\nReturn: {"picks":[{"index":0,"reason":"one sentence why this helps my startup"}]}`
                : `My profile: ${userContext || 'No details'}\n\nResources:\n${resourceList}\n\nPick 5 resources most useful for an aspiring entrepreneur.\n\nReturn: {"picks":[{"index":0,"reason":"one sentence"}]}`,
            },
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3,
          max_tokens: 512,
          response_format: { type: 'json_object' },
        });

        const text = chatCompletion.choices?.[0]?.message?.content?.trim() || '';

        if (text) {
          let picks: Array<{ index: number; reason: string }> = [];

          try {
            const obj = JSON.parse(text);
            // Handle any shape: {picks: [...]}, {recommendations: [...]}, or raw [...]
            const arr = Array.isArray(obj) ? obj
              : Array.isArray(obj.picks) ? obj.picks
              : Array.isArray(obj.recommendations) ? obj.recommendations
              : Array.isArray(obj.results) ? obj.results
              : Object.values(obj).find(v => Array.isArray(v)) || [];

            picks = (arr as Array<Record<string, unknown>>).filter(
              (p): p is { index: number; reason: string } =>
                typeof p === 'object' && p !== null && typeof p.index === 'number' && typeof p.reason === 'string'
            );
          } catch {
            // Try extracting array from text
            const match = text.match(/\[[\s\S]*\]/);
            if (match) {
              try {
                picks = JSON.parse(match[0]).filter(
                  (p: Record<string, unknown>) => typeof p.index === 'number' && typeof p.reason === 'string'
                );
              } catch { /* ignore */ }
            }
          }

          if (picks.length > 0) {
            const recommendations = picks
              .filter(p => p.index >= 0 && p.index < resources.length)
              .slice(0, 5)
              .map(p => ({
                ...resources[p.index],
                ai_reason: p.reason,
              }));

            if (recommendations.length > 0) {
              return NextResponse.json({ recommendations });
            }
          }
        }
      } catch (groqErr) {
        console.error('[recommendations] Groq error, falling back to keyword matching:', groqErr);
      }
    }

    // --- Strategy 2: Keyword-based matchmaking (fallback, always works) ---
    const scored = resources.map(r => ({
      resource: r,
      score: scoreResource(r, startups, profile),
    }));

    // Sort by score descending, take top 5
    scored.sort((a, b) => b.score - a.score);
    const topResources = scored.slice(0, 5);

    const recommendations = topResources.map(({ resource }) => ({
      ...resource,
      ai_reason: startups.length > 0
        ? buildReason(resource, startups)
        : 'Recommended resource for entrepreneurs',
    }));

    return NextResponse.json({ recommendations });
  } catch (e) {
    console.error('[recommendations] Unexpected error:', e);
    return NextResponse.json({ recommendations: [] });
  }
}
