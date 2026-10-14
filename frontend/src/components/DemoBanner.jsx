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
    navigate('/register');
  };

  return (
    <aside className="demo-persistent-banner" role="status" aria-label="Notifikasi Mode Demo">
      <div className="demo-banner-content">
        <span className="demo-banner-badge">✨ MODE DEMO</span>
        <span className="demo-banner-text">
          Data contoh &amp; perubahan tidak tersimpan ke server.
        </span>
      </div>
      <div className="demo-banner-actions">
        <button
          type="button"
          onClick={handleRegister}
          className="demo-banner-btn demo-banner-primary"
        >
          Daftar Gratis
        </button>
        <button
          type="button"
          onClick={handleExit}
          className="demo-banner-btn demo-banner-secondary"
        >
          Keluar Demo
        </button>
      </div>
    </aside>
  );
};

export default DemoBanner;
