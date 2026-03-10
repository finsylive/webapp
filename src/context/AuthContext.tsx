// src/context/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children, initialSession = null }: { children: React.ReactNode; initialSession?: Session | null }) {
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [isLoading, setIsLoading] = useState(!initialSession);
  const initializedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      if (initializedRef.current) return;
      initializedRef.current = true;

      try {
        // Set up auth state listener — use session.user directly instead of
        // calling getUser() (which makes a ~200-500ms network call) on every event.
        // The session JWT is already validated locally by Supabase client.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event: AuthChangeEvent, session: Session | null) => {
            if (!mounted) return;
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
          }
        );

        // If we already have a session from the server, skip client refetch entirely
        if (!initialSession) {
          // Single call: getSession() validates JWT locally (fast, no network call).
          // Only use getUser() for write operations that need server verification.
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error) {
            console.error('Error getting session:', error);
            setIsLoading(false);
            return () => subscription.unsubscribe();
          }

          if (mounted) {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
          }
        } else {
          setIsLoading(false);
        }

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    const cleanup = initializeAuth();

    return () => {
      mounted = false;
      cleanup?.then(cleanupFn => cleanupFn?.());
    };
  }, [initialSession]);

  const signInWithGoogle = async (redirectTo?: string) => {
    try {
      setIsLoading(true);
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      if (redirectTo) {
        callbackUrl.searchParams.set('redirect', redirectTo);
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear state immediately for better UX
      setSession(null);
      setUser(null);

      // Redirect to login (home) page after sign out
      if (typeof window !== 'undefined') {
        // Replace history entry to prevent navigating back into authed pages
        window.location.replace('/');
      }
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    session,
    isLoading,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};