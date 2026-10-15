import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider.jsx';
import pocketLogo from '../assets/pocket-logo.svg';

const NotFoundPage = () => {
  const { user } = useAuth();

  useEffect(() => {
    document.title = '404 — Page Not Found | Pocketplan';
  }, []);

  return (
    <div className="notfound-container">
      <div className="notfound-card">
        <div className="notfound-logo-wrap">
          <img src={pocketLogo} alt="Pocketplan Logo" className="notfound-logo" />
        </div>
        <div className="notfound-code">404</div>
        <h1 className="notfound-title">Halaman Tidak Ditemukan</h1>
        <p className="notfound-desc">
          Tautan yang Anda tuju mungkin sudah kedaluwarsa, dipindahkan, atau alamat URL yang dimasukkan salah.
        </p>
        <div className="notfound-actions">
          <Link to={user ? '/dashboard' : '/'} className="notfound-btn-primary">
            {user ? 'Back to Dashboard' : 'Back to Home'}
          </Link>
          <a
            href="https://t.me/yourpocketplan_bot"
            target="_blank"
            rel="noreferrer"
            className="notfound-btn-secondary"
          >
            Open Telegram Bot
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
