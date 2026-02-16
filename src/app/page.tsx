'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PostList } from '@/components/posts/PostList';
import { FounderDashboard } from '@/components/dashboard/FounderDashboard';
import { InvestorDashboard } from '@/components/dashboard/InvestorDashboard';
import { useUserProfile } from '@/hooks/useUserProfile';

import { ArrowRight } from 'lucide-react';

const HomePage = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const { user, isLoading, signInWithGoogle } = useAuth();
  const { isFounder, isInvestor, needsOnboarding, isLoading: profileLoading } = useUserProfile();
  const router = useRouter();

  // Default environment ID - in a real app, this would be dynamically selected
  const defaultEnvironmentId = '00000000-0000-0000-0000-000000000000';

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    setIsVisible(true);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Client-side onboarding guard (fallback for middleware)
  useEffect(() => {
    if (!profileLoading && user && needsOnboarding) {
      console.log('[HomePage] User needs onboarding, redirecting...');
      router.push('/onboarding');
    }
  }, [profileLoading, user, needsOnboarding, router]);

  const handleGoogleSignIn = async () => {
    console.log('Google sign-in clicked');
    await signInWithGoogle();
  };

  // Show loading state while checking authentication or profile
  if (isLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/70 border-t-transparent animate-spin shadow-lg" aria-label="Loading" />
      </div>
    );
  }

  // If user needs onboarding, show loading (redirect is happening)
  if (user && needsOnboarding) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/70 border-t-transparent animate-spin shadow-lg" aria-label="Loading" />
      </div>
    );
  }

  // If user is logged in and onboarded, show role-specific dashboard with feed below
  if (user) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          {/* Role-specific dashboard */}
          {isFounder && <FounderDashboard />}
          {isInvestor && <InvestorDashboard />}

          {/* Feed Content — shown for all roles */}
          <div className="animate-in fade-in-50 duration-300">
            <div className="space-y-8">
              <PostList
                environmentId={defaultEnvironmentId}
              />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Enhanced login page for non-authenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950/90 to-slate-900 relative overflow-hidden">

      {/* Enhanced Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient Orbs with better positioning */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-emerald-500/15 to-teal-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-blue-500/15 to-indigo-500/10 rounded-full blur-3xl animate-pulse delay-700"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-purple-500/10 to-pink-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>

        {/* Enhanced moving cursor effect */}
        <div
          className="absolute w-8 h-8 bg-gradient-to-r from-emerald-400/30 to-teal-400/20 rounded-full blur-sm transition-all duration-500 ease-out pointer-events-none"
          style={{
            left: mousePosition.x - 16,
            top: mousePosition.y - 16,
          }}
        ></div>

        {/* Enhanced Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-60"></div>

        {/* Additional decorative elements */}
        <div className="absolute top-20 left-1/3 w-32 h-32 bg-emerald-400/5 rounded-full blur-2xl animate-pulse delay-300"></div>
        <div className="absolute bottom-32 right-1/3 w-24 h-24 bg-blue-400/5 rounded-full blur-2xl animate-pulse delay-800"></div>
      </div>

      {/* Enhanced Main Content */}
      <div className={`relative z-10 min-h-screen flex items-center justify-center p-4 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="w-full max-w-lg">

          {/* Enhanced Logo Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-8">
              <div className="w-4 h-4 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/25"></div>
              <h1 className="text-7xl font-black text-white tracking-tight bg-gradient-to-r from-white via-emerald-100 to-white bg-clip-text">
                ments
              </h1>
              <div className="w-3 h-3 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full shadow-lg shadow-emerald-400/25"></div>
            </div>

            <div className="space-y-3">
              <p className="text-2xl text-emerald-300 font-light tracking-wide">
                Where Ideas Meet Execution
              </p>
              <p className="text-base text-slate-400 font-medium">
                Connect • Innovate • Build Together
              </p>
            </div>
          </div>

          {/* Enhanced Login Card */}
          <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 border border-white/20 rounded-3xl p-10 shadow-2xl shadow-black/20">

            {/* Enhanced Welcome Text */}
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-3 bg-gradient-to-r from-white to-emerald-100 bg-clip-text">
                Welcome Back
              </h2>
              <p className="text-slate-300 text-base">
                Sign in to continue your innovation journey
              </p>
            </div>

            {/* Enhanced Google Sign In Button */}
            <button
              onClick={handleGoogleSignIn}
              className="group w-full bg-gradient-to-r from-white to-slate-50 hover:from-slate-50 hover:to-white text-slate-900 font-semibold py-6 px-8 rounded-2xl flex items-center justify-center gap-4 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-white/10 active:scale-[0.98] mb-10 border border-white/20"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="group-hover:translate-x-1 transition-transform duration-300 flex items-center gap-2">
                Continue with Google
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </span>
            </button>

            {/* Enhanced Additional Info */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-300 px-4 py-2 rounded-full text-sm font-medium border border-emerald-500/20">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                Quick, secure, and seamless authentication
              </div>
            </div>

            {/* Enhanced Terms */}
            <div className="text-center text-sm text-slate-400 leading-relaxed">
              By continuing, you agree to our{' '}
              <button className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors duration-200 font-medium">
                Terms of Service
              </button>
              {' '}and{' '}
              <button className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors duration-200 font-medium">
                Privacy Policy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Floating Elements */}
      <div className="absolute top-24 left-24 w-3 h-3 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full animate-ping shadow-lg shadow-emerald-400/50"></div>
      <div className="absolute top-48 right-36 w-2 h-2 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full animate-ping delay-500 shadow-lg shadow-blue-400/50"></div>
      <div className="absolute bottom-36 left-20 w-2 h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-ping delay-1000 shadow-lg shadow-purple-400/50"></div>
      <div className="absolute top-1/3 right-16 w-1 h-1 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-ping delay-1500"></div>
      <div className="absolute bottom-1/3 left-1/4 w-1.5 h-1.5 bg-gradient-to-r from-rose-400 to-pink-400 rounded-full animate-ping delay-2000"></div>

    </div>
  );
};

export default HomePage;