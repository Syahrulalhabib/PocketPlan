import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useTheme } from '../providers/ThemeProvider.jsx';
import { useState, useEffect } from 'react';
import { EyeIcon, SunIcon, MoonIcon } from '../components/Icons.jsx';
import SavingsMascot from '../components/SavingsMascot.jsx';
import pocketLogo from '../assets/pocket-logo.svg';

const RegisterPage = () => {
  const { register, logout, checkEmailVerified } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [waitingVerification, setWaitingVerification] = useState(false);
  const [verified, setVerified] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Check URL query param e.g. /registration?verified=true
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('verified') === 'true' || params.get('verified') === '1') {
      setVerified(true);
      setShowLoginModal(true);
    }
  }, [location.search]);

  // Polling check while waiting for verification
  useEffect(() => {
    if (!waitingVerification || verified) return;
    const interval = setInterval(async () => {
      try {
        const ok = await checkEmailVerified();
        if (ok) {
          setVerified(true);
          setWaitingVerification(false);
          setShowLoginModal(true);
          setStatus('');
        }
      } catch {
        // silent polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [waitingVerification, verified, checkEmailVerified]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');
    if (!name || !email || !password || !confirm) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      setError('Password and confirmation do not match.');
      return;
    }
    setLoading(true);
    try {
      const result = await register(name, email, password);
      if (result?.needsVerification) {
        setWaitingVerification(true);
        setStatus(`Email verifikasi telah dikirim ke ${email}. Silakan buka inbox email Anda dan klik link verifikasi.`);
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      if (err?.code === 'auth/email-already-in-use') {
        setError('Email already in use. If you signed up with Google, use Google Sign-in on the login page.');
      } else if (err?.code === 'auth/weak-password') {
        setError('Password too weak. Please use at least 6 characters.');
      } else if (err?.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else {
        setError(err?.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-page ${isDark ? 'theme-dark' : ''}`}>
      <div className="auth-hero left">
        <SavingsMascot mode="hero" />
      </div>
      <div className="auth-panel card">
        <div className="auth-top-nav">
          <Link to="/" className="mini-link auth-back-link">
            &larr; Back to Home
          </Link>
          <div className="auth-top-actions">
            <button
              type="button"
              className="theme-btn-topbar auth-theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
              {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            </button>
            <div className="brand" onClick={() => navigate('/')}>
              <img src={pocketLogo} alt="Pocketplan logo" style={{ width: '32px', height: '26px' }} />
              <span className="brand-name">Pocketplan</span>
            </div>
          </div>
        </div>
        <div className="auth-header">
          <h1>REGISTRATION</h1>
          <p>Start your journey to smart saving and a brighter future.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Fullname</label>
          <input className="input" placeholder="Enter your Fullname" value={name} onChange={(e) => setName(e.target.value)} />
          <label>Email</label>
          <input className="input" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Password</label>
          <div className="password-wrap">
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {password && (
              <button
                type="button"
                className="eye"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            )}
          </div>
          <label>Confirm Password</label>
          <div className="password-wrap">
            <input
              className="input"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm && (
              <button
                type="button"
                className="eye"
                onClick={() => setShowConfirm((prev) => !prev)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showConfirm} />
              </button>
            )}
          </div>
          <button className="pill btn-primary auth-submit" disabled={loading}>
            {loading ? 'Signing up...' : 'Sign up'}
          </button>
          {verified && (
            <div className="form-status" style={{ background: '#ecfdf5', border: '1px solid #10b981', color: '#065f46', borderRadius: '10px', padding: '12px 14px', fontWeight: 600 }}>
              Email telah diverifikasi ✓
            </div>
          )}
          {error && <div className="form-status">{error}</div>}
          {!error && status && !verified && <div className="form-status">{status}</div>}
        </form>
        <div className="auth-footer">
          Already have an account? <Link to="/login" className="primary-link">Sign in</Link>
        </div>
      </div>

      {showLoginModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 9999, padding: '16px' }}>
          <div className="card modal-content" style={{ maxWidth: '420px', width: '100%', padding: '32px 24px', textAlign: 'center', borderRadius: '20px', background: 'var(--card, #fff)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#ecfdf5', border: '2px solid #a7f3d0', color: '#10b981', display: 'grid', placeItems: 'center', margin: '0 auto 18px', fontSize: '32px', fontWeight: 800 }}>
              ✓
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 10px', color: 'var(--text, #0f172a)' }}>
              Email telah diverifikasi ✓
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-subtle, #64748b)', margin: '0 0 24px', lineHeight: 1.6 }}>
              Selamat! Akun Pocketplan Anda telah aktif. Silakan masuk untuk mulai mengelola keuangan dan mewujudkan impian Anda.
            </p>
            <button
              type="button"
              className="pill btn-primary"
              style={{ width: '100%', padding: '12px 20px', fontSize: '15px', fontWeight: 600 }}
              onClick={async () => {
                setShowLoginModal(false);
                await logout();
                navigate('/login');
              }}
            >
              Masuk ke Akun
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterPage;
