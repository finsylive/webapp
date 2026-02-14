// top bar 
"use client";

import { ReactNode } from 'react';
import { useTheme } from '@/context/theme/ThemeContext';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { MobileNavBar } from './MobileNavBar';
import DashboardSidebarWidgets from './DashboardSidebarWidgets';
import { ArrowLeft } from 'lucide-react';

type DashboardLayoutProps = {
  children: ReactNode;
  showSidebar?: boolean;
};

export function DashboardLayout({ children, showSidebar }: DashboardLayoutProps) {
  const { isDarkMode } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const shouldShowSidebar = typeof showSidebar === 'boolean' ? showSidebar : !(pathname?.startsWith('/post'));

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

          {/* Spacer to push right elements to the end */}
          <div className="flex-1"></div>
          
          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* 1. Messages */}
            <Link href="/messages" className="relative inline-flex items-center justify-center h-10 w-10 rounded-xl transition-colors duration-200 active:scale-95 bg-accent/30 hover:bg-accent/60 border border-border">
              <Image src="/icons/message.svg" alt="Messages" width={20} height={20} className="h-5 w-5" />
              <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full ring-2 ring-background"></div>
            </Link>
            
            {/* 2. Notifications */}
            <Link href="/notifications" className="relative inline-flex items-center justify-center h-10 w-10 rounded-xl transition-colors duration-200 active:scale-95 bg-accent/30 hover:bg-accent/60 border border-border">
              <Image src="/icons/notification.svg" alt="Notifications" width={20} height={20} className="h-5 w-5" />
              <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-gradient-to-r from-red-500 to-pink-500 rounded-full ring-2 ring-background"></div>
            </Link>
          </div>
        </div>
      </header>
      
      {/* Mobile Navigation Bar */}
      <MobileNavBar />
      
      {/* Enhanced Main content area */}
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)]">
        {/* Enhanced Sidebar Container */}
        {shouldShowSidebar && (
          <div className="hidden md:block w-80 sticky top-20 h-[calc(100vh-5rem)] pt-6 pb-6">
            <div className="h-full pr-6">
              <div className="h-full bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-7 shadow-sm hover:shadow-md transition-all duration-200">
                <Sidebar />
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Main Post Section */}
        <main className="flex-1 overflow-hidden py-6 px-4 md:px-6 min-h-[500px]">
          <div className="max-w-2xl mx-auto lg:max-w-none">
            {children}
          </div>
        </main>

        {/* Enhanced Right Side Components */}
        {pathname === '/' && (
          <aside className="hidden lg:block w-80 pt-6 pb-6 pl-6">
            <DashboardSidebarWidgets />
          </aside>
        )}
      </div>
    </div>
  );
}