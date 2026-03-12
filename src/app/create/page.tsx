"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CreatePostInput } from '@/components/posts/CreatePostInput';
import { ArrowLeft, Building2, FolderKanban, FilePenLine, Rocket } from 'lucide-react';
import Link from 'next/link';

function CreatePageContent() {
  const router = useRouter();
  const search = useSearchParams();
  const type = (search?.get('type') || '').toLowerCase();
  const showPostComposer = !!type;
  const initialPostType: 'text' | 'media' | 'poll' = type === 'poll' ? 'poll' : (type === 'photo' || type === 'video' ? 'media' : 'text');

  // Scroll to top when opening create page (mobile UX nicety)
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }, []);

  return (
    <DashboardLayout>
      <div className="flex flex-col mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="bg-card/80 backdrop-blur-sm border-b border-border px-4 md:px-8 py-3 flex items-center justify-start gap-3 flex-shrink-0 sticky top-0 md:static z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
                className="p-2.5 rounded-full hover:bg-accent text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            <h1 className="text-lg md:text-xl font-semibold text-foreground">
              {showPostComposer ? 'Create Post' : 'Create Something'}
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 md:px-8 py-6">
          {showPostComposer ? (
            <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm">
              <CreatePostInput initialPostType={initialPostType} />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="max-w-2xl">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  What do you want to create?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Posts are one action. Profiles and entities are another. Keep them separate so users know exactly what they are creating.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Link
                  href="/create?type=text"
                  className="group rounded-3xl border border-border/50 bg-card p-6 shadow-sm hover:border-primary/25 hover:bg-accent/10 transition-colors"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <FilePenLine className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">Post</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Share a text update, media post, or poll with the community.
                  </p>
                </Link>

                <Link
                  href="/startups/create?type=startup"
                  className="group rounded-3xl border border-border/50 bg-card p-6 shadow-sm hover:border-primary/25 hover:bg-accent/10 transition-colors"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                    <Rocket className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">Startup</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    List a startup venture with fundraising, positioning, and founder details.
                  </p>
                </Link>

                <Link
                  href="/startups/create?type=org_project"
                  className="group rounded-3xl border border-border/50 bg-card p-6 shadow-sm hover:border-primary/25 hover:bg-accent/10 transition-colors"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
                    <FolderKanban className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">Org Project</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Showcase a club, hackathon team, lab, or initiative that is not a startup company.
                  </p>
                </Link>

                <Link
                  href="/organizations/create"
                  className="group rounded-3xl border border-primary/30 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-6 shadow-sm hover:border-primary/45 transition-colors"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    New
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-foreground">Startup Facilitator</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Create a profile for an incubator, accelerator, e-cell, college incubator, or similar startup facilitator.
                  </p>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Bottom spacer */}
        <div className="h-6" />
      </div>

      {/* Tips modal removed */}
    </DashboardLayout>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    }>
      <CreatePageContent />
    </Suspense>
  );
}
