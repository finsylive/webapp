'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, ArrowLeft, CheckCircle, AlertTriangle, Send,
  Brain, Sparkles, Target, TrendingUp, TrendingDown, Clock,
  ChevronRight, Star, Shield,
} from 'lucide-react';
import ScreenGuard from './ScreenGuard';

type Question = {
  id: number;
  question: string;
  type: string;
  answer: string;
  score: number;
  feedback: string;
};

type Application = {
  id: string;
  match_score: number;
  match_breakdown: { skills: number; experience: number; level: number; overall: number };
  profile_summary: string;
  strengths: string[];
  weaknesses: string[];
  ai_questions: Question[];
  interview_score: number;
  overall_score: number;
  ai_recommendation: string;
  ai_summary: string;
  status: string;
};

type Step = 'loading' | 'profile' | 'interview' | 'review' | 'submitted';

interface ApplicationFlowProps {
  type: 'job' | 'gig';
  listingId: string;
  listingTitle: string;
}

export default function ApplicationFlow({ type, listingId, listingTitle }: ApplicationFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('loading');
  const [app, setApp] = useState<Application | null>(null);
  const [error, setError] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [submittingFinal, setSubmittingFinal] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const startTime = useRef(Date.now());
  const answerRef = useRef<HTMLTextAreaElement>(null);

  const handleTabSwitch = useCallback(() => {
    setTabSwitches((prev) => prev + 1);
  }, []);

  // Start application
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const refKey = type === 'job' ? 'job_id' : 'gig_id';
        const res = await fetch('/api/applications/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [refKey]: listingId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to start');
        if (!cancelled) {
          setApp(json.data);
          // If resumed and already submitted
          if (json.data.status === 'submitted') {
            setStep('submitted');
          } else {
            // Figure out where they left off
            const questions = json.data.ai_questions || [];
            const firstUnanswered = questions.findIndex((q: Question) => !q.answer);
            if (firstUnanswered === -1 && questions.length > 0) {
              // All answered, go to review
              setCurrentQ(questions.length - 1);
              setStep('review');
            } else {
              setCurrentQ(Math.max(0, firstUnanswered));
              setStep('profile');
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    })();
    return () => { cancelled = true; };
  }, [type, listingId]);

  // Auto-focus answer box
  useEffect(() => {
    if (step === 'interview' && answerRef.current) {
      answerRef.current.focus();
    }
  }, [step, currentQ]);

  const questions = app?.ai_questions || [];

  async function submitAnswer() {
    if (!app || !answerText.trim()) return;
    setSubmittingAnswer(true);
    setError('');
    try {
      const res = await fetch(`/api/applications/${app.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: questions[currentQ].id, answer: answerText.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');

      // Update local state
      const updated = [...questions];
      updated[currentQ] = {
        ...updated[currentQ],
        answer: answerText.trim(),
        score: json.data.score,
        feedback: json.data.feedback,
      };
      setApp((prev) => prev ? { ...prev, ai_questions: updated } : prev);
      setAnswerText('');

      // Move to next or review
      if (currentQ < questions.length - 1) {
        setCurrentQ(currentQ + 1);
      } else {
        setStep('review');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setSubmittingAnswer(false);
    }
  }

  async function submitApplication() {
    if (!app) return;
    setSubmittingFinal(true);
    setError('');
    try {
      const elapsed = Math.round((Date.now() - startTime.current) / 1000);
      const res = await fetch(`/api/applications/${app.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab_switch_count: tabSwitches, time_spent_seconds: elapsed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setApp(json.data);
      setStep('submitted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmittingFinal(false);
    }
  }

  const scoreColor = (score: number) => {
    if (score >= 75) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-rose-500';
  };

  const scoreBg = (score: number) => {
    if (score >= 75) return 'bg-emerald-500/10 border-emerald-500/30';
    if (score >= 50) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-rose-500/10 border-rose-500/30';
  };

  const qScoreColor = (s: number) => {
    if (s >= 8) return 'text-emerald-500 bg-emerald-500/10';
    if (s >= 5) return 'text-amber-500 bg-amber-500/10';
    return 'text-rose-500 bg-rose-500/10';
  };

  // ─── Loading ───────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
        <ScreenGuard active={false} onTabSwitch={handleTabSwitch} />
        {error ? (
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground mb-2">Failed to Start</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button onClick={() => router.back()} className="text-sm text-primary hover:underline">
              Go Back
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Brain className="h-8 w-8 text-primary animate-pulse" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Analyzing Your Profile</h2>
            <p className="text-sm text-muted-foreground mb-1">AI is reviewing your experience against this role...</p>
            <p className="text-xs text-muted-foreground">This may take a few seconds</p>
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mt-4" />
          </div>
        )}
      </div>
    );
  }

  // ─── Profile Match ─────────────────────────────────────────
  if (step === 'profile' && app) {
    const bd = app.match_breakdown || { skills: 0, experience: 0, level: 0, overall: 0 };
    return (
      <div className="min-h-screen bg-background">
        <ScreenGuard active={true} onTabSwitch={handleTabSwitch} />
        {/* Top bar */}
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground truncate">{listingTitle}</span>
            </div>
            <span className="text-xs text-muted-foreground">Step 1 of 3</span>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              Profile Analysis Complete
            </div>
            <h1 className="text-2xl font-bold text-foreground">Your Profile Match</h1>
            <p className="text-sm text-muted-foreground mt-1">Here&apos;s how your profile aligns with this role</p>
          </div>

          {/* Score Circle */}
          <div className="flex justify-center mb-8">
            <div className={`h-32 w-32 rounded-full border-4 flex flex-col items-center justify-center ${scoreBg(app.match_score)}`}>
              <span className={`text-4xl font-black ${scoreColor(app.match_score)}`}>{app.match_score}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { label: 'Skills', value: bd.skills, icon: Target },
              { label: 'Experience', value: bd.experience, icon: TrendingUp },
              { label: 'Level Fit', value: bd.level, icon: Star },
              { label: 'Overall', value: bd.overall, icon: Brain },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-bold ${scoreColor(item.value)}`}>{item.value}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted/30 mb-1.5">
                    <div className={`h-full rounded-full transition-all ${item.value >= 75 ? 'bg-emerald-500' : item.value >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          {app.profile_summary && (
            <div className="rounded-xl border border-border bg-card p-4 mb-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{app.profile_summary}</p>
            </div>
          )}

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {app.strengths.length > 0 && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Strengths</h3>
                </div>
                <ul className="space-y-1">
                  {app.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {app.weaknesses.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400">Areas to Improve</h3>
                </div>
                <ul className="space-y-1">
                  {app.weaknesses.map((w, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            onClick={() => setStep('interview')}
            className="w-full rounded-xl bg-primary text-primary-foreground py-3.5 text-sm font-bold hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            Start AI Interview
            <ChevronRight className="h-4 w-4" />
          </button>
          <p className="text-xs text-muted-foreground text-center mt-3">
            {questions.length} questions will be asked. Your answers are evaluated by AI.
          </p>
        </div>
      </div>
    );
  }

  // ─── Interview ─────────────────────────────────────────────
  if (step === 'interview' && app) {
    const q = questions[currentQ];
    const answeredCount = questions.filter((x) => x.answer).length;
    const progress = ((answeredCount) / questions.length) * 100;

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ScreenGuard active={true} onTabSwitch={handleTabSwitch} />
        {/* Top bar */}
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Question {currentQ + 1} of {questions.length}</span>
              <span className="text-xs text-muted-foreground">Step 2 of 3</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/30">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col">
          {/* Previous answered questions (compact) */}
          <div className="space-y-3 mb-6">
            {questions.slice(0, currentQ).filter((x) => x.answer).map((pq) => (
              <div key={pq.id} className="rounded-xl border border-border bg-card/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">{pq.question}</p>
                <p className="text-xs text-foreground/80 line-clamp-2">{pq.answer}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${qScoreColor(pq.score)}`}>{pq.score}/10</span>
                  <span className="text-xs text-muted-foreground truncate">{pq.feedback}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Current question */}
          <div className="flex-1 flex flex-col">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">{q?.type?.replace('_', ' ')}</span>
              </div>
              <p className="text-base font-medium text-foreground leading-relaxed">{q?.question}</p>
            </div>

            {error && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 mb-3 text-xs text-rose-500">
                {error}
              </div>
            )}

            <div className="mt-auto">
              <textarea
                ref={answerRef}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value.slice(0, 2000))}
                placeholder="Type your answer here... (min 20 characters)"
                rows={5}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                disabled={submittingAnswer}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey && answerText.trim().length >= 20) {
                    submitAnswer();
                  }
                }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">{answerText.length}/2000</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Ctrl+Enter to submit</span>
                  <button
                    onClick={submitAnswer}
                    disabled={submittingAnswer || answerText.trim().length < 20}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
                  >
                    {submittingAnswer ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Evaluating...</>
                    ) : (
                      <><Send className="h-4 w-4" /> Submit Answer</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Review ────────────────────────────────────────────────
  if (step === 'review' && app) {
    const avgScore = questions.length > 0
      ? Math.round(questions.reduce((s, q) => s + q.score, 0) / questions.length * 10)
      : 0;

    return (
      <div className="min-h-screen bg-background">
        <ScreenGuard active={true} onTabSwitch={handleTabSwitch} />
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Review Your Application</span>
            <span className="text-xs text-muted-foreground">Step 3 of 3</span>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-foreground">Review & Submit</h1>
            <p className="text-sm text-muted-foreground mt-1">Review your answers before final submission</p>
          </div>

          {/* Score Summary */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className={`rounded-xl border p-4 text-center ${scoreBg(app.match_score)}`}>
              <p className="text-xs text-muted-foreground mb-1">Profile Match</p>
              <p className={`text-3xl font-black ${scoreColor(app.match_score)}`}>{app.match_score}</p>
            </div>
            <div className={`rounded-xl border p-4 text-center ${scoreBg(avgScore)}`}>
              <p className="text-xs text-muted-foreground mb-1">Interview Score</p>
              <p className={`text-3xl font-black ${scoreColor(avgScore)}`}>{avgScore}</p>
            </div>
          </div>

          {/* Q&A Review */}
          <div className="space-y-3 mb-8">
            {questions.map((q, i) => (
              <div key={q.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">Q{i + 1}</span>
                    <span className="text-xs uppercase text-muted-foreground">{q.type.replace('_', ' ')}</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${qScoreColor(q.score)}`}>{q.score}/10</span>
                </div>
                <p className="text-sm font-medium text-foreground mb-2">{q.question}</p>
                <p className="text-sm text-muted-foreground bg-muted/10 rounded-lg p-3">{q.answer}</p>
                {q.feedback && (
                  <p className="text-xs text-muted-foreground mt-2 italic">AI: {q.feedback}</p>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 mb-4 text-sm text-rose-500">{error}</div>
          )}

          {tabSwitches > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mb-4 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              You switched tabs {tabSwitches} time{tabSwitches > 1 ? 's' : ''}. This will be visible to the hiring team.
            </div>
          )}

          <button
            onClick={submitApplication}
            disabled={submittingFinal}
            className="w-full rounded-xl bg-emerald-600 dark:bg-emerald-500/90 text-white py-3.5 text-sm font-bold hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submittingFinal ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
            ) : (
              <><CheckCircle className="h-4 w-4" /> Submit Application</>
            )}
          </button>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Once submitted, you cannot edit your answers.
          </p>
        </div>
      </div>
    );
  }

  // ─── Submitted ─────────────────────────────────────────────
  if (step === 'submitted' && app) {
    const recColor: Record<string, string> = {
      strongly_recommend: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30',
      recommend: 'text-blue-600 bg-blue-500/10 border-blue-500/30',
      maybe: 'text-amber-600 bg-amber-500/10 border-amber-500/30',
      not_recommend: 'text-rose-600 bg-rose-500/10 border-rose-500/30',
      pending: 'text-muted-foreground bg-muted/10 border-border',
    };
    const recLabel: Record<string, string> = {
      strongly_recommend: 'Strong Match',
      recommend: 'Good Match',
      maybe: 'Moderate Match',
      not_recommend: 'Low Match',
      pending: 'Processing',
    };

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <div className="h-20 w-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle className="h-10 w-10 text-emerald-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Application Submitted!</h1>
          <p className="text-sm text-muted-foreground mb-6">Your application for <strong>{listingTitle}</strong> has been submitted successfully.</p>

          {/* Scores */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground mb-1">Match</p>
              <p className={`text-xl font-bold ${scoreColor(app.match_score)}`}>{app.match_score}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground mb-1">Interview</p>
              <p className={`text-xl font-bold ${scoreColor(app.interview_score)}`}>{app.interview_score}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground mb-1">Overall</p>
              <p className={`text-xl font-bold ${scoreColor(app.overall_score)}`}>{app.overall_score}</p>
            </div>
          </div>

          {app.ai_recommendation && app.ai_recommendation !== 'pending' && (
            <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold mb-6 ${recColor[app.ai_recommendation] || recColor.pending}`}>
              <Sparkles className="h-4 w-4" />
              {recLabel[app.ai_recommendation] || 'Processing'}
            </div>
          )}

          {app.ai_summary && (
            <div className="rounded-xl border border-border bg-card p-4 text-left mb-6">
              <p className="text-sm text-muted-foreground leading-relaxed">{app.ai_summary}</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-6">
            <Clock className="h-3.5 w-3.5" />
            The hiring team will review your application.
          </div>

          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-6 py-3 text-sm font-semibold hover:opacity-90 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Listing
          </button>
        </div>
      </div>
    );
  }

  return null;
}
