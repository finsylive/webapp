"use client";

import { ReactNode, useState, useEffect } from 'react';
import { useTheme } from '@/context/theme/ThemeContext';
import { MessageCircle, Settings, User, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import { ConversationsProvider } from '@/context/ConversationsContext';
import { useUserData } from '@/hooks/useUserData';

interface ChatLayoutProps {
  children: ReactNode;
  conversationsList?: ReactNode;
  showConversations?: boolean;
}

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

export function ChatLayout({ children, conversationsList, showConversations = true }: ChatLayoutProps) {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { userData, loading } = useUserData();
  const pathname = usePathname();
  const [profileHref, setProfileHref] = useState('/profile');

  useEffect(() => {
    if (userData?.username) {
      setProfileHref(`/profile/${userData.username}`);
    } else {
      setProfileHref('/profile');
    }
  }, [userData?.username]);

  const getProxiedImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    
    // Only proxy S3 URLs that start with "s3://"
    if (url.startsWith('s3://')) {
      const base = 'https://lrgwsbslfqiwoazmitre.supabase.co/functions/v1/get-image?url=';
      return `${base}${encodeURIComponent(url)}`;
    }
    
    // All other URLs (Google, direct HTTPS, etc.) use directly
    return url;
  };

  const getInitials = (fullName?: string, username?: string): string => {
    if (fullName) {
      return fullName
        .split(' ')
        .map(name => name[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (username) {
      return username[0].toUpperCase();
    }
    return 'U';
  };

  const navigationItems = [
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
      href: '/messages', 
      icon: MessageCircle, 
      label: 'Messages' 
    },
    { 
      href: '/projects', 
      icon: ({ className }: { className?: string }) => <Image src="/icons/project.svg" alt="Projects" width={20} height={20} className={className || "w-5 h-5"} />, 
      label: 'Projects' 
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
    <ConversationsProvider>
      <div className="flex h-screen bg-gradient-to-br from-background via-background to-muted/20 overflow-hidden">
        {/* Left Sidebar - Icon Only (hidden on mobile when in conversation) */}
        <div className="hidden md:flex flex-col w-16 bg-card/50 backdrop-blur-sm border-r border-border/50 relative z-20">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 border-b border-border/50">
          <Link href="/" className="transition-transform hover:scale-110 active:scale-95">
            <Image 
              src="/logo/green.svg" 
              alt="Ments Logo" 
              width={32} 
              height={32} 
              className="w-8 h-8"
            />
          </Link>
        </div>

        {/* Navigation Icons */}
        <nav className="flex-1 flex flex-col items-center py-4 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/messages' ? pathname?.startsWith('/messages') : pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                }`}
                title={item.label}
              >
                <div className={`${
                  isActive 
                    ? '[&_img]:brightness-0 [&_img]:invert [&_svg]:text-primary-foreground text-primary-foreground' 
                    : '[&_svg]:text-current text-current group-hover:[&_img]:brightness-0 group-hover:[&_img]:invert group-hover:[&_svg]:text-foreground group-hover:text-foreground'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                
                {/* Tooltip */}
                <div className="absolute left-full ml-2 px-2 py-1 rounded-lg text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[9999] bg-popover text-popover-foreground border border-border shadow-md">
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-2 border-t border-border/50">
          <Link
            href={profileHref}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors hover:bg-accent/60"
          >
            {(() => {
              // Show loading state
              if (loading) {
                return (
                  <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                );
              }
              
              // Try to show avatar if available
              const avatarUrl = getProxiedImageUrl(userData?.avatar_url);
              if (avatarUrl) {
                return (
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-border/50">
                    <Image 
                      src={avatarUrl} 
                      alt={userData?.full_name || userData?.username || "User"} 
                      width={32} 
                      height={32} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                );
              }
              
              // Fallback to initials
              const initials = getInitials(userData?.full_name, userData?.username);
              return (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
                  {initials}
                </div>
              );
            })()}
          </Link>
        </div>
      </div>

      {/* Middle Panel - Conversations List (full width on mobile) */}
      {showConversations && (
        <div className={`w-full md:w-80 bg-card/50 backdrop-blur-sm md:border-r border-border/50 flex flex-col relative z-10 ${pathname?.includes('/messages/') && !pathname?.endsWith('/messages') ? 'hidden md:flex' : ''}`}>
          {conversationsList}
        </div>
      )}

        {/* Right Panel - Message Area (full width on mobile when viewing conversation) */}
        <div className={`flex-1 flex flex-col min-w-0 ${pathname?.includes('/messages/') && !pathname?.endsWith('/messages') ? 'w-full' : 'hidden md:flex'}`}>
          {children}
        </div>
      </div>
    </ConversationsProvider>
  );
}