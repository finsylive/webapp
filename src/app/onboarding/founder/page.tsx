"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { StepIndicator } from '@/components/onboarding/StepIndicator';
import { ArrowRight, ArrowLeft } from 'lucide-react';

const STAGES = [
    { value: 'idea', label: 'Idea Stage' },
    { value: 'pre_seed', label: 'Pre-Seed' },
    { value: 'seed', label: 'Seed' },
    { value: 'series_a', label: 'Series A' },
    { value: 'series_b_plus', label: 'Series B+' },
    { value: 'profitable', label: 'Profitable' },
];

const TEAM_SIZES = [
    { value: 'solo', label: 'Solo Founder' },
    { value: '2_5', label: '2–5 people' },
    { value: '6_20', label: '6–20 people' },
    { value: '21_50', label: '21–50 people' },
    { value: '50_plus', label: '50+ people' },
];

const LOOKING_FOR_OPTIONS = [
    { value: 'funding', label: '💰 Funding' },
    { value: 'co_founder', label: '🤝 Co-Founder' },
    { value: 'mentorship', label: '🧠 Mentorship' },
    { value: 'talent', label: '👥 Talent' },
    { value: 'partnerships', label: '🔗 Partnerships' },
];

const STEP_LABELS = ['About You', 'Your Startup', 'Your Needs'];

export default function FounderOnboarding() {
    const router = useRouter();
    const { user, isLoading } = useAuth();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Step 1: Personal
    const [personal, setPersonal] = useState({
        full_name: '',
        username: '',
        tagline: '',
        linkedin: '',
    });

    // Step 2: Startup
    const [startup, setStartup] = useState({
        company_name: '',
        industry: '',
        stage: '',
        team_size: '',
        pitch: '',
    });

    // Step 3: Needs
    const [needs, setNeeds] = useState({
        looking_for: [] as string[],
        is_actively_raising: false,
        raise_amount: '',
        location: '',
        website: '',
    });

    // Pre-fill from existing user data
    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/');
            return;
        }
        if (user) {
            fetch('/api/users/onboarding')
                .then(res => res.json())
                .then(data => {
                    if (data && !data.error) {
                        setPersonal(prev => ({
                            ...prev,
                            full_name: data.full_name || '',
                            username: data.username || '',
                            tagline: data.tagline || '',
                        }));
                        // Resume from saved step if applicable
                        if (data.onboarding_step > 1) {
                            setStep(Math.min(data.onboarding_step, 3));
                        }
                    }
                })
                .catch(console.error);
        }
    }, [user, isLoading, router]);

    const handlePersonalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPersonal(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleStartupChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setStartup(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleNeedsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNeeds(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const toggleLookingFor = (value: string) => {
        setNeeds(prev => ({
            ...prev,
            looking_for: prev.looking_for.includes(value)
                ? prev.looking_for.filter(v => v !== value)
                : [...prev.looking_for, value],
        }));
    };

    const saveStep = async (nextStep: number) => {
        try {
            await fetch('/api/users/onboarding', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    onboarding_step: nextStep,
                    profile_updates: {
                        full_name: personal.full_name.trim(),
                        username: personal.username.trim().toLowerCase(),
                        tagline: personal.tagline.trim() || null,
                    },
                }),
            });
        } catch (error) {
            console.error('Error saving step:', error);
        }
    };

    const handleNext = async () => {
        if (step < 3) {
            await saveStep(step + 1);
            setStep(step + 1);
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleComplete = async () => {
        setIsSubmitting(true);

        try {
            // 1. Save user profile updates and mark onboarding done
            const profileRes = await fetch('/api/users/onboarding', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    is_onboarding_done: true,
                    onboarding_step: 3,
                    profile_updates: {
                        full_name: personal.full_name.trim(),
                        username: personal.username.trim().toLowerCase(),
                        tagline: personal.tagline.trim() || null,
                    },
                }),
            });

            if (!profileRes.ok) throw new Error('Failed to update profile');

            // 2. Create founder profile
            const founderRes = await fetch('/api/users/' + personal.username.trim().toLowerCase() + '/founder-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company_name: startup.company_name.trim(),
                    industry: startup.industry.trim() || null,
                    stage: startup.stage || null,
                    team_size: startup.team_size || null,
                    pitch: startup.pitch.trim() || null,
                    looking_for: needs.looking_for,
                    is_actively_raising: needs.is_actively_raising,
                    raise_amount: needs.raise_amount.trim() || null,
                    location: needs.location.trim() || null,
                    website: needs.website.trim() || null,
                    linkedin: personal.linkedin.trim() || null,
                }),
            });

            if (!founderRes.ok) {
                console.warn('Founder profile creation failed, but onboarding was marked done');
            }

            // Redirect to home
            window.location.href = '/';
        } catch (error) {
            console.error('Error completing onboarding:', error);
            setIsSubmitting(false);
        }
    };

    const isStep1Valid = personal.full_name.trim() && personal.username.trim();
    const isStep2Valid = startup.company_name.trim();
    const isStep3Valid = true; // all optional

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-primary/70 border-t-transparent animate-spin" />
            </div>
        );
    }

    return (
        <OnboardingLayout title="Founder Setup" subtitle="Let's set up your founder profile">
            <StepIndicator currentStep={step} totalSteps={3} labels={STEP_LABELS} />

            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8">
                {/* Step 1: Personal */}
                {step === 1 && (
                    <div className="space-y-5 animate-in fade-in-50 duration-300">
                        <h3 className="text-lg font-semibold text-white mb-4">Tell us about yourself</h3>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name *</label>
                            <input
                                type="text" name="full_name" value={personal.full_name} onChange={handlePersonalChange}
                                required placeholder="Jane Smith"
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Username *</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">@</span>
                                <input
                                    type="text" name="username" value={personal.username} onChange={handlePersonalChange}
                                    required placeholder="janesmith"
                                    className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Tagline</label>
                            <input
                                type="text" name="tagline" value={personal.tagline} onChange={handlePersonalChange}
                                maxLength={60} placeholder="Founder @ YourStartup | Building the future"
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                            />
                            <p className="text-xs text-slate-500 mt-1">{personal.tagline.length}/60</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">LinkedIn Profile</label>
                            <input
                                type="url" name="linkedin" value={personal.linkedin} onChange={handlePersonalChange}
                                placeholder="https://linkedin.com/in/janesmith"
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                            />
                        </div>
                    </div>
                )}

                {/* Step 2: Startup */}
                {step === 2 && (
                    <div className="space-y-5 animate-in fade-in-50 duration-300">
                        <h3 className="text-lg font-semibold text-white mb-4">Your startup details</h3>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Company Name *</label>
                            <input
                                type="text" name="company_name" value={startup.company_name} onChange={handleStartupChange}
                                required placeholder="Acme Inc."
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Industry</label>
                            <input
                                type="text" name="industry" value={startup.industry} onChange={handleStartupChange}
                                placeholder="FinTech, HealthTech, EdTech..."
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Stage</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {STAGES.map(s => (
                                    <button
                                        key={s.value} type="button"
                                        onClick={() => setStartup(prev => ({ ...prev, stage: s.value }))}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                      ${startup.stage === s.value
                                                ? 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/50'
                                                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-300'
                                            }`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Team Size</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {TEAM_SIZES.map(ts => (
                                    <button
                                        key={ts.value} type="button"
                                        onClick={() => setStartup(prev => ({ ...prev, team_size: ts.value }))}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                      ${startup.team_size === ts.value
                                                ? 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/50'
                                                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-300'
                                            }`}
                                    >
                                        {ts.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Elevator Pitch</label>
                            <textarea
                                name="pitch" value={startup.pitch}
                                onChange={handleStartupChange as React.ChangeEventHandler<HTMLTextAreaElement>}
                                maxLength={200} rows={3}
                                placeholder="A one-liner about what your startup does..."
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none"
                            />
                            <p className="text-xs text-slate-500 mt-1">{startup.pitch.length}/200</p>
                        </div>
                    </div>
                )}

                {/* Step 3: Needs */}
                {step === 3 && (
                    <div className="space-y-5 animate-in fade-in-50 duration-300">
                        <h3 className="text-lg font-semibold text-white mb-4">What are you looking for?</h3>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Looking for (select all that apply)</label>
                            <div className="flex flex-wrap gap-2">
                                {LOOKING_FOR_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value} type="button"
                                        onClick={() => toggleLookingFor(opt.value)}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                      ${needs.looking_for.includes(opt.value)
                                                ? 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/50'
                                                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-300'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                            <button
                                type="button"
                                onClick={() => setNeeds(prev => ({ ...prev, is_actively_raising: !prev.is_actively_raising }))}
                                className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${needs.is_actively_raising ? 'bg-emerald-500' : 'bg-slate-600'
                                    }`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${needs.is_actively_raising ? 'translate-x-5' : ''
                                    }`} />
                            </button>
                            <span className="text-sm text-slate-300 font-medium">I&apos;m actively raising funding</span>
                        </div>

                        {needs.is_actively_raising && (
                            <div className="animate-in fade-in-50 duration-200">
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Target Raise Amount</label>
                                <input
                                    type="text" name="raise_amount" value={needs.raise_amount} onChange={handleNeedsChange}
                                    placeholder="$500K, ₹2 Cr, etc."
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Location</label>
                            <input
                                type="text" name="location" value={needs.location} onChange={handleNeedsChange}
                                placeholder="City, Country"
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Company Website</label>
                            <input
                                type="url" name="website" value={needs.website} onChange={handleNeedsChange}
                                placeholder="https://yourcompany.com"
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-3 mt-6">
                {step > 1 && (
                    <button
                        type="button" onClick={handleBack}
                        className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-medium hover:bg-white/10 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back</span>
                    </button>
                )}

                {step < 3 ? (
                    <button
                        type="button" onClick={handleNext}
                        disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
                        className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold hover:from-orange-600 hover:to-amber-700 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                    >
                        <span>Continue</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button
                        type="button" onClick={handleComplete}
                        disabled={isSubmitting || !isStep3Valid}
                        className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold hover:from-orange-600 hover:to-amber-700 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Launching...</span>
                            </>
                        ) : (
                            <>
                                <span>Launch Dashboard</span>
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                )}
            </div>
        </OnboardingLayout>
    );
}
