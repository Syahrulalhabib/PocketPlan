import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useData } from '../providers/DataProvider.jsx';
import Toast from './Toast.jsx';
import { useState } from 'react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/transactions', label: 'Transactions' },
  { path: '/goals', label: 'Goals' }
];

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { toast } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="page-shell">
      <header className="topbar card" style={{ position: 'relative' }}>
        <div className="topbar-inner">
          <div className="brand" onClick={() => navigate('/dashboard')}>
            <img src="/pocket-logo.svg" alt="PocketPlan logo" className="brand-logo" />
            <span className="brand-title">PocketPlan</span>
          </div>
          <nav className="tab-nav">
            {navItems.map((item) => (
              <button
                key={item.path}
                className={`tab-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="user-wrap">
            <div
              className="user-pill"
              onMouseEnter={() => setShowMenu(true)}
              onMouseLeave={() => setShowMenu(false)}
              onClick={() => setShowMenu((prev) => !prev)}
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="User" className="avatar" />
              ) : (
                <div className="avatar placeholder">{user?.name?.[0]?.toUpperCase() || '?'}</div>
              )}
              <div className="user-info">
                <span className="user-name">{user?.name}</span>
              </div>
            </div>
            {showMenu && (
              <div
                className="user-menu card"
                onMouseEnter={() => setShowMenu(true)}
                onMouseLeave={() => setShowMenu(false)}
              >
                <button className="menu-item" onClick={() => { setShowMenu(false); navigate('/profile'); }}>
                  Edit Profile
                </button>
                <button className="menu-item logout" onClick={() => { setShowMenu(false); logout(); }}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <Toast toast={toast} />
      <main>
        <div className="page-transition" key={location.pathname}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
