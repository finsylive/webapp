"use client";

import { Suspense, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StartupCreateWizard } from '@/components/startups/StartupCreateWizard';
import { Rocket, FolderKanban, ArrowLeft, AlertCircle } from 'lucide-react';
import { type EntityType, fetchMyVentures } from '@/api/startups';
import { useUserData } from '@/hooks/useUserData';

// The ID that has the 'organisation role' and can create multiple startups
const ORGANIZATION_ROLE_USER_ID = 'ORGANISATION_ROLE_ID_HERE'; // Replace with actual ID or logic

export default function CreateStartupPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    }>
      <CreateStartupPageContent />
    </Suspense>
  );
}

function CreateStartupPageContent() {
  const { user, isLoading } = useAuth();
  const { userData } = useUserData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type') as EntityType | null;
  const [entityType, setEntityType] = useState<EntityType | null>(
    typeParam === 'startup' || typeParam === 'org_project' ? typeParam : null
  );

  const [checkingLimit, setCheckingLimit] = useState(true);
  const [hasReachedLimit, setHasReachedLimit] = useState(false);

  useEffect(() => {
    async function checkLimit() {
      if (!user) return;
      
      // Allow if they are the special organization role
      if (user.id === ORGANIZATION_ROLE_USER_ID) {
        setCheckingLimit(false);
        return;
      }

      try {
        const res = await fetchMyVentures(user.id);
        if (res.data && res.data.length >= 1) {
          setHasReachedLimit(true);
        }
      } catch (err) {
        console.error('Failed to check startup limits', err);
      } finally {
        setCheckingLimit(false);
      }
    }
    
    if (user && !isLoading) {
      checkLimit();
    } else if (!isLoading && !user) {
      setCheckingLimit(false);
    }
  }, [user, isLoading]);

  if (isLoading || checkingLimit) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Please sign in to create a profile.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (hasReachedLimit) {
    return (
      <DashboardLayout>
        <div className="py-6 sm:py-10">
          <div className="max-w-2xl mx-auto px-4 sm:px-0">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </button>
            <div className="bg-card border border-amber-500/30 rounded-2xl p-6 text-center shadow-sm">
              <div className="mx-auto w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Limit Reached</h1>
              <p className="text-sm text-muted-foreground mt-2">
                You have already created a startup or project profile. Currently, standard accounts are limited to one active venture. 
                If you are an incubator or organization requiring multiple listings, please contact support for an upgraded role.
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Type picker — shown before wizard
  if (!entityType) {
    return (
      <DashboardLayout>
        <div className="py-6 sm:py-10">
          <div className="max-w-2xl mx-auto px-4 sm:px-0">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </button>
            <h1 className="text-xl font-bold text-foreground">What are you building?</h1>
            <p className="text-sm text-muted-foreground mt-1">Pick the type that fits. You can change this later.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              {/* Org Project Card */}
              <button
                onClick={() => setEntityType('org_project')}
                className="group text-left p-5 bg-card border-2 border-border/40 rounded-2xl hover:border-primary/40 hover:bg-primary/[0.03] transition-all duration-150"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors duration-150 mb-3">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-foreground block">Org Project</span>
                <span className="text-xs text-muted-foreground mt-1 block leading-relaxed">
                  College club, hackathon team, research group. No legal entity or fundraising needed.
                </span>
              </button>

              {/* Startup Card */}
              <button
                onClick={() => setEntityType('startup')}
                className="group text-left p-5 bg-card border-2 border-border/40 rounded-2xl hover:border-primary/40 hover:bg-primary/[0.03] transition-all duration-150"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors duration-150 mb-3">
                  <Rocket className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-foreground block">Startup</span>
                <span className="text-xs text-muted-foreground mt-1 block leading-relaxed">
                  Registered company or venture seeking funding. Full fundraising tools and investor visibility.
                </span>
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Wizard
  return (
    <DashboardLayout>
      <div className="py-6 sm:py-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-0 mb-6">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => setEntityType(null)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Change type
            </button>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
              entityType === 'org_project'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {entityType === 'org_project' ? (
                <><FolderKanban className="h-3 w-3" /> Org Project</>
              ) : (
                <><Rocket className="h-3 w-3" /> Startup</>
              )}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {entityType === 'org_project' ? 'Create your org project' : 'Create your startup profile'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {entityType === 'org_project'
              ? 'Showcase your project, team, and work to the community.'
              : 'Fill in the details to get your startup listed on the platform.'}
          </p>
        </div>
        <StartupCreateWizard entityType={entityType} />
      </div>
    </DashboardLayout>
  );
}
