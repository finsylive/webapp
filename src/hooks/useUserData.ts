import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase';

interface UserData {
  id: string;
  email: string;
  username: string;
  full_name: string;
  about?: string;
  current_city?: string;
  tagline?: string;
  user_type: 'mentor' | 'normal_user' | 'explorer' | 'investor' | 'founder';
  created_at?: string;
  avatar_url?: string;
  banner_image?: string;
  is_verified: boolean;
  fcm_token?: string;
  is_onboarding_done: boolean;
  last_seen?: string;
}

export function useUserData() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    if (!user?.id) {
      setUserData(null);
      setLoading(false);
      setError(null); // Clear error when no user
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        // Check if it's a "not found" error
        if (error.code === 'PGRST116') {
          console.warn('User profile not found in database. User may need to complete onboarding.');
          setError('User profile not found. Please complete sign up.');
        } else {
          throw error;
        }
        setUserData(null);
        return;
      }

      setUserData(data);
    } catch (err) {
      console.error('Error fetching user data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user data';
      console.error('Full error details:', JSON.stringify(err, null, 2));
      setError(errorMessage);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  return { userData, loading, error, refetch: fetchUserData };
}