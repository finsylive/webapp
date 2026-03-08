"use client";

import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StartupCreateWizard } from '@/components/startups/StartupCreateWizard';

export default function CreateStartupPage() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  // Middleware redirects unauthenticated users to login

  return (
    <DashboardLayout>
      <div className="py-6 sm:py-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-0 mb-6">
          <h1 className="text-2xl font-bold text-foreground">Create your startup profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Fill in the details to get your startup listed on the platform.</p>
        </div>
        <StartupCreateWizard />
      </div>
    </DashboardLayout>
  );
}
