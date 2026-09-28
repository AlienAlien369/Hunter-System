import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-purple-400 font-mono text-sm">LOADING...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Remember where the hunter was going, so login can send them back there.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}
