'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ApplicationFlow from '@/components/application/ApplicationFlow';
import { Shield, Brain, Clock, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function GigApplyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;
  const [started, setStarted] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/gigs/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((json) => { if (json.data?.title) setTitle(json.data.title); })
      .catch(() => {});
  }, [id]);

  if (started) {
    return <ApplicationFlow type="gig" listingId={id} listingTitle={title} />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">AI-Powered Application</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {title ? `Apply for: ${title}` : 'Loading...'}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-4 mb-6">
          <h2 className="text-sm font-semibold text-foreground">Before you begin:</h2>

          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">AI Profile Analysis</p>
              <p className="text-xs text-muted-foreground">Your profile will be analyzed against this gig&apos;s requirements and scored.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Brain className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">AI Interview (6 Questions)</p>
              <p className="text-xs text-muted-foreground">You&apos;ll answer role-specific questions. Each answer is evaluated and scored by AI in real-time.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Estimated Time: 5-10 minutes</p>
              <p className="text-xs text-muted-foreground">Take your time to give thoughtful answers. Quality matters more than speed.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Do Not Leave This Page</p>
              <p className="text-xs text-muted-foreground">Tab switches are tracked and visible to the hiring team. Stay focused during the application.</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setStarted(true)}
          disabled={!title}
          className="w-full rounded-xl bg-primary text-primary-foreground py-3.5 text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
        >
          Start Application
        </button>
        <button
          onClick={() => router.back()}
          className="w-full mt-3 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground hover:bg-accent/50 transition flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
      </div>
    </div>
  );
}
