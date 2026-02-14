"use client";

import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import { Plus, User, Settings, LogOut, Rocket } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { toProxyUrl } from '@/utils/imageUtils';

const HubIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
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
);

export const Sidebar = React.memo(function Sidebar() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [profileHref, setProfileHref] = useState<string>('/profile');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{avatar_url?: string | null, full_name?: string, username?: string} | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) {
        if (!cancelled) {
          setProfileHref('/profile');
          setUserProfile(null);
        }
        return;
      }
      try {
        let username = (user.user_metadata?.username as string | undefined)?.toLowerCase();
        const { data } = await supabase
          .from('users')
          .select('username, avatar_url, full_name')
          .eq('id', user.id)
          .maybeSingle();
          
        if (!username) {
          username = data?.username?.toLowerCase();
        }
        
        if (!cancelled) {
          setProfileHref(username ? `/profile/${encodeURIComponent(username)}` : '/profile');
          setUserProfile({
            avatar_url: data?.avatar_url,
            full_name: data?.full_name || user.user_metadata?.full_name,
            username: data?.username || username
          });
        }
      } catch {
        if (!cancelled) {
          setProfileHref('/profile');
          setUserProfile(null);
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [user]);

  const mainNavItems = [
    { 
      href: '/', 
      icon: ({ className }: { className?: string }) => <Image src="/icons/home.svg" alt="Home" width={20} height={20} className={className || "w-5 h-5"} />, 
      label: 'Home' 
    },
    { 
      href: '/search', 
      icon: ({ className }: { className?: string }) => <Image src="/icons/search.svg" alt="Search" width={20} height={20} className={className || "w-5 h-5"} />, 
      label: 'Search' 
    },
    { 
      href: '/create', 
      icon: Plus, 
      label: 'Create Post' 
    },
    {
      href: '/startups',
      icon: Rocket,
      label: 'Startups'
    },
    { 
      href: '/hub', 
      icon: HubIcon, 
      label: 'Hub' 
    },
    { 
      href: profileHref, 
      icon: User, 
      label: 'Profile' 
    },
    { 
      href: '/settings', 
      icon: Settings, 
      label: 'Settings' 
    },
  ];

  const NavLink = ({ href, icon: Icon, label, count }: { 
    href: string; 
    icon: React.ComponentType<{ className?: string }>; 
    label: string; 
    count?: number;
  }) => {
    const isActive = pathname === href;
    return (
      <Link 
        href={href}
        className={`group flex items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] font-medium transition-all duration-200 ${
          isActive 
            ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md' 
            : 'text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground active:scale-95'
        }`}
      >
        <div className={`${
          isActive
            ? '[&_img]:brightness-0 [&_img]:invert [&_svg]:text-white text-white'
            : '[&_svg]:text-current text-current group-hover:[&_svg]:text-accent-foreground group-hover:text-accent-foreground dark:group-hover:[&_img]:brightness-0 dark:group-hover:[&_img]:invert'
        }`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="flex-1">{label}</span>
        {count && count > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-xs text-white font-semibold animate-pulse">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Link>
    );
  };

  const SectionDivider = () => (
    <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-4" />
  );

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen(prev => !prev);
  }, []);

  // Handle click outside dropdown
  useEffect(() => {
    if (!isDropdownOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDropdownOpen]);

  return (
    <div className="flex h-full flex-col">        
      {/* Navigation */}
      <div className="flex-1 overflow-auto sidebar-scroll-hide">
        <nav className="space-y-2">
          {/* Main Navigation */}
          <div className="space-y-1">
            {mainNavItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        </nav>
      </div>
      
      {/* User Profile Section */}
      {user && (
        <>
          <SectionDivider />
          <div className="p-3 relative" ref={dropdownRef}>
            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute bottom-full left-3 right-3 mb-2 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2">
                <div className="py-1">
                  <Link 
                    href={profileHref}
                    className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent/50 transition-colors"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <User className="h-4 w-4 opacity-80" />
                    <span>View Profile</span>
                  </Link>
                  <Link 
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent/50 transition-colors"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <Settings className="h-4 w-4 opacity-80" />
                    <span>Settings</span>
                  </Link>
                  <div className="h-px bg-border/60 my-1" />
                  <button 
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-red-500/10 hover:text-red-500 transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsSigningOut(true);
                      try {
                        await signOut();
                      } finally {
                        setIsSigningOut(false);
                      }
                    }}
                    disabled={isSigningOut}
                  >
                    <LogOut className="h-4 w-4 opacity-80" />
                    <span className="flex-1">{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
                    {isSigningOut && (
                      <span className="ml-2 inline-flex items-center">
                        <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {/* User Profile Button */}
            <button 
              onClick={toggleDropdown}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 border border-border hover:from-muted/70 hover:to-muted/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <div className="relative">
                {userProfile?.avatar_url ? (
                  <div className="h-12 w-12 rounded-xl overflow-hidden shadow-lg">
                    <Image
                      src={toProxyUrl(userProfile.avatar_url, { width: 48, quality: 82 })}
                      alt={userProfile.full_name || 'Profile'}
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                      sizes="48px"
                    />
                  </div>
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-lg">
                    <span className="text-base font-bold text-primary-foreground">
                      {userProfile?.full_name?.charAt(0) || user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                    </span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate text-[15px] font-semibold">
                  {userProfile?.full_name || user.user_metadata?.full_name || 'User'}
                </p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <div className="text-muted-foreground transition-transform duration-200 group-hover:rotate-180">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
});

export function MobileSidebar() {
  const pathname = usePathname();
  const [profileHref, setProfileHref] = useState<string>('/profile');
  const { user } = useAuth();
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) {
        if (!cancelled) setProfileHref('/profile');
        return;
      }
      try {
        let username = (user.user_metadata?.username as string | undefined)?.toLowerCase();
        if (!username) {
          const { data } = await supabase
            .from('users')
            .select('username')
            .eq('id', user.id)
            .maybeSingle();
          username = data?.username?.toLowerCase();
        }
        if (!cancelled) setProfileHref(username ? `/profile/${encodeURIComponent(username)}` : '/profile');
      } catch {
        if (!cancelled) setProfileHref('/profile');
      }
    };
    run();
    return () => { cancelled = true; };
  }, [user]);
  
  const mobileNavItems = [
    { 
      href: '/', 
      icon: ({ className }: { className?: string }) => <Image src="/icons/home.svg" alt="Home" width={16} height={16} className={className || "w-4 h-4"} />, 
      label: 'Home' 
    },
    { 
      href: '/search', 
      icon: ({ className }: { className?: string }) => <Image src="/icons/search.svg" alt="Search" width={16} height={16} className={className || "w-4 h-4"} />, 
      label: 'Search' 
    },
    { 
      href: '/create', 
      icon: Plus, 
      label: 'Create' 
    },
    {
      href: '/startups',
      icon: Rocket,
      label: 'Startups'
    },
    { 
      href: '/hub', 
      icon: HubIcon, 
      label: 'Hub' 
    },
    { 
      href: profileHref, 
      icon: User, 
      label: 'Profile' 
    },
    { 
      href: '/settings', 
      icon: Settings, 
      label: 'Settings' 
    },
  ];

  return (
    <nav className="grid grid-cols-4 gap-2">
      {mobileNavItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link 
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 active:scale-95 ${
              isActive 
                ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg' 
                : 'text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground'
            }`}
          >
            <div className={`${
              isActive
                ? '[&_img]:brightness-0 [&_img]:invert [&_svg]:text-white text-white'
                : '[&_svg]:text-current text-current group-hover:[&_svg]:text-accent-foreground group-hover:text-accent-foreground dark:group-hover:[&_img]:brightness-0 dark:group-hover:[&_img]:invert'
            }`}>
              <item.icon className="h-4 w-4" />
            </div>
            <span className="text-xs">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}