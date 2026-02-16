"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { User, ArrowRight } from 'lucide-react';

export default function JobSeekerOnboarding() {
    const router = useRouter();
    const { user, isLoading } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState({
        full_name: '',
        username: '',
        tagline: '',
        about: '',
        current_city: '',
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
                        setForm(prev => ({
                            ...prev,
                            full_name: data.full_name || '',
                            username: data.username || '',
                            tagline: data.tagline || '',
                            about: data.about || '',
                            current_city: data.current_city || '',
                        }));
                    }
                })
                .catch(console.error);
        }
    }, [user, isLoading, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.full_name.trim() || !form.username.trim()) return;
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/users/onboarding', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    is_onboarding_done: true,
                    onboarding_step: 1,
                    profile_updates: {
                        full_name: form.full_name.trim(),
                        username: form.username.trim().toLowerCase(),
                        tagline: form.tagline.trim() || null,
                        about: form.about.trim() || null,
                        current_city: form.current_city.trim() || null,
                    },
                }),
            });

            if (!res.ok) throw new Error('Failed to save profile');
            // Redirect to main feed
            window.location.href = '/';
        } catch (error) {
            console.error('Error completing onboarding:', error);
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
            title="Set up your profile"
            subtitle="Tell us a bit about yourself to get started"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 space-y-5">
                    {/* Icon header */}
                    <div className="flex justify-center mb-2">
                        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                            <User className="w-7 h-7 text-blue-400" />
                        </div>
                    </div>

                    {/* Full Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name *</label>
                        <input
                            type="text"
                            name="full_name"
                            value={form.full_name}
                            onChange={handleChange}
                            required
                            placeholder="John Doe"
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                        />
                    </div>

                    {/* Username */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Username *</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">@</span>
                            <input
                                type="text"
                                name="username"
                                value={form.username}
                                onChange={handleChange}
                                required
                                placeholder="johndoe"
                                className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                            />
                        </div>
                    </div>

                    {/* Tagline */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Tagline</label>
                        <input
                            type="text"
                            name="tagline"
                            value={form.tagline}
                            onChange={handleChange}
                            maxLength={60}
                            placeholder="Software Engineer | Open Source Enthusiast"
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                        />
                        <p className="text-xs text-slate-500 mt-1">{form.tagline.length}/60</p>
                    </div>

                    {/* About */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">About</label>
                        <textarea
                            name="about"
                            value={form.about}
                            onChange={handleChange}
                            maxLength={250}
                            rows={3}
                            placeholder="Tell us a bit about yourself..."
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">{form.about.length}/250</p>
                    </div>

                    {/* Current City */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Current City</label>
                        <input
                            type="text"
                            name="current_city"
                            value={form.current_city}
                            onChange={handleChange}
                            placeholder="Mumbai, India"
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                        />
                    </div>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={isSubmitting || !form.full_name.trim() || !form.username.trim()}
                    className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                >
                    {isSubmitting ? (
                        <>
                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Setting up...</span>
                        </>
                    ) : (
                        <>
                            <span>Complete Setup</span>
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </form>
        </OnboardingLayout>
    );
}
