"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CreatePostInput } from '@/components/posts/CreatePostInput';
import { ArrowLeft } from 'lucide-react';

function CreatePageContent() {
  const router = useRouter();
  const search = useSearchParams();
  const type = (search?.get('type') || '').toLowerCase();
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
            <h1 className="text-lg md:text-xl font-semibold text-foreground">Create Post</h1>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 md:px-8 py-6">
          {/* Main column: full width */}
          <div className="space-y-6">
            {/* Select Environment label (the actual selector is inside CreatePostInput) */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">Select Environment</h2>
              {/* The environment selector + content composer lives inside CreatePostInput */}
              <CreatePostInput initialPostType={initialPostType} />
            </div>
          </div>
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

