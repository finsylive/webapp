import { NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';
import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const publicSupabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET() {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ recommendations: [] });
    }

    // Get authenticated user
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ recommendations: [] });
    }

    // Fetch user profile and startup profiles in parallel
    const [profileRes, startupsRes, resourcesRes] = await Promise.all([
      publicSupabase
        .from('profiles')
        .select('tagline, about, city, user_type')
        .eq('id', user.id)
        .single(),
      publicSupabase
        .from('startup_profiles')
        .select('brand_name, keywords, stage, description, is_actively_raising, registered_address')
        .eq('owner_id', user.id)
        .limit(3),
      publicSupabase
        .from('resources')
        .select('id, title, description, category, provider, tags, eligibility')
        .eq('is_active', true)
        .limit(100),
    ]);

    const profile = profileRes.data;
    const startups = startupsRes.data;
    const resources = resourcesRes.data;

    if (!resources || resources.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    // Build startup context (primary signal for recommendations)
    const startupContext = (startups || []).map(s => {
      const parts = [
        `Startup: ${s.brand_name || 'Unnamed'}`,
        s.stage ? `Stage: ${s.stage}` : '',
        s.keywords?.length ? `Industry/Sectors: ${s.keywords.join(', ')}` : '',
        s.description ? `About: ${s.description.slice(0, 200)}` : '',
        s.is_actively_raising ? 'Currently raising funding' : '',
        s.registered_address ? `Location: ${s.registered_address}` : '',
      ];
      return parts.filter(Boolean).join(' | ');
    }).filter(Boolean).join('\n');

    // Build user profile context (secondary signal)
    const userProfileContext = [
      profile?.user_type ? `Role: ${profile.user_type}` : '',
      profile?.city ? `City: ${profile.city}` : '',
      profile?.tagline ? `Tagline: ${profile.tagline}` : '',
    ].filter(Boolean).join(' | ');

    // Build resource summaries
    const resourceSummaries = resources.map((r, i) =>
      `[${i}] "${r.title}" (${r.category}) by ${r.provider || 'unknown'} — ${(r.description || '').slice(0, 80)}${r.tags?.length ? ` [tags: ${r.tags.join(', ')}]` : ''}${r.eligibility ? ` [eligibility: ${r.eligibility.slice(0, 60)}]` : ''}`
    ).join('\n');

    const hasStartup = startupContext.length > 0;

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: hasStartup
            ? 'You are a startup resource recommendation engine. Your PRIMARY job is to match resources to the user\'s startup profile — their industry, stage, location, and whether they are raising funding. Recommend resources that directly help their startup grow. Return ONLY valid JSON.'
            : 'You are a startup resource recommendation engine. Given a user profile and a list of resources, pick the top 5 most relevant resources and explain why each is relevant in one short sentence. Return ONLY valid JSON.',
        },
        {
          role: 'user',
          content: hasStartup
            ? `STARTUP PROFILE (use this as the primary basis for recommendations):\n${startupContext}\n\nUser info: ${userProfileContext || 'N/A'}\n\nAvailable resources:\n${resourceSummaries}\n\nBased on the startup's industry, stage, location, and funding needs, return a JSON array of the top 5 most relevant resources. Prioritize:\n1. Resources matching the startup's industry/sectors\n2. Resources appropriate for the startup's current stage (${startups?.[0]?.stage || 'unknown'})\n3. Funding/grants if the startup is raising\n4. Location-relevant schemes and programs\n\nFormat: [{"index": 0, "reason": "Short personalized reason referencing the startup"}]\n\nReturn ONLY the JSON array, no markdown.`
            : `User profile:\n${userProfileContext || 'No profile details available'}\n\nAvailable resources:\n${resourceSummaries}\n\nReturn a JSON array of the top 5 most relevant resources for this user. Format:\n[{"index": 0, "reason": "Short personalized reason"}]\n\nReturn ONLY the JSON array, no markdown.`,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 512,
    });

    const text = chatCompletion.choices?.[0]?.message?.content?.trim() || '[]';

    let picks: Array<{ index: number; reason: string }>;
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
      picks = JSON.parse(jsonMatch[1]!.trim());
    } catch {
      return NextResponse.json({ recommendations: [] });
    }

    // Map picks back to full resource data
    const recommendations = picks
      .filter(p => p.index >= 0 && p.index < resources.length)
      .slice(0, 5)
      .map(p => ({
        ...resources[p.index],
        ai_reason: p.reason,
      }));

    return NextResponse.json({ recommendations });
  } catch (e) {
    console.error('Recommendations error:', e);
    return NextResponse.json({ recommendations: [] });
  }
}
