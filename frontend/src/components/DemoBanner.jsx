import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider.jsx';

const DemoBanner = () => {
  const { isDemo, exitDemo } = useAuth();
  const navigate = useNavigate();

  if (!isDemo) return null;

  const handleExit = () => {
    exitDemo();
    navigate('/');
  };

  const handleRegister = () => {
    exitDemo();
    navigate('/registration');
  };

  return (
    <aside className="demo-persistent-banner" role="status" aria-label="Demo Mode Notification">
      <div className="demo-banner-content">
        <span className="demo-banner-badge">✨ DEMO MODE</span>
        <span className="demo-banner-text">
          Sample data active — changes are not saved to the cloud.
        </span>
      </div>
      <div className="demo-banner-actions">
        <button
          type="button"
          onClick={handleRegister}
          className="demo-banner-btn demo-banner-primary"
        >
          Sign Up Free
        </button>
        <button
          type="button"
          onClick={handleExit}
          className="demo-banner-btn demo-banner-secondary"
        >
          Exit Demo
        </button>
      </div>
    </aside>
  );
};

export default DemoBanner;
