import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const isDemoMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

const DEMO_USER = {
  id: 'demo-user-00000000-0000-0000-0000-000000000000',
  email: 'demo@visionstudio.local',
  role: 'authenticated',
};

export function useAuth() {
  const [user, setUser] = useState(isDemoMode ? DEMO_USER : null);
  const [loading, setLoading] = useState(!isDemoMode);

  useEffect(() => {
    if (isDemoMode) return; // Skip — already set

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email) => {
    if (isDemoMode) {
      // Demo mode — just set user directly
      setUser(DEMO_USER);
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/dashboard' },
    });
    if (error) throw error;
  };

  const signOut = () => {
    if (isDemoMode) return;
    supabase.auth.signOut();
  };

  return { user, loading, signInWithEmail, signOut, isDemoMode };
}
