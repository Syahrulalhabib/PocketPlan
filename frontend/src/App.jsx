import { useEffect, useState, lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider.jsx';
import Layout from './components/Layout.jsx';
import LandingPage from './pages/LandingPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';

// Lazy-load non-critical routes for route-level code splitting & fast initial paint
const DemoPage = lazy(() => import('./pages/DemoPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage.jsx'));
const GoalsPage = lazy(() => import('./pages/GoalsPage.jsx'));
const LaporanPage = lazy(() => import('./pages/LaporanPage.jsx'));
const LaporanCetakPage = lazy(() => import('./pages/LaporanCetakPage.jsx'));
const PencapaianPage = lazy(() => import('./pages/PencapaianPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const VerificationPage = lazy(() => import('./pages/VerificationPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

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

  // Public landing routes render instantly without waiting for Firebase Auth initial roundtrip
  const isPublicLanding = ['/', '/features', '/how-it-works', '/commands', '/faq'].includes(location.pathname);
  if (showLoader && !isPublicLanding) return <LoadingScreen message="Preparing your financial data..." />;

  const withShell = (element) => <Layout>{element}</Layout>;

  return (
    <Suspense fallback={<LoadingScreen message="Loading page..." />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/features" element={<LandingPage />} />
        <Route path="/how-it-works" element={<LandingPage />} />
        <Route path="/commands" element={<LandingPage />} />
        <Route path="/faq" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RedirectWithSearch to="/registration" />} />
        <Route path="/registration" element={<RegisterPage />} />
        <Route path="/verification" element={<VerificationPage />} />
        <Route path="/verify-email" element={<VerificationPage />} />
        <Route path="/verify" element={<RedirectWithSearch to="/verification" />} />
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
    </Suspense>
  );
};

export default App;
