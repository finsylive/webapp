"use client";

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StartupCard } from '@/components/startups/StartupCard';
import { StartupSearchBar } from '@/components/startups/StartupSearchBar';
import { StartupFilters } from '@/components/startups/StartupFilters';
import { fetchStartups, StartupProfile } from '@/api/startups';
import { Plus, Rocket } from 'lucide-react';
import Link from 'next/link';

export default function StartupsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    }>
      <StartupsPageContent />
    </Suspense>
  );
}

function StartupsPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [startups, setStartups] = useState<StartupProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [stage, setStage] = useState(searchParams.get('stage') || '');
  const [raising, setRaising] = useState(searchParams.get('raising') === 'true');

  const loadStartups = useCallback(async (reset = false) => {
    setLoading(true);
    const newOffset = reset ? 0 : offset;

    const { data, hasMore: more } = await fetchStartups({
      limit: 20,
      offset: newOffset,
      stage: stage || undefined,
      raising: raising || undefined,
      search: search || undefined,
    });

    if (reset) {
      setStartups(data || []);
      setOffset(20);
    } else {
      setStartups(prev => [...prev, ...(data || [])]);
      setOffset(prev => prev + 20);
    }
    setHasMore(!!more);
    setLoading(false);
  }, [offset, stage, raising, search]);

  // Initial load and filter changes
  useEffect(() => {
    loadStartups(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, raising]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadStartups(true);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Please sign in to view startups.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Discover Startups</h1>
            <p className="text-sm text-muted-foreground mt-1">Find and connect with innovative startups</p>
          </div>
          <Link
            href="/startups/create"
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-md"
          >
            <Plus className="h-4 w-4" /> Create Startup
          </Link>
        </div>

        {/* Search */}
        <StartupSearchBar value={search} onChange={setSearch} />

        {/* Filters */}
        <StartupFilters
          stage={stage}
          raising={raising}
          onStageChange={setStage}
          onRaisingChange={setRaising}
        />

        {/* Results */}
        {loading && startups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Loading startups...</p>
          </div>
        ) : startups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Rocket className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-2">No startups found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your filters or be the first to create one!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {startups.map(startup => (
                <StartupCard key={startup.id} startup={startup} />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => loadStartups(false)}
                  disabled={loading}
                  className="px-6 py-2.5 bg-muted text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
