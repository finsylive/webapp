"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { toProxyUrl } from '@/utils/imageUtils';

type UserMetadata = {
  avatar_url?: string;
  picture?: string;
  full_name?: string;
  username?: string;
};

export function MobileNavBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileHref, setProfileHref] = useState<string>('/profile');

  // Resolve and fetch profile the same way as profile/[username]/page.tsx
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) {
        setProfileAvatar(null);
        setProfileHref('/profile');
        return;
      }
      try {
        // 1) Resolve username from metadata, otherwise from public.users
        let username = (user.user_metadata?.username as string | undefined)?.toLowerCase();
        if (!username) {
          const { data } = await supabase
            .from('users')
            .select('username')
            .eq('id', user.id)
            .maybeSingle();
          username = data?.username?.toLowerCase();
        }
        // set profile href regardless of avatar availability
        setProfileHref(username ? `/profile/${encodeURIComponent(username)}` : '/profile');
        if (!username) {
          const meta = user.user_metadata as UserMetadata;
          setProfileAvatar(meta?.avatar_url || meta?.picture || null);
          return;
        }
        // 2) Fetch profile JSON with viewerId
        const qs = new URLSearchParams();
        if (user.id) qs.set('viewerId', user.id);
        const res = await fetch(`/api/users/${encodeURIComponent(username)}/profile?${qs.toString()}`);
        if (!res.ok) throw new Error('Failed to load profile');
        const json = await res.json();
        const fetched = (json?.data?.user?.avatar_url as string | null) ?? null;
        if (!cancelled) setProfileAvatar(fetched);
      } catch {
        // fallback to auth metadata avatar if fetch fails
        if (!cancelled) {
          const meta = user?.user_metadata as UserMetadata | undefined;
          setProfileAvatar(meta?.avatar_url || meta?.picture || null);
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [user]);

  const proxiedAvatar = useMemo(() => (
    profileAvatar
      ? toProxyUrl(String(profileAvatar), { width: 32, quality: 82 })
      : null
  ), [profileAvatar]);
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-2 md:hidden z-50">
      <div className="flex items-center justify-around">
        <Link 
          href="/"
          className={`flex flex-col items-center justify-center p-2 ${pathname === '/' ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Image src="/icons/home.svg" alt="Home" width={20} height={20} />
          <span className="text-xs mt-1">Home</span>
        </Link>
        
        <Link 
          href="/search"
          className={`flex flex-col items-center justify-center p-2 ${pathname.startsWith('/search') ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Image src="/icons/search.svg" alt="Search" width={20} height={20} />
          <span className="text-xs mt-1">Search</span>
        </Link>
        
        <Link 
          href="/projects"
          className={`flex flex-col items-center justify-center p-2 ${pathname.startsWith('/project') ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Image src="/icons/project.svg" alt="Project" width={20} height={20} />
          <span className="text-xs mt-1">Project</span>
        </Link>
        
        <Link 
          href="/hub"
          className={`flex flex-col items-center justify-center p-2 ${pathname.startsWith('/hub') ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M11.5 9C11.5 9 11.5 6.5621 11.5 5M11.5 9C10.3359 9 9.35758 9.79569 9.07932 10.8729M11.5 9C12.7512 9 13.7878 9.91917 13.9712 11.1191M11.5 5C12.6046 5 13.5 4.10457 13.5 3C13.5 1.89543 12.6046 1 11.5 1C10.3954 1 9.50001 1.89543 9.50001 3C9.50001 4.10457 10.3954 5 11.5 5ZM7.50001 16.5C8.47623 15.3284 9.99977 13.5 9.99977 13.5M7.50001 16.5C6.61049 15.7376 5.38954 15.7376 4.50001 16.5C3.46224 17.3895 3.46224 19.1105 4.50001 20C5.38954 20.7624 6.61049 20.7624 7.50001 20C8.53779 19.1105 8.53779 17.3895 7.50001 16.5ZM9.99977 13.5C9.39269 13.0439 9.00001 12.3178 9.00001 11.5C9.00001 11.2834 9.02755 11.0733 9.07932 10.8729M9.99977 13.5C10.4176 13.814 10.9371 14 11.5 14C12.0629 14 12.5824 13.814 13.0003 13.5M15.5 16.5C14.5238 15.3284 13.0003 13.5 13.0003 13.5M15.5 16.5C16.3895 15.7376 17.6105 15.7376 18.5 16.5C19.5378 17.3895 19.5378 19.1105 18.5 20C17.6105 20.7624 16.3895 20.7624 15.5 20C14.4622 19.1105 14.4622 17.3895 15.5 16.5ZM13.0003 13.5C13.6073 13.0439 14 12.3178 14 11.5C14 11.3705 13.9902 11.2433 13.9712 11.1191M9.07932 10.8729L4.89214 9.6496M4.89214 9.6496C4.96205 9.44592 5 9.22739 5 9C5 7.89543 4.10457 7 3 7C1.89543 7 1 7.89543 1 9C1 10.1046 1.89543 11 3 11C3.87718 11 4.62246 10.4353 4.89214 9.6496ZM13.9712 11.1191L17.563 9.5M17.563 9.5C17.785 10.3626 18.5681 11 19.5 11C20.6046 11 21.5 10.1046 21.5 9C21.5 7.89543 20.6046 7 19.5 7C18.3954 7 17.5 7.89543 17.5 9C17.5 9.17265 17.5219 9.34019 17.563 9.5Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-xs mt-1">Hub</span>
        </Link>
        
        <Link 
          href={profileHref}
          className={`flex flex-col items-center justify-center p-2 ${pathname.startsWith('/profile') ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <div className={`relative w-6 h-6 rounded-full overflow-hidden ring-2 ${pathname.startsWith('/profile') ? 'ring-primary' : 'ring-transparent'}`}>
            {proxiedAvatar ? (
              <Image
                src={proxiedAvatar}
                alt="Profile"
                fill
                sizes="24px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/20 to-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                {(user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || '?') as string}
              </div>
            )}
          </div>
          <span className="text-xs mt-1">Profile</span>
        </Link>
      </div>
    </div>
  );
}
