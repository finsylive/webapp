"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { StepIndicator } from '@/components/onboarding/StepIndicator';
import { ArrowRight, ArrowLeft } from 'lucide-react';

const INVESTOR_TYPES = [
    { value: 'angel', label: 'Angel Investor' },
    { value: 'vc', label: 'Venture Capital' },
    { value: 'family_office', label: 'Family Office' },
    { value: 'accelerator', label: 'Accelerator' },
    { value: 'corporate_vc', label: 'Corporate VC' },
];

const PREFERRED_STAGES = [
    { value: 'idea', label: 'Idea' },
    { value: 'pre_seed', label: 'Pre-Seed' },
    { value: 'seed', label: 'Seed' },
    { value: 'series_a', label: 'Series A' },
    { value: 'series_b_plus', label: 'Series B+' },
    { value: 'growth', label: 'Growth' },
];

const PREFERRED_SECTORS = [
    { value: 'fintech', label: '💳 FinTech' },
    { value: 'healthtech', label: '🏥 HealthTech' },
    { value: 'edtech', label: '📚 EdTech' },
    { value: 'saas', label: '☁️ SaaS' },
    { value: 'ecommerce', label: '🛍️ E-Commerce' },
    { value: 'ai_ml', label: '🤖 AI/ML' },
    { value: 'deeptech', label: '🔬 DeepTech' },
    { value: 'cleantech', label: '🌱 CleanTech' },
    { value: 'gaming', label: '🎮 Gaming' },
    { value: 'social', label: '📱 Social' },
    { value: 'logistics', label: '🚚 Logistics' },
    { value: 'other', label: '📦 Other' },
];

const STEP_LABELS = ['About You', 'Your Fund', 'Focus Areas'];

export default function InvestorOnboarding() {
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

    // Step 2: Fund
    const [fund, setFund] = useState({
        firm_name: '',
        investor_type: '',
        check_size_min: '',
        check_size_max: '',
        portfolio_count: '',
        thesis: '',
    });

    // Step 3: Focus
    const [focus, setFocus] = useState({
        preferred_stages: [] as string[],
        preferred_sectors: [] as string[],
        location: '',
        website: '',
        is_actively_investing: true,
    });

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

    const handleFundChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFund(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFocusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFocus(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const toggleStage = (value: string) => {
        setFocus(prev => ({
            ...prev,
            preferred_stages: prev.preferred_stages.includes(value)
                ? prev.preferred_stages.filter(v => v !== value)
                : [...prev.preferred_stages, value],
        }));
    };

    const toggleSector = (value: string) => {
        setFocus(prev => ({
            ...prev,
            preferred_sectors: prev.preferred_sectors.includes(value)
                ? prev.preferred_sectors.filter(v => v !== value)
                : [...prev.preferred_sectors, value],
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
            // 1. Save user profile + mark done
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

            // 2. Create investor profile
            const investorRes = await fetch('/api/users/' + personal.username.trim().toLowerCase() + '/investor-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firm_name: fund.firm_name.trim() || null,
                    investor_type: fund.investor_type || null,
                    check_size_min: fund.check_size_min.trim() || null,
                    check_size_max: fund.check_size_max.trim() || null,
                    portfolio_count: fund.portfolio_count ? parseInt(fund.portfolio_count) : 0,
                    thesis: fund.thesis.trim() || null,
                    preferred_stages: focus.preferred_stages,
                    preferred_sectors: focus.preferred_sectors,
                    location: focus.location.trim() || null,
                    website: focus.website.trim() || null,
                    linkedin: personal.linkedin.trim() || null,
                    is_actively_investing: focus.is_actively_investing,
                }),
            });

            if (!investorRes.ok) {
                console.warn('Investor profile creation failed, but onboarding was marked done');
            }

            window.location.href = '/';
        } catch (error) {
            console.error('Error completing onboarding:', error);
            setIsSubmitting(false);
        }
    };

    const isStep1Valid = personal.full_name.trim() && personal.username.trim();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-primary/70 border-t-transparent animate-spin" />
            </div>
        );
    }

    return (
        <OnboardingLayout title="Investor Setup" subtitle="Let's set up your investor profile">
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
                                required placeholder="Alex Johnson"
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Username *</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">@</span>
                                <input
                                    type="text" name="username" value={personal.username} onChange={handlePersonalChange}
                                    required placeholder="alexjohnson"
                                    className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Tagline</label>
                            <input
                                type="text" name="tagline" value={personal.tagline} onChange={handlePersonalChange}
                                maxLength={60} placeholder="Partner @ Sequoia | Early-Stage Investor"
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                            />
                            <p className="text-xs text-slate-500 mt-1">{personal.tagline.length}/60</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">LinkedIn Profile</label>
                            <input
                                type="url" name="linkedin" value={personal.linkedin} onChange={handlePersonalChange}
                                placeholder="https://linkedin.com/in/alexjohnson"
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                            />
                        </div>
                    </div>
                )}

                {/* Step 2: Fund */}
                {step === 2 && (
                    <div className="space-y-5 animate-in fade-in-50 duration-300">
                        <h3 className="text-lg font-semibold text-white mb-4">Your investment details</h3>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Firm Name</label>
                            <input
                                type="text" name="firm_name" value={fund.firm_name} onChange={handleFundChange}
                                placeholder="Sequoia Capital, or leave empty for solo angel"
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Investor Type</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {INVESTOR_TYPES.map(t => (
                                    <button
                                        key={t.value} type="button"
                                        onClick={() => setFund(prev => ({ ...prev, investor_type: t.value }))}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                      ${fund.investor_type === t.value
                                                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50'
                                                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-300'
                                            }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Min Check Size</label>
                                <input
                                    type="text" name="check_size_min" value={fund.check_size_min} onChange={handleFundChange}
                                    placeholder="$25K"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Max Check Size</label>
                                <input
                                    type="text" name="check_size_max" value={fund.check_size_max} onChange={handleFundChange}
                                    placeholder="$500K"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Portfolio Companies</label>
                            <input
                                type="number" name="portfolio_count" value={fund.portfolio_count} onChange={handleFundChange}
                                min="0" placeholder="15"
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Investment Thesis</label>
                            <textarea
                                name="thesis" value={fund.thesis} onChange={handleFundChange}
                                maxLength={300} rows={3}
                                placeholder="What kind of companies do you look for?"
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none"
                            />
                            <p className="text-xs text-slate-500 mt-1">{fund.thesis.length}/300</p>
                        </div>
                    </div>
                )}

                {/* Step 3: Focus */}
                {step === 3 && (
                    <div className="space-y-5 animate-in fade-in-50 duration-300">
                        <h3 className="text-lg font-semibold text-white mb-4">Your investment focus</h3>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Preferred Stages</label>
                            <div className="flex flex-wrap gap-2">
                                {PREFERRED_STAGES.map(s => (
                                    <button
                                        key={s.value} type="button"
                                        onClick={() => toggleStage(s.value)}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                      ${focus.preferred_stages.includes(s.value)
                                                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50'
                                                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-300'
                                            }`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Preferred Sectors</label>
                            <div className="flex flex-wrap gap-2">
                                {PREFERRED_SECTORS.map(s => (
                                    <button
                                        key={s.value} type="button"
                                        onClick={() => toggleSector(s.value)}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                      ${focus.preferred_sectors.includes(s.value)
                                                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50'
                                                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-300'
                                            }`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                            <button
                                type="button"
                                onClick={() => setFocus(prev => ({ ...prev, is_actively_investing: !prev.is_actively_investing }))}
                                className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${focus.is_actively_investing ? 'bg-emerald-500' : 'bg-slate-600'
                                    }`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${focus.is_actively_investing ? 'translate-x-5' : ''
                                    }`} />
                            </button>
                            <span className="text-sm text-slate-300 font-medium">I&apos;m actively investing</span>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Location</label>
                            <input
                                type="text" name="location" value={focus.location} onChange={handleFocusChange}
                                placeholder="San Francisco, CA"
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Website</label>
                            <input
                                type="url" name="website" value={focus.website} onChange={handleFocusChange}
                                placeholder="https://yourfund.com"
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
                        disabled={step === 1 ? !isStep1Valid : false}
                        className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                    >
                        <span>Continue</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button
                        type="button" onClick={handleComplete}
                        disabled={isSubmitting}
                        className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Setting up...</span>
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
