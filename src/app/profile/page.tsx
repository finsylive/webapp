"use client";

import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/utils/supabase';

export default function ProfileRedirectPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/');
      return;
    }

    const resolve = async () => {
      try {
        // Try user_metadata first, then DB
        let username = (user.user_metadata?.username as string | undefined)?.toLowerCase();

        if (!username) {
          const { data } = await supabase
            .from('users')
            .select('username')
            .eq('id', user.id)
            .maybeSingle();
          username = data?.username?.toLowerCase();
        }

        if (username) {
          router.replace(`/profile/${encodeURIComponent(username)}`);
        } else {
          // No username yet — send to edit profile to set one up
          router.replace('/profile/edit');
        }
      } catch {
        router.replace('/profile/edit');
      } finally {
        setChecking(false);
      }
    };

    resolve();
  }, [isLoading, user, router]);

  if (isLoading || checking) {
    return (
      <DashboardLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return null;
}
