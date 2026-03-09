'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import { useRouter } from 'next/navigation';
import { Compass, TrendingUp, Rocket, ArrowRight, Sparkles, Check, AlertCircle, AtSign } from 'lucide-react';

type Role = 'explorer' | 'investor' | 'founder';

interface RoleOption {
    id: Role;
    title: string;
    subtitle: string;
    description: string;
    icon: React.ReactNode;
    gradient: string;
    accentColor: string;
    borderColor: string;
    bgHover: string;
    redirectLabel: string;
}

const ROLES: RoleOption[] = [
    {
        id: 'explorer',
        title: 'Explorer',
        subtitle: 'Discover & Connect',
        description: "Discover startups, learn from builders, and connect with the community.",
        icon: <Compass className="w-6 h-6" />,
        gradient: 'from-emerald-500 to-teal-600',
        accentColor: 'text-emerald-500',
        borderColor: 'border-emerald-500/30',
        bgHover: 'hover:bg-emerald-500/5',
        redirectLabel: 'Feed',
    },
    {
        id: 'investor',
        title: 'Investor',
        subtitle: 'Fund & Grow',
        description: "Looking for promising startups to invest in and help scale.",
        icon: <TrendingUp className="w-6 h-6" />,
        gradient: 'from-violet-500 to-purple-600',
        accentColor: 'text-violet-500',
        borderColor: 'border-violet-500/30',
        bgHover: 'hover:bg-violet-500/5',
        redirectLabel: 'Deal Flow',
    },
    {
        id: 'founder',
        title: 'Founder',
        subtitle: 'Build & Launch',
        description: "Building something and need support, resources, and co-founders.",
        icon: <Rocket className="w-6 h-6" />,
        gradient: 'from-amber-500 to-orange-600',
        accentColor: 'text-amber-500',
        borderColor: 'border-amber-500/30',
        bgHover: 'hover:bg-amber-500/5',
        redirectLabel: 'My Startup',
    },
];

export default function OnboardingPage() {
    const { user, isLoading: authLoading } = useAuth();
    const { userData, loading: userDataLoading } = useUserData();
    const router = useRouter();

    // Step 1 = role selection, Step 2 = username selection
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Username step state
    const [username, setUsername] = useState('');
    const [usernameError, setUsernameError] = useState('');
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/');
        }
    }, [authLoading, user, router]);

    // Redirect if already onboarded — prevents back-button role change
    useEffect(() => {
        if (!authLoading && !userDataLoading && userData?.is_onboarding_done) {
            router.replace('/');
        }
    }, [authLoading, userDataLoading, userData, router]);

    // Pre-fill username from current auto-generated one
    useEffect(() => {
        if (userData?.username && !username) {
            setUsername(userData.username);
        }
    }, [userData, username]);

    // Debounced username availability check
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        const trimmed = username.trim().toLowerCase();

        // Client-side validation
        if (!trimmed) {
            setUsernameError('');
            setUsernameAvailable(null);
            return;
        }
        if (trimmed.length < 3) {
            setUsernameError('Username must be at least 3 characters');
            setUsernameAvailable(null);
            return;
        }
        if (trimmed.length > 20) {
            setUsernameError('Username must be 20 characters or less');
            setUsernameAvailable(null);
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
            setUsernameError('Only letters, numbers, and underscores allowed');
            setUsernameAvailable(null);
            return;
        }

        setUsernameError('');
        setCheckingUsername(true);
        setUsernameAvailable(null);

        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/username/check?username=${encodeURIComponent(trimmed)}`);
                const data = await res.json();
                if (data.available || trimmed === userData?.username) {
                    setUsernameAvailable(true);
                    setUsernameError('');
                } else {
                    setUsernameAvailable(false);
                    setUsernameError('Username is already taken');
                }
            } catch {
                setUsernameError('Could not check username');
            } finally {
                setCheckingUsername(false);
            }
        }, 400);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [username, userData?.username]);

    const handleRoleSelect = (role: Role) => {
        if (isSubmitting) return;
        setSelectedRole(role);
        // Move to username step after a brief animation
        setTimeout(() => {
            setStep(2);
        }, 400);
    };

    const handleSubmit = async () => {
        if (isSubmitting || !selectedRole) return;

        const trimmedUsername = username.trim().toLowerCase();

        // Validate username
        if (!trimmedUsername || trimmedUsername.length < 3) {
            setUsernameError('Username must be at least 3 characters');
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
            setUsernameError('Only letters, numbers, and underscores allowed');
            return;
        }
        if (usernameAvailable === false) {
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await fetch('/api/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_type: selectedRole, username: trimmedUsername }),
            });

            const data = await res.json();

            if (res.ok && data.redirect) {
                setTimeout(() => {
                    router.replace(data.redirect);
                }, 400);
            } else {
                if (data.error?.includes('username')) {
                    setUsernameError(data.error);
                }
                setIsSubmitting(false);
            }
        } catch (err) {
            console.error('Error during onboarding:', err);
            setIsSubmitting(false);
        }
    };

    // Loading state
    if (authLoading || !user || userDataLoading) {
        return (
            <div className="h-screen bg-[#09090b] flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-500/70 border-t-transparent animate-spin" />
            </div>
        );
    }

    // Already onboarded — show loading while redirecting
    if (userData?.is_onboarding_done) {
        return (
            <div className="h-screen bg-[#09090b] flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-500/70 border-t-transparent animate-spin" />
            </div>
        );
    }

    const selectedRoleData = ROLES.find(r => r.id === selectedRole);

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
                    className={`flex items-center gap-2 mb-5 sm:mb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
                        }`}
                >
                    <img src="/logo/green_logo.svg" alt="Ments" className="w-8 h-8" />
                    <span className="text-white text-lg font-bold tracking-tight">ments</span>
                </div>

                {/* Step indicator */}
                <div className={`flex items-center gap-2 mb-6 transition-all duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
                    <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${step >= 1 ? 'bg-emerald-500' : 'bg-white/20'}`} />
                    <div className={`w-6 h-0.5 transition-colors duration-300 ${step >= 2 ? 'bg-emerald-500' : 'bg-white/10'}`} />
                    <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${step >= 2 ? 'bg-emerald-500' : 'bg-white/20'}`} />
                </div>

                {/* ── STEP 1: Role Selection ── */}
                {step === 1 && (
                    <>
                        <div
                            className={`text-center mb-6 sm:mb-8 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                                }`}
                        >
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-3 sm:mb-4">
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400 text-[10px] sm:text-xs font-semibold tracking-wide uppercase">Welcome aboard</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight mb-1.5 sm:mb-2">
                                What brings you to{' '}
                                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                                    Ments
                                </span>
                                ?
                            </h1>
                            <p className="text-neutral-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
                                Choose your path and we&apos;ll personalize your experience
                            </p>
                        </div>

                        {/* Role Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-sm sm:max-w-2xl lg:max-w-3xl">
                            {ROLES.map((role, index) => {
                                const isSelected = selectedRole === role.id;
                                const isOther = selectedRole !== null && !isSelected;

                                return (
                                    <button
                                        key={role.id}
                                        onClick={() => handleRoleSelect(role.id)}
                                        disabled={isSubmitting}
                                        className={`
                                            group relative text-left rounded-2xl border
                                            p-4 sm:p-5
                                            transition-all duration-500 ease-out cursor-pointer
                                            ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
                                            ${isSelected
                                                ? `${role.borderColor} bg-white/[0.04] scale-[1.02] shadow-2xl ring-1 ring-white/10`
                                                : isOther
                                                    ? 'border-white/5 bg-white/[0.01] opacity-40 scale-[0.97]'
                                                    : `border-white/10 bg-white/[0.02] ${role.bgHover} hover:border-white/20 hover:scale-[1.02] hover:shadow-xl`
                                            }
                                        `}
                                        style={{ transitionDelay: `${200 + index * 100}ms` }}
                                    >
                                        {/* Selected glow */}
                                        {isSelected && (
                                            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${role.gradient} opacity-[0.06]`} />
                                        )}

                                        {/* Mobile: horizontal — Desktop: vertical */}
                                        <div className="flex sm:block items-center gap-3">
                                            <div
                                                className={`
                                                    relative shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center sm:mb-3
                                                    transition-all duration-300
                                                    ${isSelected
                                                        ? `bg-gradient-to-br ${role.gradient} text-white shadow-lg`
                                                        : `bg-white/[0.06] ${role.accentColor} group-hover:bg-white/10`
                                                    }
                                                `}
                                            >
                                                {role.icon}
                                            </div>

                                            <div className="relative flex-1 min-w-0">
                                                <h3 className="text-sm sm:text-base font-bold text-white">{role.title}</h3>
                                                <p className={`text-[10px] sm:text-xs font-semibold ${isSelected ? role.accentColor : 'text-neutral-500'}`}>
                                                    {role.subtitle}
                                                </p>
                                                <p className="text-xs text-neutral-400 leading-relaxed mt-1 hidden sm:block">{role.description}</p>
                                            </div>

                                            {/* Mobile arrow */}
                                            <div className="sm:hidden shrink-0">
                                                <ArrowRight className={`w-4 h-4 transition-all duration-300 ${isSelected ? role.accentColor : 'text-neutral-600'}`} />
                                            </div>
                                        </div>

                                        {/* Desktop arrow */}
                                        <div
                                            className={`
                                                hidden sm:flex mt-3 items-center gap-1.5 text-xs font-semibold transition-all duration-300
                                                ${isSelected ? `${role.accentColor} translate-x-1` : 'text-neutral-600 group-hover:text-neutral-400'}
                                            `}
                                        >
                                            <span>{isSelected ? `Going to ${role.redirectLabel}` : 'Select'}</span>
                                            <ArrowRight className={`w-3.5 h-3.5 transition-transform duration-300 ${isSelected ? 'translate-x-1' : 'group-hover:translate-x-0.5'}`} />
                                        </div>

                                        {/* Loading spinner */}
                                        {isSelected && (
                                            <div className="absolute top-3 right-3">
                                                <div className={`w-4 h-4 rounded-full border-2 border-t-transparent animate-spin ${role.borderColor}`} />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <p
                            className={`mt-4 sm:mt-6 text-neutral-600 text-[10px] sm:text-xs text-center transition-all duration-700 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'
                                }`}
                        >
                            You can change this later in your settings
                        </p>
                    </>
                )}

                {/* ── STEP 2: Username Selection ── */}
                {step === 2 && selectedRoleData && (
                    <div className="w-full max-w-md animate-in fade-in-0 slide-in-from-right-4 duration-500">
                        <div className="text-center mb-6 sm:mb-8">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${selectedRoleData.gradient} bg-opacity-10 border ${selectedRoleData.borderColor} mb-3 sm:mb-4`}>
                                <Check className="w-3 h-3 text-white" />
                                <span className="text-white text-[10px] sm:text-xs font-semibold tracking-wide uppercase">
                                    {selectedRoleData.title} selected
                                </span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight mb-1.5 sm:mb-2">
                                Choose your{' '}
                                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                                    username
                                </span>
                            </h1>
                            <p className="text-neutral-400 text-sm sm:text-base max-w-sm mx-auto leading-relaxed">
                                This is how others will find and mention you
                            </p>
                        </div>

                        {/* Username input card */}
                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 sm:p-6">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <AtSign className="w-4 h-4 text-neutral-500" />
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                                    placeholder="your_username"
                                    maxLength={20}
                                    autoFocus
                                    className={`
                                        w-full bg-white/[0.05] border rounded-xl pl-10 pr-10 py-3.5
                                        text-white text-sm placeholder:text-neutral-600
                                        focus:outline-none focus:ring-2 transition-all duration-200
                                        ${usernameError
                                            ? 'border-red-500/50 focus:ring-red-500/30'
                                            : usernameAvailable
                                                ? 'border-emerald-500/50 focus:ring-emerald-500/30'
                                                : 'border-white/10 focus:ring-emerald-500/30 focus:border-emerald-500/30'
                                        }
                                    `}
                                />
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                                    {checkingUsername && (
                                        <div className="w-4 h-4 rounded-full border-2 border-emerald-500/50 border-t-transparent animate-spin" />
                                    )}
                                    {!checkingUsername && usernameAvailable && (
                                        <Check className="w-4 h-4 text-emerald-500" />
                                    )}
                                    {!checkingUsername && usernameError && (
                                        <AlertCircle className="w-4 h-4 text-red-500" />
                                    )}
                                </div>
                            </div>

                            {/* Error / availability message */}
                            <div className="mt-2 h-5">
                                {usernameError && (
                                    <p className="text-red-400 text-xs">{usernameError}</p>
                                )}
                                {!usernameError && usernameAvailable && (
                                    <p className="text-emerald-400 text-xs">Username is available</p>
                                )}
                            </div>

                            {/* Hints */}
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className="text-[10px] text-neutral-600 bg-white/[0.03] px-2 py-1 rounded-md">3-20 characters</span>
                                <span className="text-[10px] text-neutral-600 bg-white/[0.03] px-2 py-1 rounded-md">Letters, numbers, _</span>
                            </div>

                            {/* Submit button */}
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !username.trim() || !!usernameError || checkingUsername || usernameAvailable === false}
                                className={`
                                    w-full mt-5 py-3.5 rounded-xl font-semibold text-sm
                                    flex items-center justify-center gap-2
                                    transition-all duration-300
                                    ${isSubmitting || !username.trim() || !!usernameError || checkingUsername || usernameAvailable === false
                                        ? 'bg-white/[0.05] text-neutral-600 cursor-not-allowed'
                                        : `bg-gradient-to-r ${selectedRoleData.gradient} text-white hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98]`
                                    }
                                `}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 rounded-full border-2 border-white/50 border-t-transparent animate-spin" />
                                        <span>Setting up...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Continue as @{username.trim() || '...'}</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Back to role selection */}
                        <button
                            onClick={() => { setStep(1); setSelectedRole(null); }}
                            disabled={isSubmitting}
                            className="mt-4 w-full text-center text-neutral-600 hover:text-neutral-400 text-xs transition-colors"
                        >
                            ← Change role
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
