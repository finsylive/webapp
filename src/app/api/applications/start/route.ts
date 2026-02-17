import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createAdminClient } from '@/utils/supabase-server';
import Groq from 'groq-sdk';

const getGroq = () => new Groq({ apiKey: process.env.GROQ_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { job_id, gig_id } = body as { job_id?: string; gig_id?: string };

    if (!job_id && !gig_id) {
      return NextResponse.json({ error: 'job_id or gig_id required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check if already applied
    const refCol = job_id ? 'job_id' : 'gig_id';
    const refVal = job_id || gig_id;
    const { data: existing } = await admin
      .from('applications')
      .select('*')
      .eq(refCol, refVal)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ data: existing, resumed: true });
    }

    // Fetch job/gig details
    let listing: Record<string, unknown> = {};
    if (job_id) {
      const { data } = await admin.from('jobs').select('*').eq('id', job_id).single();
      if (!data) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      listing = data;
    } else {
      const { data } = await admin.from('gigs').select('*').eq('id', gig_id!).single();
      if (!data) return NextResponse.json({ error: 'Gig not found' }, { status: 404 });
      listing = data;
    }

    // Fetch user profile
    const { data: userRow } = await admin
      .from('users')
      .select('id, username, full_name, avatar_url, tagline, current_city, about, email, skills')
      .eq('id', user.id)
      .single();

    // Fetch work experiences
    const { data: experiences } = await admin
      .from('work_experiences')
      .select('id, company_name, domain, positions (id, position, start_date, end_date, description)')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .limit(10);

    // Fetch projects
    const { data: projects } = await admin
      .from('projects')
      .select('id, title, description, tech_stack')
      .eq('owner_id', user.id)
      .limit(10);

    const profileSnapshot = {
      user: userRow,
      experiences: experiences || [],
      projects: projects || [],
    };

    // Format profile for AI
    const expText = (experiences || []).map((e: Record<string, unknown>) => {
      const positions = (e.positions as Array<Record<string, unknown>>) || [];
      const posText = positions.map((p) => `${p.position} (${p.start_date || '?'} - ${p.end_date || 'Present'}): ${p.description || 'N/A'}`).join('\n    ');
      return `  ${e.company_name} (${e.domain || 'N/A'}):\n    ${posText}`;
    }).join('\n');

    const projText = (projects || []).map((p: Record<string, unknown>) =>
      `  - ${p.title}: ${(p.description as string || '').slice(0, 150)}${p.tech_stack ? ` [${(p.tech_stack as string[]).join(', ')}]` : ''}`
    ).join('\n');

    const userSkills = Array.isArray(userRow?.skills) ? (userRow.skills as string[]) : [];
    const candidateProfile = `Name: ${userRow?.full_name || 'Unknown'}
Tagline: ${userRow?.tagline || 'N/A'}
About: ${userRow?.about || 'N/A'}
City: ${userRow?.current_city || 'N/A'}
Skills: ${userSkills.length > 0 ? userSkills.join(', ') : 'None listed'}
Work Experience:
${expText || '  None listed'}
Projects:
${projText || '  None listed'}`;

    // Format listing for AI
    const isJob = !!job_id;
    const listingText = isJob
      ? `Title: ${listing.title}
Company: ${listing.company}
Category: ${listing.category || 'N/A'}
Experience Level: ${listing.experience_level || 'any'}
Job Type: ${listing.job_type || 'full-time'}
Work Mode: ${listing.work_mode || 'N/A'}
Location: ${listing.location || 'N/A'}
Skills Required: ${(listing.skills_required as string[] || []).join(', ') || 'N/A'}
Description: ${(listing.description as string || '').slice(0, 500)}
Requirements: ${(listing.requirements as string || '').slice(0, 500)}
Responsibilities: ${(listing.responsibilities as string || '').slice(0, 500)}`
      : `Title: ${listing.title}
Client: ${listing.company || 'N/A'}
Category: ${listing.category || 'N/A'}
Experience Level: ${listing.experience_level || 'any'}
Payment Type: ${listing.payment_type || 'fixed'}
Budget: ${listing.budget || 'N/A'}
Duration: ${listing.duration || 'N/A'}
Skills Required: ${(listing.skills_required as string[] || []).join(', ') || 'N/A'}
Description: ${(listing.description as string || '').slice(0, 500)}
Deliverables: ${(listing.deliverables as string || '').slice(0, 500)}
Scope: ${(listing.responsibilities as string || '').slice(0, 500)}`;

    // AI Call 1: Profile Analysis
    const analysisResponse = await getGroq().chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an AI recruiter. Analyze the candidate profile against the job/gig. Return ONLY valid JSON, no markdown, no code fences.',
        },
        {
          role: 'user',
          content: `Analyze this candidate for the ${isJob ? 'job' : 'gig'} below.

${isJob ? 'JOB' : 'GIG'} DETAILS:
${listingText}

CANDIDATE PROFILE:
${candidateProfile}

Return JSON:
{
  "match_score": <0-100>,
  "match_breakdown": { "skills": <0-100>, "experience": <0-100>, "level": <0-100>, "overall": <0-100> },
  "profile_summary": "<2-3 sentences>",
  "strengths": ["<strength1>", "<strength2>", ...],
  "weaknesses": ["<gap1>", "<gap2>", ...]
}`,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      max_tokens: 800,
    });

    let analysis = { match_score: 50, match_breakdown: { skills: 50, experience: 50, level: 50, overall: 50 }, profile_summary: '', strengths: [] as string[], weaknesses: [] as string[] };
    try {
      const raw = analysisResponse.choices?.[0]?.message?.content || '{}';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleaned);
    } catch { /* use defaults */ }

    // AI Call 2: Generate Questions
    const questionsResponse = await getGroq().chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an AI interviewer. Generate interview questions. Return ONLY valid JSON array, no markdown, no code fences.',
        },
        {
          role: 'user',
          content: `Generate 6 interview questions for this ${isJob ? 'job' : 'gig'}.

${isJob ? 'JOB' : 'GIG'}: ${listing.title} - ${listing.category || 'general'}
Level: ${listing.experience_level || 'any'}
Skills: ${(listing.skills_required as string[] || []).join(', ') || 'general'}
Description: ${(listing.description as string || '').slice(0, 300)}

CANDIDATE GAPS: ${analysis.weaknesses.join(', ') || 'None identified'}

Generate exactly 6 questions: 2 technical, 1 behavioral, 1 problem-solving, 1 motivation, 1 about candidate gaps.

Return JSON array:
[
  { "id": 1, "question": "...", "type": "technical" },
  { "id": 2, "question": "...", "type": "technical" },
  { "id": 3, "question": "...", "type": "behavioral" },
  { "id": 4, "question": "...", "type": "problem_solving" },
  { "id": 5, "question": "...", "type": "motivation" },
  { "id": 6, "question": "...", "type": "gap" }
]`,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.6,
      max_tokens: 1024,
    });

    let questions: Array<{ id: number; question: string; type: string; answer?: string; score?: number; feedback?: string }> = [];
    try {
      const raw = questionsResponse.choices?.[0]?.message?.content || '[]';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questions = JSON.parse(cleaned);
    } catch {
      questions = [
        { id: 1, question: 'Tell us about your relevant experience for this role.', type: 'behavioral' },
        { id: 2, question: 'What technical skills do you bring to this position?', type: 'technical' },
        { id: 3, question: 'Describe a challenging project you worked on recently.', type: 'problem_solving' },
        { id: 4, question: 'Why are you interested in this role?', type: 'motivation' },
        { id: 5, question: 'How do you handle tight deadlines?', type: 'behavioral' },
        { id: 6, question: 'Where do you see yourself growing in this field?', type: 'gap' },
      ];
    }

    // Ensure questions have proper structure
    questions = questions.map((q, i) => ({
      id: q.id || i + 1,
      question: q.question,
      type: q.type || 'general',
      answer: '',
      score: 0,
      feedback: '',
    }));

    // Insert application
    const { data: application, error: insertError } = await admin
      .from('applications')
      .insert({
        job_id: job_id || null,
        gig_id: gig_id || null,
        user_id: user.id,
        user_name: userRow?.full_name || user.email,
        user_email: user.email,
        user_avatar_url: userRow?.avatar_url || null,
        user_tagline: userRow?.tagline || null,
        user_city: userRow?.current_city || null,
        profile_snapshot: profileSnapshot,
        match_score: analysis.match_score,
        match_breakdown: analysis.match_breakdown,
        profile_summary: analysis.profile_summary,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        ai_questions: questions,
        status: 'in_progress',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ data: application });
  } catch (error) {
    console.error('Application start error:', error);
    return NextResponse.json({ error: 'Failed to start application' }, { status: 500 });
  }
}
