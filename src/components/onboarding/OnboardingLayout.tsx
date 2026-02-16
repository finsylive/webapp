"use client";

import React from 'react';

interface OnboardingLayoutProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
}

export function OnboardingLayout({ children, title, subtitle }: OnboardingLayoutProps) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950/40 to-slate-900 relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-emerald-500/10 to-teal-500/5 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-blue-500/10 to-indigo-500/5 rounded-full blur-3xl animate-pulse delay-700" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
            </div>

            {/* Content */}
            <div className="relative z-10 min-h-screen flex flex-col items-center py-8 px-4">
                {/* Logo */}
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-3 h-3 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/25" />
                    <h1 className="text-3xl font-black text-white tracking-tight">ments</h1>
                    <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full shadow-lg shadow-emerald-400/25" />
                </div>

                {/* Title Section */}
                {(title || subtitle) && (
                    <div className="text-center mb-8">
                        {title && (
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{title}</h2>
                        )}
                        {subtitle && (
                            <p className="text-slate-400 text-base max-w-md mx-auto">{subtitle}</p>
                        )}
                    </div>
                )}

                {/* Main Content */}
                <div className="w-full max-w-2xl">
                    {children}
                </div>
            </div>
        </div>
    );
}
