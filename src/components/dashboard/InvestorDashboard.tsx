"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';
import {
    TrendingUp, Eye, MessageCircle, Bookmark,
    ArrowRight, Search, Briefcase, Target, Zap
} from 'lucide-react';

interface InvestorProfile {
    firm_name: string | null;
    investor_type: string | null;
    check_size_min: string | null;
    check_size_max: string | null;
    preferred_stages: string[];
    preferred_sectors: string[];
    portfolio_count: number;
    thesis: string | null;
    is_actively_investing: boolean;
    location: string | null;
}

interface StartupCard {
    id: string;
    brand_name: string;
    stage: string | null;
    description: string | null;
    keywords: string[];
    is_actively_raising: boolean;
}

interface DashboardStats {
    startupsViewed: number;
    bookmarked: number;
    totalMessages: number;
}

const STAGE_LABELS: Record<string, string> = {
    idea: 'Idea', pre_seed: 'Pre-Seed', seed: 'Seed',
    series_a: 'Series A', series_b_plus: 'Series B+',
    profitable: 'Profitable', ideation: 'Ideation',
    mvp: 'MVP', scaling: 'Scaling', expansion: 'Expansion', maturity: 'Maturity'
};

const INVESTOR_TYPE_LABELS: Record<string, string> = {
    angel: 'Angel Investor', vc: 'Venture Capital', family_office: 'Family Office',
    accelerator: 'Accelerator', corporate_vc: 'Corporate VC'
};

export function InvestorDashboard() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<InvestorProfile | null>(null);
    const [dealFlow, setDealFlow] = useState<StartupCard[]>([]);
    const [stats, setStats] = useState<DashboardStats>({ startupsViewed: 0, bookmarked: 0, totalMessages: 0 });
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!user) return;

        try {
            // Get username for profile fetch
            const { data: userData } = await supabase
                .from('users')
                .select('username')
                .eq('id', user.id)
                .single();

            if (userData?.username) {
                const profileRes = await fetch(`/api/users/${userData.username}/investor-profile`);
                if (profileRes.ok) {
                    const profileData = await profileRes.json();
                    setProfile(profileData);
                }
            }

            // Get bookmarks count
            const { count: bookmarkCount } = await supabase
                .from('startup_bookmarks')
                .select('startup_id', { count: 'exact', head: true })
                .eq('user_id', user.id);

            // Get conversations count
            const { count: msgCount } = await supabase
                .from('conversations')
                .select('id', { count: 'exact', head: true })
                .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

            setStats({
                startupsViewed: 0,
                bookmarked: bookmarkCount || 0,
                totalMessages: msgCount || 0,
            });

            // Get deal flow — actively raising startups
            const { data: startups } = await supabase
                .from('startup_profiles')
                .select('id, brand_name, stage, description, keywords, is_actively_raising')
                .eq('is_published', true)
                .eq('visibility', 'public')
                .order('updated_at', { ascending: false })
                .limit(6);

            if (startups) {
                setDealFlow(startups);
            }
        } catch (error) {
            console.error('Error fetching investor dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 rounded-2xl bg-card/50 animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Welcome Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-emerald-500" />
                        Investor Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {profile?.firm_name || (profile?.investor_type ? INVESTOR_TYPE_LABELS[profile.investor_type] : 'Welcome back!')}
                    </p>
                </div>
                {profile?.is_actively_investing && (
                    <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/20">
                        <Zap className="w-3 h-3" />
                        Actively Investing
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-card border border-border hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-muted-foreground font-medium">Viewed</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stats.startupsViewed}</p>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <Bookmark className="w-4 h-4 text-amber-500" />
                        <span className="text-xs text-muted-foreground font-medium">Bookmarked</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stats.bookmarked}</p>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="w-4 h-4 text-purple-500" />
                        <span className="text-xs text-muted-foreground font-medium">Conversations</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stats.totalMessages}</p>
                </div>
            </div>

            {/* Investment Focus Card */}
            {profile && (profile.preferred_sectors.length > 0 || profile.preferred_stages.length > 0 || profile.thesis) && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/20">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Target className="w-4 h-4 text-emerald-500" />
                        Your Investment Focus
                    </h3>

                    {profile.thesis && (
                        <p className="text-sm text-muted-foreground mb-3 italic">&ldquo;{profile.thesis}&rdquo;</p>
                    )}

                    <div className="space-y-2">
                        {profile.preferred_stages.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                <span className="text-xs text-muted-foreground mr-1">Stages:</span>
                                {profile.preferred_stages.map(s => (
                                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                                        {STAGE_LABELS[s] || s}
                                    </span>
                                ))}
                            </div>
                        )}
                        {profile.preferred_sectors.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                <span className="text-xs text-muted-foreground mr-1">Sectors:</span>
                                {profile.preferred_sectors.map(s => (
                                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium capitalize">
                                        {s.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {profile.check_size_min && profile.check_size_max && (
                        <p className="text-xs text-muted-foreground mt-3">
                            Check size: {profile.check_size_min} – {profile.check_size_max}
                        </p>
                    )}
                </div>
            )}

            {/* Deal Flow */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-muted-foreground" />
                        Deal Flow
                    </h2>
                    <Link
                        href="/startups"
                        className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
                    >
                        View all <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>

                {dealFlow.length > 0 ? (
                    <div className="grid gap-3">
                        {dealFlow.map(startup => (
                            <Link
                                key={startup.id}
                                href={`/startups/${startup.id}`}
                                className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all group"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-sm font-semibold text-foreground truncate">{startup.brand_name}</h4>
                                        {startup.is_actively_raising && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold flex-shrink-0">
                                                Raising
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {startup.stage && (
                                            <span className="text-xs text-muted-foreground">{STAGE_LABELS[startup.stage] || startup.stage}</span>
                                        )}
                                        {startup.keywords?.slice(0, 2).map(k => (
                                            <span key={k} className="text-xs px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{k}</span>
                                        ))}
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center rounded-2xl bg-card border border-border">
                        <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No startups found yet</p>
                        <Link href="/startups" className="text-xs text-primary mt-2 inline-block hover:underline">
                            Browse startups →
                        </Link>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
                <Link
                    href="/startups"
                    className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all group"
                >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <Search className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Discover</p>
                        <p className="text-xs text-muted-foreground">Browse all startups</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </Link>

                <Link
                    href="/messages"
                    className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all group"
                >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="w-5 h-5 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Messages</p>
                        <p className="text-xs text-muted-foreground">Chat with founders</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </Link>
            </div>

            {/* Feed Section Title */}
            <div className="pt-2">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-muted-foreground" />
                    Community Feed
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Latest from the ecosystem</p>
            </div>
        </div>
    );
}
