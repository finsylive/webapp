'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Compass, Rocket, TrendingUp, Users, ArrowRight, Sparkles, Check } from 'lucide-react';

type Interest = 'exploring' | 'building' | 'investing' | 'hiring';

interface InterestOption {
  id: Interest;
  title: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  borderColor: string;
  bgActive: string;
}

const INTERESTS: InterestOption[] = [
  {
    id: 'exploring',
    title: 'Discover & Connect',
    description: 'Explore startups, learn from builders, find community',
    icon: <Compass className="w-5 h-5" />,
    accentColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bgActive: 'bg-emerald-500/10',
  },
  {
    id: 'building',
    title: 'Build & Launch',
    description: 'Ship your startup, find co-founders, get resources',
    icon: <Rocket className="w-5 h-5" />,
    accentColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    bgActive: 'bg-amber-500/10',
  },
  {
    id: 'investing',
    title: 'Invest & Fund',
    description: 'Find promising startups, manage your deal flow',
    icon: <TrendingUp className="w-5 h-5" />,
    accentColor: 'text-violet-400',
    borderColor: 'border-violet-500/30',
    bgActive: 'bg-violet-500/10',
  },
  {
    id: 'hiring',
    title: 'Recruit Talent',
    description: 'Post jobs, find skilled people for your team',
    icon: <Users className="w-5 h-5" />,
    accentColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    bgActive: 'bg-blue-500/10',
  },
];

export default function OnboardingPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<Interest>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  const toggleInterest = (id: Interest) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (isSubmitting || selected.size === 0) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests: Array.from(selected) }),
      });

      const data = await res.json();

      if (res.ok && data.redirect) {
        router.push(data.redirect);
      } else {
        console.error('Onboarding failed:', data.error);
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Error during onboarding:', err);
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="h-screen bg-[#09090b] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500/70 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen h-[100dvh] bg-[#09090b] relative overflow-hidden font-[family-name:var(--font-manrope)]">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none hidden sm:block">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 sm:px-6">
        {/* Logo */}
        <div
          className={`flex items-center gap-2 mb-5 sm:mb-6 transition-all duration-700 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          <img src="/logo/green_logo.svg" alt="Ments" className="w-8 h-8" />
          <span className="text-white text-lg font-bold tracking-tight">ments</span>
        </div>

        {/* Header */}
        <div
          className={`text-center mb-6 sm:mb-8 transition-all duration-700 delay-100 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-3 sm:mb-4">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400 text-[10px] sm:text-xs font-semibold tracking-wide uppercase">
              Welcome aboard
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight mb-1.5 sm:mb-2">
            What brings you to{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Ments
            </span>
            ?
          </h1>
          <p className="text-neutral-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            Pick all that apply. This shapes your feed.
          </p>
        </div>

        {/* Interest chips */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm sm:max-w-lg mb-6 sm:mb-8">
          {INTERESTS.map((interest, index) => {
            const isActive = selected.has(interest.id);

            return (
              <button
                key={interest.id}
                onClick={() => toggleInterest(interest.id)}
                disabled={isSubmitting}
                className={`
                  group relative text-left rounded-xl border p-3.5 sm:p-4
                  transition-all duration-300 ease-out cursor-pointer
                  ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
                  ${isActive
                    ? `${interest.borderColor} ${interest.bgActive} ring-1 ring-white/5`
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                  }
                `}
                style={{ transitionDelay: `${200 + index * 80}ms` }}
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div
                    className={`
                      shrink-0 w-9 h-9 rounded-lg flex items-center justify-center
                      transition-colors duration-200
                      ${isActive
                        ? `${interest.bgActive} ${interest.accentColor}`
                        : 'bg-white/[0.06] text-neutral-500'
                      }
                    `}
                  >
                    {interest.icon}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white">{interest.title}</h3>
                    <p className="text-xs text-neutral-500 leading-relaxed mt-0.5">{interest.description}</p>
                  </div>

                  {/* Checkbox */}
                  <div
                    className={`
                      shrink-0 w-5 h-5 rounded-md border flex items-center justify-center
                      transition-all duration-200
                      ${isActive
                        ? `${interest.borderColor} ${interest.bgActive}`
                        : 'border-white/15 bg-transparent'
                      }
                    `}
                  >
                    {isActive && <Check className={`w-3 h-3 ${interest.accentColor}`} />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <button
          onClick={handleSubmit}
          disabled={selected.size === 0 || isSubmitting}
          className={`
            flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold
            transition-all duration-300
            ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
            ${selected.size > 0
              ? 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
              : 'bg-white/10 text-neutral-500 cursor-not-allowed'
            }
          `}
          style={{ transitionDelay: '600ms' }}
        >
          {isSubmitting ? (
            <div className="w-4 h-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
          ) : (
            <>
              Get Started
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Footer hint */}
        <p
          className={`mt-4 text-neutral-600 text-[10px] sm:text-xs text-center transition-all duration-700 delay-700 ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        >
          You can change this anytime in settings
        </p>
      </div>
    </div>
  );
}
