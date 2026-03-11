"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StartupCreateWizard } from '@/components/startups/StartupCreateWizard';
import { Rocket, FolderKanban } from 'lucide-react';
import type { EntityType } from '@/api/startups';

export default function CreateStartupPage() {
  const { user, isLoading } = useAuth();
  const [entityType, setEntityType] = useState<EntityType | null>(null);

  if (isLoading) {
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

  // Type picker — shown before wizard
  if (!entityType) {
    return (
      <DashboardLayout>
        <div className="py-6 sm:py-10">
          <div className="max-w-2xl mx-auto px-4 sm:px-0">
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
