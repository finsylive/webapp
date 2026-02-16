"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { Rocket, TrendingUp, Briefcase, ArrowRight } from 'lucide-react';

const roles = [
    {
        id: 'founder',
        icon: Rocket,
        title: "I'm Building",
        subtitle: 'Create a startup, find investors & talent',
        gradient: 'from-orange-500 to-amber-500',
        ring: 'ring-orange-500/50',
        shadow: 'shadow-orange-500/20',
        bgHover: 'hover:border-orange-500/50',
        iconBg: 'bg-orange-500/10',
    },
    {
        id: 'investor',
        icon: TrendingUp,
        title: "I'm Investing",
        subtitle: 'Discover startups, connect with founders',
        gradient: 'from-emerald-500 to-teal-500',
        ring: 'ring-emerald-500/50',
        shadow: 'shadow-emerald-500/20',
        bgHover: 'hover:border-emerald-500/50',
        iconBg: 'bg-emerald-500/10',
    },
    {
        id: 'normal_user',
        icon: Briefcase,
        title: "I'm Exploring",
        subtitle: 'Find opportunities, build your network',
        gradient: 'from-blue-500 to-indigo-500',
        ring: 'ring-blue-500/50',
        shadow: 'shadow-blue-500/20',
        bgHover: 'hover:border-blue-500/50',
        iconBg: 'bg-blue-500/10',
    },
] as const;

export default function OnboardingPage() {
    const router = useRouter();
    const { user, isLoading } = useAuth();
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/');
        }
    }, [user, isLoading, router]);

    const handleRoleSelect = async (roleId: string) => {
        setSelectedRole(roleId);
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/users/onboarding', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_type: roleId,
                    onboarding_step: 1,
                }),
            });

            if (!res.ok) throw new Error('Failed to update role');

            // Redirect to role-specific wizard
            const wizardPaths: Record<string, string> = {
                founder: '/onboarding/founder',
                investor: '/onboarding/investor',
                normal_user: '/onboarding/job-seeker',
            };
            router.push(wizardPaths[roleId] || '/onboarding/job-seeker');
        } catch (error) {
            console.error('Error selecting role:', error);
            setSelectedRole(null);
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-primary/70 border-t-transparent animate-spin" />
            </div>
        );
    }

    return (
        <OnboardingLayout
            title="What brings you here?"
            subtitle="Choose your path — you can always explore other features later"
        >
            <div className="grid gap-4 md:grid-cols-3">
                {roles.map((role) => {
                    const Icon = role.icon;
                    const isSelected = selectedRole === role.id;

                    return (
                        <button
                            key={role.id}
                            onClick={() => handleRoleSelect(role.id)}
                            disabled={isSubmitting}
                            className={`
                group relative flex flex-col items-center text-center p-8 rounded-2xl border border-white/10
                backdrop-blur-xl bg-white/5 transition-all duration-300 cursor-pointer
                ${role.bgHover}
                ${isSelected ? `ring-2 ${role.ring} border-transparent scale-[1.02]` : ''}
                ${isSubmitting && !isSelected ? 'opacity-50 pointer-events-none' : ''}
                hover:bg-white/10 hover:shadow-xl ${role.shadow} hover:scale-[1.02]
                active:scale-[0.98]
                disabled:cursor-not-allowed
              `}
                        >
                            {/* Icon */}
                            <div className={`w-16 h-16 rounded-2xl ${role.iconBg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                                <Icon className={`w-8 h-8 bg-gradient-to-r ${role.gradient} bg-clip-text`}
                                    style={{ color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text' }}
                                />
                                {/* Fallback: just use the gradient start color */}
                                <Icon className={`w-8 h-8 absolute`}
                                    style={{ color: role.gradient.includes('orange') ? '#f97316' : role.gradient.includes('emerald') ? '#10b981' : '#3b82f6' }}
                                />
                            </div>

                            {/* Text */}
                            <h3 className="text-lg font-bold text-white mb-2">{role.title}</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">{role.subtitle}</p>

                            {/* Arrow indicator */}
                            <div className={`
                mt-5 flex items-center gap-1 text-xs font-medium transition-all duration-300
                ${isSelected && isSubmitting ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}
              `}>
                                {isSelected && isSubmitting ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span className="ml-1">Setting up...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Get started</span>
                                        <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </OnboardingLayout>
    );
}
