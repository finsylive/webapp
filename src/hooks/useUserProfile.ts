"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/context/AuthContext';

export type UserType = 'normal_user' | 'founder' | 'investor';

export interface UserProfile {
    id: string;
    email: string;
    username: string;
    full_name: string;
    about: string | null;
    tagline: string | null;
    avatar_url: string | null;
    banner_image: string | null;
    current_city: string | null;
    user_type: UserType;
    is_verified: boolean;
    is_onboarding_done: boolean;
    onboarding_step: number;
    created_at: string;
}

export function useUserProfile() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchProfile = useCallback(async () => {
        if (!user) {
            setProfile(null);
            setIsLoading(false);
            return;
        }

        try {
            // Try full query first (with onboarding_step)
            let { data, error } = await supabase
                .from('users')
                .select('id, email, username, full_name, about, tagline, avatar_url, banner_image, current_city, user_type, is_verified, is_onboarding_done, onboarding_step, created_at')
                .eq('id', user.id)
                .single();

            // If onboarding_step column doesn't exist yet, retry without it
            if (error && error.message?.includes('onboarding_step')) {
                const fallback = await supabase
                    .from('users')
                    .select('id, email, username, full_name, about, tagline, avatar_url, banner_image, current_city, user_type, is_verified, is_onboarding_done, created_at')
                    .eq('id', user.id)
                    .single();
                data = fallback.data ? { ...fallback.data, onboarding_step: 0 } : null;
                error = fallback.error;
            }

            if (error) {
                console.error('Error fetching user profile:', error);
                setProfile(null);
            } else {
                setProfile(data as UserProfile);
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
            setProfile(null);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const refetch = useCallback(() => {
        setIsLoading(true);
        return fetchProfile();
    }, [fetchProfile]);

    return {
        profile,
        isLoading,
        refetch,
        isFounder: profile?.user_type === 'founder',
        isInvestor: profile?.user_type === 'investor',
        isNormalUser: profile?.user_type === 'normal_user',
        needsOnboarding: profile ? profile.is_onboarding_done !== true : false,
    };
}
