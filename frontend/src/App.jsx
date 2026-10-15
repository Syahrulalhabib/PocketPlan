import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider.jsx';
import Layout from './components/Layout.jsx';
import LandingPage from './pages/LandingPage.jsx';
import DemoPage from './pages/DemoPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';
import GoalsPage from './pages/GoalsPage.jsx';
import LaporanPage from './pages/LaporanPage.jsx';
import LaporanCetakPage from './pages/LaporanCetakPage.jsx';
import PencapaianPage from './pages/PencapaianPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import VerificationPage from './pages/VerificationPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';

const RedirectWithSearch = ({ to }) => {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
};

const App = () => {
  const { loading: authLoading } = useAuth();
  const [showLoader, setShowLoader] = useState(true);
  const location = useLocation();

  useEffect(() => {
    if (!authLoading) {
      const timer = setTimeout(() => setShowLoader(false), 300);
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  if (showLoader) return <LoadingScreen message="Preparing your financial data..." />;

  const withShell = (element) => <Layout>{element}</Layout>;

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/features" element={<LandingPage />} />
      <Route path="/how-it-works" element={<LandingPage />} />
      <Route path="/commands" element={<LandingPage />} />
      <Route path="/faq" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verification" element={<VerificationPage />} />
      <Route path="/demo" element={<DemoPage />} />
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
        path="/reports"
        element={
          <ProtectedRoute>
            {withShell(<LaporanPage />)}
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/print"
        element={
          <ProtectedRoute>
            <LaporanCetakPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/achievements"
        element={
          <ProtectedRoute>
            {withShell(<PencapaianPage />)}
          </ProtectedRoute>
        }
      />
      {/* Backward compatibility redirects */}
      <Route path="/laporan" element={<RedirectWithSearch to="/reports" />} />
      <Route path="/laporan/cetak" element={<RedirectWithSearch to="/reports/print" />} />
      <Route path="/pencapaian" element={<RedirectWithSearch to="/achievements" />} />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;
