import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmail(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900/70 flex">
      {/* Left - branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 to-slate-800 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-purple-500/10" />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-brand-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-purple-500/5 blur-3xl" />
        <div className="relative text-center">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center mx-auto mb-8 shadow-lg shadow-brand-500/20">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Vision Studio</h2>
          <p className="text-slate-500 max-w-xs mx-auto leading-relaxed">
            AI-powered spatial layout design. Upload floor plans, browse furniture catalogs, and design your space with precision.
          </p>
          <div className="flex items-center justify-center gap-6 mt-10 text-slate-400 text-sm">
            <div className="text-center">
              <p className="text-white font-semibold text-lg">27+</p>
              <p>Furniture</p>
            </div>
            <div className="w-px h-8 bg-slate-700" />
            <div className="text-center">
              <p className="text-white font-semibold text-lg">AI</p>
              <p>Powered</p>
            </div>
            <div className="w-px h-8 bg-slate-700" />
            <div className="text-center">
              <p className="text-white font-semibold text-lg">3D</p>
              <p>Preview</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right - login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">Vision Studio</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-slate-400 mb-8">Sign in with your email to continue</p>

          {sent ? (
            <div className="text-center py-8 bg-green-500/10 rounded-3xl border border-green-500/20">
              <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-green-300 font-semibold text-lg mb-1">Check your email</p>
              <p className="text-green-400 text-sm">We sent a magic link to <strong>{email}</strong></p>
              <button
                onClick={() => setSent(false)}
                className="mt-4 text-sm text-green-400 hover:text-green-300 underline transition"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  className="w-full border border-white/10 rounded-xl px-4 py-3 text-white bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-slate-900 transition"
                />
              </div>
              {error && (
                <div className="bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-xl border border-red-500/20">
                  {error}
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-brand-500 text-white rounded-xl py-3 font-semibold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/25"
              >
                Send Magic Link
              </button>
              <p className="text-center text-xs text-slate-500">
                No password needed — we'll send a secure login link to your email.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
