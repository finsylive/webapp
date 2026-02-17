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
    const { question_id, answer } = body as { question_id: number; answer: string };

    if (!question_id || !answer?.trim()) {
      return NextResponse.json({ error: 'question_id and answer required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch the application
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
      return NextResponse.json({ error: 'Application already submitted' }, { status: 400 });
    }

    const questions = (app.ai_questions || []) as Array<{
      id: number; question: string; type: string; answer: string; score: number; feedback: string;
    }>;

    const qIndex = questions.findIndex((q) => q.id === question_id);
    if (qIndex === -1) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Fetch listing title for context
    let listingTitle = '';
    let listingCategory = '';
    if (app.job_id) {
      const { data: job } = await admin.from('jobs').select('title, category').eq('id', app.job_id).single();
      listingTitle = job?.title || '';
      listingCategory = job?.category || '';
    } else if (app.gig_id) {
      const { data: gig } = await admin.from('gigs').select('title, category').eq('id', app.gig_id).single();
      listingTitle = gig?.title || '';
      listingCategory = gig?.category || '';
    }

    // AI evaluate the answer
    let score = 5;
    let feedback = '';
    try {
      const evalResponse = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are an interview evaluator. Score answers 1-10 and give brief feedback. Return ONLY valid JSON, no markdown.',
          },
          {
            role: 'user',
            content: `Evaluate this interview answer.

ROLE: ${listingTitle} (${listingCategory})
QUESTION (${questions[qIndex].type}): ${questions[qIndex].question}
ANSWER: ${answer.slice(0, 2000)}

Return JSON: { "score": <1-10>, "feedback": "<2-3 sentence evaluation>" }`,
          },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 300,
      });

      const raw = evalResponse.choices?.[0]?.message?.content || '{}';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      score = Math.min(10, Math.max(1, parsed.score || 5));
      feedback = parsed.feedback || '';
    } catch {
      score = 5;
      feedback = 'Answer recorded.';
    }

    // Update the question
    questions[qIndex] = {
      ...questions[qIndex],
      answer: answer.slice(0, 2000),
      score,
      feedback,
    };

    const { error: updateErr } = await admin
      .from('applications')
      .update({ ai_questions: questions, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      data: { question_id, score, feedback },
    });
  } catch (error) {
    console.error('Answer error:', error);
    return NextResponse.json({ error: 'Failed to process answer' }, { status: 500 });
  }
}
