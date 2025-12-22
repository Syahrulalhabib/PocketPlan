import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider.jsx';
import Layout from './components/Layout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';
import GoalsPage from './pages/GoalsPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import VerificationPage from './pages/VerificationPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';

const App = () => {
  const { loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  const withShell = (element) => <Layout>{element}</Layout>;

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verification" element={<VerificationPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {withShell(<DashboardPage />)}
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            {withShell(<TransactionsPage />)}
          </ProtectedRoute>
        }
      />
      <Route
        path="/goals"
        element={
          <ProtectedRoute>
            {withShell(<GoalsPage />)}
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={location?.pathname === '/login' ? '/login' : '/dashboard'} replace />} />
    </Routes>
  );
};

export default App;
