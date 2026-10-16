import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, isDummyEmail } from '../providers/AuthProvider.jsx';

const ProtectedRoute = ({ children }) => {
  const { user, loading, isDemo } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  // Enforce mandatory email verification & password setup for new/dummy/unverified accounts
  if (!isDemo && (user.needsVerification || isDummyEmail(user.email) || !user.emailVerified)) {
    return <Navigate to="/verification" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;
