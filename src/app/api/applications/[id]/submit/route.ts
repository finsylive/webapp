import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createAdminClient } from '@/utils/supabase-server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { tab_switch_count = 0, time_spent_seconds = 0 } = body;

    const admin = createAdminClient();

    const { data: app, error: fetchErr } = await admin
      .from('applications')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchErr || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    if (app.status !== 'in_progress') {
      return NextResponse.json({ error: 'Already submitted' }, { status: 400 });
    }

    const questions = (app.ai_questions || []) as Array<{
      id: number; question: string; type: string; answer: string; score: number; feedback: string;
    }>;

    // Check all questions answered
    const unanswered = questions.filter((q) => !q.answer);
    if (unanswered.length > 0) {
      return NextResponse.json({ error: `${unanswered.length} questions unanswered` }, { status: 400 });
    }

    // Calculate interview score (avg of scores, scaled to 0-100)
    const avgScore = questions.reduce((s, q) => s + (q.score || 0), 0) / questions.length;
    const interviewScore = Math.round(avgScore * 10); // 1-10 → 0-100

    // Calculate overall score
    const matchScore = app.match_score || 0;
    let overallScore = Math.round(matchScore * 0.4 + interviewScore * 0.6);
    // Penalty for tab switches
    overallScore = Math.max(0, overallScore - (tab_switch_count * 2));

    // Fetch listing info for final recommendation
    let listingTitle = '';
    let listingCompany = '';
    if (app.job_id) {
      const { data: job } = await admin.from('jobs').select('title, company').eq('id', app.job_id).single();
      listingTitle = job?.title || '';
      listingCompany = job?.company || '';
    } else if (app.gig_id) {
      const { data: gig } = await admin.from('gigs').select('title, company').eq('id', app.gig_id).single();
      listingTitle = gig?.title || '';
      listingCompany = gig?.company || '';
    }

    // AI Final Recommendation
    const qaText = questions.map((q) =>
      `Q (${q.type}): ${q.question}\nA: ${q.answer}\nScore: ${q.score}/10 — ${q.feedback}`
    ).join('\n\n');

    let recommendation = 'maybe';
    let aiSummary = '';
    let hireSuggestion = '';

    try {
      const recResponse = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a senior recruiter. Provide a hiring recommendation. Return ONLY valid JSON, no markdown.',
          },
          {
            role: 'user',
            content: `Based on the complete application, provide a hiring recommendation.

ROLE: ${listingTitle} at ${listingCompany}
MATCH SCORE: ${matchScore}/100
INTERVIEW SCORE: ${interviewScore}/100
OVERALL SCORE: ${overallScore}/100
TAB SWITCHES: ${tab_switch_count}
STRENGTHS: ${(app.strengths || []).join(', ')}
WEAKNESSES: ${(app.weaknesses || []).join(', ')}

Q&A:
${qaText}

Return JSON:
{
  "recommendation": "strongly_recommend" | "recommend" | "maybe" | "not_recommend",
  "summary": "<3-4 sentence evaluation>",
  "hire_suggestion": "<Detailed reasoning for the hiring decision>"
}`,
          },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 600,
      });

      const raw = recResponse.choices?.[0]?.message?.content || '{}';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      recommendation = parsed.recommendation || 'maybe';
      aiSummary = parsed.summary || '';
      hireSuggestion = parsed.hire_suggestion || '';
    } catch {
      // Use score-based fallback
      if (overallScore >= 80) recommendation = 'strongly_recommend';
      else if (overallScore >= 60) recommendation = 'recommend';
      else if (overallScore >= 40) recommendation = 'maybe';
      else recommendation = 'not_recommend';
      aiSummary = `Candidate scored ${overallScore}/100 overall.`;
      hireSuggestion = `Based on a match score of ${matchScore} and interview score of ${interviewScore}.`;
    }

    // Update application
    const { data: updated, error: updateErr } = await admin
      .from('applications')
      .update({
        interview_score: interviewScore,
        overall_score: overallScore,
        ai_recommendation: recommendation,
        ai_summary: aiSummary,
        hire_suggestion: hireSuggestion,
        tab_switch_count: tab_switch_count,
        time_spent_seconds: time_spent_seconds,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Submit error:', error);
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 });
  }
}
