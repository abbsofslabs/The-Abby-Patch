import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, profile, loading, isConfigured } = useAuth();

  if (!isConfigured) {
    return (
      <section className="abby-patch__panel abby-patch__auth-message">
        <h2>Supabase not configured</h2>
        <p>Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY to .env.local.</p>
      </section>
    );
  }

  if (loading) {
    return <p className="abby-patch__auth-loading">Loading account…</p>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (roles?.length && (!profile || !roles.includes(profile.role))) {
    if (profile?.role === 'store') {
      return <Navigate to="/store" replace />;
    }
    if (profile?.role === 'customer') {
      return <Navigate to="/design" replace />;
    }
    return <Navigate to="/auth" replace />;
  }

  return children;
}
