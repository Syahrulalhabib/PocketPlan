import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider.jsx';

const ProtectedRoute = ({ children }) => {
  const { user, loading, isDemo } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  // Enforce mandatory password setup for telegram-linked accounts
  if (!isDemo && user.needsVerification) {
    return <Navigate to="/verification" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;
