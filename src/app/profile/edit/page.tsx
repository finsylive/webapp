"use client";

import { useAuth } from '@/context/AuthContext';
import EditProfileForm from '@/components/profile/EditProfileForm';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function EditProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth/login');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <DashboardLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <EditProfileForm />
    </DashboardLayout>
  );
}
