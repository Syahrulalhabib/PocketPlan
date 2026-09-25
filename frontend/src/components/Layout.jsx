import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useData } from '../providers/DataProvider.jsx';
import { useTheme } from '../providers/ThemeProvider.jsx';
import Toast from './Toast.jsx';
import FloatingMascot from './FloatingMascot.jsx';
import { SunIcon, MoonIcon, UserIcon, LogOutIcon, ChevronDownIcon } from './Icons.jsx';
import { useState, useEffect, useRef } from 'react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/transactions', label: 'Transactions' },
  { path: '/goals', label: 'Goals' }
];

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { toast } = useData();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setShowMenu(false);
    };

    if (showMenu) {
      document.addEventListener('pointerdown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showMenu]);

  return (
    <div className="page-shell">
      <header className="topbar card">
        <div className="topbar-inner">
          <button
            type="button"
            className="brand brand-btn"
            onClick={() => navigate('/dashboard')}
            aria-label="PocketPlan Dashboard"
          >
            <img src="/pocket-logo.svg" alt="PocketPlan logo" className="brand-logo" />
            <span className="brand-title">PocketPlan</span>
          </button>

          <nav className="tab-nav" aria-label="Main navigation">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  className={`tab-item ${active ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="topbar-actions">
            <button
              type="button"
              className="theme-btn-topbar"
              onClick={toggleTheme}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
              {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            </button>

            <div className="user-wrap" ref={menuRef}>
              <button
                type="button"
                className={`user-pill ${showMenu ? 'open' : ''}`}
                onClick={() => setShowMenu((prev) => !prev)}
                aria-expanded={showMenu}
                aria-haspopup="true"
                aria-label="User profile menu"
              >
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="avatar" />
                ) : (
                  <div className="avatar placeholder" aria-hidden="true">
                    {user?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="user-info">
                  <span className="user-name">{user?.name || 'User'}</span>
                </div>
                <ChevronDownIcon size={14} className="user-pill-chevron" />
              </button>

              {showMenu && (
                <div className="user-menu card" role="menu">
                  <div className="user-menu-profile">
                    <span className="user-menu-name">{user?.name || 'User'}</span>
                    <span className="user-menu-email">{user?.email || 'demo@pocketplan.app'}</span>
                  </div>
                  <div className="user-menu-divider" />
                  <button
                    type="button"
                    className="menu-item"
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false);
                      navigate('/profile');
                    }}
                  >
                    <UserIcon size={16} />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    type="button"
                    className="menu-item logout"
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false);
                      logout();
                    }}
                  >
                    <LogOutIcon size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <Toast toast={toast} />

      <main>
        <div className="page-transition" key={location.pathname}>
          {children}
        </div>
      </main>

      <FloatingMascot />
    </div>
  );
};

export default Layout;
