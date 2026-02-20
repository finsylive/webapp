// top bar
"use client";

import { ReactNode, useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/context/theme/ThemeContext';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { MobileNavBar } from './MobileNavBar';
import DashboardSidebarWidgets from './DashboardSidebarWidgets';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type DashboardLayoutProps = {
  children: ReactNode;
  showSidebar?: boolean;
  fullWidth?: boolean;
};

export function DashboardLayout({ children, showSidebar, fullWidth }: DashboardLayoutProps) {
  const { isDarkMode } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const shouldShowSidebar = typeof showSidebar === 'boolean' ? showSidebar : !(pathname?.startsWith('/post'));

  // Unread counts for header badges
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const fetchUnreadCounts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [msgRes, notifRes] = await Promise.allSettled([
        fetch(`/api/messages/read?userId=${user.id}`),
        fetch(`/api/notifications?userId=${user.id}&unreadOnly=true&limit=1`),
      ]);
      if (msgRes.status === 'fulfilled' && msgRes.value.ok) {
        const json = await msgRes.value.json();
        setUnreadMessages(json.total_unread_count ?? 0);
      }
      if (notifRes.status === 'fulfilled' && notifRes.value.ok) {
        const json = await notifRes.value.json();
        setUnreadNotifications(json.pagination?.total ?? 0);
      }
    } catch {
      // non-critical
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCounts]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pb-16 md:pb-0">
      {/* Simplified Header with 3 elements */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* 1. Logo */}
          <div className="flex items-center gap-2">
            {pathname?.startsWith('/post') && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl bg-accent/30 hover:bg-accent/60 border border-border"
                onClick={() => router.back()}
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <Image
                  src={isDarkMode ? "/logo/green_logo.svg" : "/logo/black_logo.svg"}
                  alt="ments logo"
                  width={50}
                  height={50}
                  className="rounded-xl object-contain "
                  draggable={false}
                  priority
                />
              </div>
            </Link>
          </div>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* 1. Search */}
            <Link href="/search" className="relative inline-flex items-center justify-center h-10 w-10 rounded-xl transition-colors duration-200 active:scale-95 bg-accent/30 hover:bg-accent/60 border border-border">
              <Image src="/icons/search.svg" alt="Search" width={20} height={20} className="h-5 w-5" />
            </Link>

            {/* 2. Messages */}
            <Link href="/messages" className="relative inline-flex items-center justify-center h-10 w-10 rounded-xl transition-colors duration-200 active:scale-95 bg-accent/30 hover:bg-accent/60 border border-border">
              <Image src="/icons/message.svg" alt="Messages" width={20} height={20} className="h-5 w-5" />
              {unreadMessages > 0 && (
                <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full ring-2 ring-background"></div>
              )}
            </Link>

            {/* 3. Notifications */}
            <Link href="/notifications" className="relative inline-flex items-center justify-center h-10 w-10 rounded-xl transition-colors duration-200 active:scale-95 bg-accent/30 hover:bg-accent/60 border border-border">
              <Image src="/icons/notification.svg" alt="Notifications" width={20} height={20} className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-gradient-to-r from-red-500 to-pink-500 rounded-full ring-2 ring-background"></div>
              )}
            </Link>
          </div>
        </div>
      </header>
      
      {/* Mobile Navigation Bar */}
      <MobileNavBar />
      
      {/* Enhanced Main content area */}
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)]">
        {/* Sidebar Container - hidden on mobile, narrower on md, full on lg */}
        {shouldShowSidebar && (
          <div className="hidden md:block md:w-72 lg:w-80 xl:w-[340px] shrink-0 sticky top-20 h-[calc(100vh-5rem)] pt-6 pb-6">
            <div className="h-full pr-4 lg:pr-6">
              <div className="h-full bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-5 lg:p-6 shadow-sm hover:shadow-md transition-all duration-200">
                <Sidebar />
              </div>
            </div>
          </div>
        )}

        {/* Main Post Section */}
        <main className="flex-1 min-w-0 overflow-visible py-4 px-3 sm:py-6 sm:px-4 md:px-6 min-h-[500px]">
          <div className={fullWidth ? 'w-full' : 'max-w-5xl mx-auto'}>
            {children}
          </div>
        </main>

        {/* Right Side Components - only on xl+ */}
        {pathname === '/' && (
          <aside className="hidden xl:block w-[320px] shrink-0 pt-6 pb-6 pl-6">
            <DashboardSidebarWidgets />
          </aside>
        )}
      </div>
    </div>
  );
}