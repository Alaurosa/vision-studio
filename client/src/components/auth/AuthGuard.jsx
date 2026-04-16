import { useAuth } from '../../hooks/useAuth';
import LoginPage from './LoginPage';

export default function AuthGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;
  return children;
}
