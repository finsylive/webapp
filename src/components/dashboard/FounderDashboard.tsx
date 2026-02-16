"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';
import {
    Rocket, TrendingUp, Eye, MessageCircle,
    Users, ExternalLink, ArrowRight, Zap, Target
} from 'lucide-react';

interface FounderProfile {
    company_name: string | null;
    industry: string | null;
    stage: string | null;
    team_size: string | null;
    pitch: string | null;
    looking_for: string[];
    is_actively_raising: boolean;
    raise_amount: string | null;
    location: string | null;
    website: string | null;
}

interface DashboardStats {
    profileViews: number;
    totalMessages: number;
    connections: number;
}

const STAGE_LABELS: Record<string, string> = {
    idea: 'Idea Stage',
    pre_seed: 'Pre-Seed',
    seed: 'Seed',
    series_a: 'Series A',
    series_b_plus: 'Series B+',
    profitable: 'Profitable',
};

const LOOKING_FOR_LABELS: Record<string, string> = {
    funding: '💰 Funding',
    co_founder: '🤝 Co-Founder',
    mentorship: '🧠 Mentorship',
    talent: '👥 Talent',
    partnerships: '🔗 Partnerships',
};

export function FounderDashboard() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<FounderProfile | null>(null);
    const [stats, setStats] = useState<DashboardStats>({ profileViews: 0, totalMessages: 0, connections: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [username, setUsername] = useState('');

    const fetchData = useCallback(async () => {
        if (!user) return;

        try {
            // Get username
            const { data: userData } = await supabase
                .from('users')
                .select('username')
                .eq('id', user.id)
                .single();

            if (userData?.username) {
                setUsername(userData.username);

                // Get founder profile
                const profileRes = await fetch(`/api/users/${userData.username}/founder-profile`);
                if (profileRes.ok) {
                    const profileData = await profileRes.json();
                    setProfile(profileData);
                }
            }

            // Get stats - conversations count
            const { count: msgCount } = await supabase
                .from('conversations')
                .select('id', { count: 'exact', head: true })
                .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

            // Get startup profile views if exists
            const { data: startupData } = await supabase
                .from('startup_profiles')
                .select('id')
                .eq('owner_id', user.id)
                .maybeSingle();

            let viewCount = 0;
            if (startupData) {
                const { count } = await supabase
                    .from('startup_profile_views')
                    .select('id', { count: 'exact', head: true })
                    .eq('startup_id', startupData.id);
                viewCount = count || 0;
            }

            setStats({
                profileViews: viewCount,
                totalMessages: msgCount || 0,
                connections: 0,
            });
        } catch (error) {
            console.error('Error fetching founder dashboard data:', error);
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
                        <Rocket className="w-6 h-6 text-orange-500" />
                        Founder Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {profile?.company_name ? `Building ${profile.company_name}` : 'Welcome back, founder!'}
                    </p>
                </div>
                {profile?.is_actively_raising && (
                    <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/20">
                        <Zap className="w-3 h-3" />
                        Actively Raising {profile.raise_amount && `· ${profile.raise_amount}`}
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-card border border-border hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-muted-foreground font-medium">Profile Views</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stats.profileViews}</p>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="w-4 h-4 text-purple-500" />
                        <span className="text-xs text-muted-foreground font-medium">Conversations</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stats.totalMessages}</p>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs text-muted-foreground font-medium">Connections</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stats.connections}</p>
                </div>
            </div>

            {/* Startup Card */}
            {profile && (
                <div className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/5 to-amber-500/5 border border-orange-500/20">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-foreground">{profile.company_name || 'Your Startup'}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                {profile.industry && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-muted-foreground">{profile.industry}</span>
                                )}
                                {profile.stage && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 font-medium">
                                        {STAGE_LABELS[profile.stage] || profile.stage}
                                    </span>
                                )}
                            </div>
                        </div>
                        <Link
                            href={`/profile/${username}`}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        >
                            Edit <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>

                    {profile.pitch && (
                        <p className="text-sm text-muted-foreground mb-4 italic">&ldquo;{profile.pitch}&rdquo;</p>
                    )}

                    {/* Looking For Tags */}
                    {profile.looking_for.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {profile.looking_for.map(item => (
                                <span key={item} className="text-xs px-2.5 py-1 rounded-lg bg-accent text-foreground font-medium">
                                    {LOOKING_FOR_LABELS[item] || item}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
                <Link
                    href="/startups/create"
                    className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all group"
                >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Rocket className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Startup Profile</p>
                        <p className="text-xs text-muted-foreground">Build your public page</p>
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
                        <p className="text-xs text-muted-foreground">Connect with investors</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </Link>
            </div>

            {/* Investor Discovery CTA */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <Target className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">Find Investors</p>
                            <p className="text-xs text-muted-foreground">Browse investors matching your stage & sector</p>
                        </div>
                    </div>
                    <Link
                        href="/search?type=investor"
                        className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors flex items-center gap-1"
                    >
                        Browse <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
            </div>

            {/* Feed Section Title */}
            <div className="pt-2">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-muted-foreground" />
                    Your Feed
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Latest from your network</p>
            </div>
        </div>
    );
}
