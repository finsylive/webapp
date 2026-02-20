'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PersonalizedFeed } from '@/components/feed/PersonalizedFeed';

import { ArrowRight, Users, Rocket, Sparkles } from 'lucide-react';

const HomePage = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const { user, isLoading, signInWithGoogle } = useAuth();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    setIsVisible(true);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleGoogleSignIn = async () => {
    console.log('Google sign-in clicked');
    await signInWithGoogle();
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/70 border-t-transparent animate-spin shadow-lg" aria-label="Loading" />
      </div>
    );
  }

  // If user is logged in, show dashboard with only feed
  if (user) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="animate-in fade-in-50 duration-300">
            <PersonalizedFeed />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Professional light mode login
  return (
    <div className={`min-h-screen bg-white flex flex-col lg:flex-row transition-opacity duration-700 font-[family-name:var(--font-manrope)] ${isVisible ? 'opacity-100' : 'opacity-0'}`}>

      {/* ===== LEFT — Brand panel ===== */}
      <div className="relative lg:w-[52%] w-full lg:min-h-screen bg-[#09090b] overflow-hidden">

        <div className="relative z-10 h-full flex flex-col px-6 py-8 sm:px-10 sm:py-10 lg:px-16 lg:py-14">

          {/* Top — Logo + wordmark */}
          <div className="flex items-center gap-2.5">
            <img src="/logo/green_logo.svg" alt="Ments" className="w-8 h-8" />
            <span className="text-white text-base font-bold tracking-tight">ments</span>
          </div>

          {/* Center hero */}
          <div className="flex-1 flex flex-col justify-center py-10 sm:py-16 lg:py-0 max-w-lg">

            {/* Large logo */}
            <img
              src="/logo/green_logo.svg"
              alt="Ments"
              className="w-24 h-24 lg:w-32 lg:h-32 mb-10"
            />

            {/* Big headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-extrabold text-white tracking-tight leading-[1.1] mb-4 sm:mb-6">
              Build the future,{' '}
              <span className="text-emerald-400">together.</span>
            </h1>

            <p className="text-neutral-400 text-base sm:text-lg leading-relaxed mb-8 sm:mb-12 max-w-md">
              Ments brings builders, designers, and dreamers onto one platform to turn bold ideas into real products.
            </p>

            {/* Social proof — desktop only */}
            <div className="hidden lg:block">
              {/* Avatars + count */}
              <div className="flex items-center gap-4 mb-8">
                <div className="flex -space-x-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 border-2 border-[#09090b] flex items-center justify-center text-emerald-400 text-xs font-bold">A</div>
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 border-2 border-[#09090b] flex items-center justify-center text-emerald-400 text-xs font-bold">K</div>
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 border-2 border-[#09090b] flex items-center justify-center text-emerald-400 text-xs font-bold">R</div>
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 border-2 border-[#09090b] flex items-center justify-center text-emerald-400 text-xs font-bold">S</div>
                  <div className="w-9 h-9 rounded-full bg-white/10 border-2 border-[#09090b] flex items-center justify-center text-white text-xs font-bold">+</div>
                </div>
                <p className="text-neutral-400 text-sm">
                  <span className="text-white font-semibold">500+</span> builders already on Ments
                </p>
              </div>

              {/* Testimonial */}
              <div className="border-l-2 border-emerald-500/30 pl-5">
                <p className="text-neutral-300 text-[15px] leading-relaxed italic">
                  &ldquo;Ments helped me find the perfect co-founder. We went from idea to launch in 3 months.&rdquo;
                </p>
                <p className="text-neutral-500 text-sm mt-3">
                  — Arjun K., Founder at BuildStack
                </p>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <p className="text-neutral-700 text-xs hidden lg:block">&copy; 2025 Ments. All rights reserved.</p>
        </div>
      </div>

      {/* ===== RIGHT — Sign in ===== */}
      <div className="lg:w-[48%] w-full lg:min-h-screen flex flex-col bg-neutral-50">

        <div className="flex-1 flex items-center justify-center px-4 py-10 sm:px-8 sm:py-14 lg:px-16">
          <div className="w-full max-w-[420px]">

            {/* Mobile logo */}
            <div className="flex items-center justify-center gap-3 mb-10 lg:hidden">
              <img src="/logo/green_logo.svg" alt="Ments" className="w-12 h-12" />
              <span className="text-2xl font-bold text-neutral-900 tracking-tight">ments</span>
            </div>

            {/* Sign in card */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-8 lg:p-10 shadow-sm">

              {/* Heading */}
              <h2 className="text-2xl lg:text-3xl font-bold text-neutral-900 tracking-tight mb-1.5">
                Welcome back
              </h2>
              <p className="text-neutral-500 text-base mb-8">
                Sign in to continue to Ments
              </p>

              {/* Google Sign In */}
              <button
                onClick={handleGoogleSignIn}
                className="group w-full bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-base py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all duration-200 hover:shadow-lg active:scale-[0.98] mb-6"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
                <ArrowRight className="w-4 h-4 text-neutral-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-neutral-200"></div>
                <span className="text-xs text-neutral-400 font-medium">QUICK & SECURE</span>
                <div className="flex-1 h-px bg-neutral-200"></div>
              </div>

              {/* Trust signals */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-500 text-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  Secure login
                </div>
                <div className="flex items-center gap-2 text-neutral-500 text-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  No passwords
                </div>
                <div className="flex items-center gap-2 text-neutral-500 text-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  Free forever
                </div>
              </div>
            </div>

            {/* Stats row below card */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 sm:mt-6">
              <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4 text-center">
                <p className="text-xl sm:text-2xl font-bold text-neutral-900">500+</p>
                <p className="text-[10px] sm:text-xs text-neutral-400 mt-1">Builders</p>
              </div>
              <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4 text-center">
                <p className="text-xl sm:text-2xl font-bold text-neutral-900">50+</p>
                <p className="text-[10px] sm:text-xs text-neutral-400 mt-1">Startups</p>
              </div>
              <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4 text-center">
                <p className="text-xl sm:text-2xl font-bold text-neutral-900">1K+</p>
                <p className="text-[10px] sm:text-xs text-neutral-400 mt-1">Projects</p>
              </div>
            </div>

            {/* Terms */}
            <p className="text-xs text-neutral-400 leading-relaxed mt-6 text-center">
              By continuing, you agree to our{' '}
              <button className="text-neutral-500 hover:text-neutral-800 underline underline-offset-2 transition-colors">
                Terms of Service
              </button>
              {' '}and{' '}
              <button className="text-neutral-500 hover:text-neutral-800 underline underline-offset-2 transition-colors">
                Privacy Policy
              </button>
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default HomePage;