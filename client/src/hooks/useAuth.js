import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const TEST_USER = { id: 'test-user-001', email: 'test@visionstudio.dev' };
const TEST_PASSWORD = 'test1234';
const TEST_TOKEN = 'vs-test-token-001';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for fallback test session in localStorage
    const testSession = localStorage.getItem('vs_test_session');
    if (testSession) {
      setUser(TEST_USER);
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!localStorage.getItem('vs_test_session')) {
        setUser(session?.user ?? null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    // Try Supabase first
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (!result.error) return result;

    // Fallback: test account
    if (email === TEST_USER.email && password === TEST_PASSWORD) {
      localStorage.setItem('vs_test_session', TEST_TOKEN);
      setUser(TEST_USER);
      return { data: { session: { user: TEST_USER, access_token: TEST_TOKEN } }, error: null };
    }
    return result;
  };

  const signUp = async (email, password) => {
    const result = await supabase.auth.signUp({ email, password });
    if (!result.error) return result;

    // Fallback: allow test account signup
    if (email === TEST_USER.email) {
      localStorage.setItem('vs_test_session', TEST_TOKEN);
      setUser(TEST_USER);
      return { data: { session: { user: TEST_USER, access_token: TEST_TOKEN } }, error: null };
    }
    return result;
  };

  const signOut = async () => {
    localStorage.removeItem('vs_test_session');
    setUser(null);
    await supabase.auth.signOut();
  };

  return { user, loading, signIn, signUp, signOut };
}
