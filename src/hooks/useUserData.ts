import { useState, useEffect } from 'react';
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
  user_type: 'mentor' | 'normal_user';
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

  useEffect(() => {
    async function fetchUserData() {
      if (!user?.id) {
        setUserData(null);
        setLoading(false);
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
          throw error;
        }

        setUserData(data);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch user data');
        setUserData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [user?.id]);

  return { userData, loading, error, refetch: () => fetchUserData() };
}