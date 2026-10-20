import { useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider.jsx';
import DashboardPage from './DashboardPage.jsx';
import Layout from '../components/Layout.jsx';

const DemoPage = () => {
  const { isDemo, startDemo } = useAuth();

  useEffect(() => {
    document.title = 'Demo Mode - Pocketplan';
    if (!isDemo) {
      startDemo();
    }
  }, [isDemo, startDemo]);

  return (
    <Layout>
      <DashboardPage />
    </Layout>
  );
};

export default DemoPage;
