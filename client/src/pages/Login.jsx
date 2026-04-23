import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';

export default function Login() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/studio" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fn = mode === 'signin' ? signIn : signUp;
    const { data, error } = await fn(email.trim(), password);
    setBusy(false);

    if (error) {
      setError(error.message);
      toast.error(error.message);
      return;
    }
    // When email confirmation is disabled in Supabase, signUp returns a
    // session immediately. If for some reason the project still requires
    // confirmation, fall back to a helpful message instead of a blank state.
    if (mode === 'signup' && !data.session) {
      setError('Check your email to confirm your account, then sign in.');
      setMode('signin');
      setPassword('');
      return;
    }
    navigate('/studio');
  };

  const isSignIn = mode === 'signin';

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Helmet>
        <title>{isSignIn ? 'Sign In' : 'Create Account'} — Vision Studio</title>
      </Helmet>
      <p className="eyebrow mb-4">Vision Studio</p>
        <h1 className="display-md mb-10">
          {isSignIn ? 'Sign in' : 'Create account'}
        </h1>

        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label className="eyebrow block mb-2">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="eyebrow block mb-2">Password</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="6 characters or more"
            />
          </div>

          {error && (
            <p className="text-sm text-sienna-600" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-ink w-full">
            {busy ? '…' : isSignIn ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(isSignIn ? 'signup' : 'signin');
            setError(null);
          }}
          className="mt-8 text-[11px] uppercase tracking-editorial text-ink-500 hover:text-ink-900 transition"
        >
          {isSignIn ? 'No account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
