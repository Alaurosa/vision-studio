import { useEffect, useState } from 'react';
import { supabase, hasSupabase } from '@/lib/supabaseClient';

// Auth hook with graceful demo fallback when Supabase is unavailable.
// Returns { user, loading, signInWithEmail, signOut, isDemo }.
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(!hasSupabase);

  useEffect(() => {
    let sub = null;
    if (!hasSupabase) {
      setUser({ id: 'demo-user', email: 'demo@vision.studio' });
      setLoading(false);
      setIsDemo(true);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? { id: 'demo-user', email: 'demo@vision.studio' });
      setIsDemo(!session?.user);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? { id: 'demo-user', email: 'demo@vision.studio' });
      setIsDemo(!session?.user);
    });
    sub = data.subscription;
    return () => sub?.unsubscribe?.();
  }, []);

  const signInWithEmail = async (email) => {
    if (!hasSupabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (hasSupabase) await supabase.auth.signOut();
    setUser({ id: 'demo-user', email: 'demo@vision.studio' });
    setIsDemo(true);
  };

  return { user, loading, signInWithEmail, signOut, isDemo };
}
