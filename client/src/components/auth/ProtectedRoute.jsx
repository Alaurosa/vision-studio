import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-ink-500 text-sm uppercase tracking-editorial">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
