import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Inline sign-in / sign-up modal. Closes itself once `user` becomes truthy.
 * Calls `onAuthed(user)` immediately after successful authentication so the
 * caller can run follow-up work (e.g. saving a draft to the server).
 */
export default function LoginModal({ title = 'Sign in to save', message, onClose, onAuthed }) {
  const { user, signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      onAuthed?.(user);
    }
    // We only care about the leading edge of "user became truthy", so this
    // effect runs whenever user changes and the parent decides what to do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fn = mode === 'signin' ? signIn : signUp;
    const { data, error: authErr } = await fn(email.trim(), password);
    setBusy(false);

    if (authErr) {
      setError(authErr.message);
      return;
    }

    if (mode === 'signup' && !data?.session) {
      setError('Check your email to confirm your account, then sign in here.');
      setMode('signin');
      setPassword('');
      return;
    }
    // onAuthed will fire via the useEffect above once session propagates.
  };

  const isSignIn = mode === 'signin';

  return (
    <div
      className="fixed inset-0 z-[60] bg-ink-900/40 backdrop-blur-sm grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm bg-paper-50 border border-ink-900/10 p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-500 hover:text-ink-900 text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
        <p className="eyebrow mb-3">Vision Studio</p>
        <h2 className="display-md mb-3">{title}</h2>
        {message && <p className="text-sm text-ink-600 mb-6">{message}</p>}

        <form onSubmit={onSubmit} className="space-y-5 mt-2">
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
            <p className="text-sm text-sienna-600" role="alert">{error}</p>
          )}

          <button type="submit" disabled={busy} className="btn-ink w-full">
            {busy ? '…' : isSignIn ? 'Sign in & save' : 'Sign up & save'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(isSignIn ? 'signup' : 'signin');
            setError(null);
          }}
          className="mt-6 text-[11px] uppercase tracking-editorial text-ink-500 hover:text-ink-900 transition"
        >
          {isSignIn ? 'No account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
