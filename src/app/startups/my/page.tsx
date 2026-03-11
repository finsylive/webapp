"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MyStartupRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/startups?tab=my');
  }, [router]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
