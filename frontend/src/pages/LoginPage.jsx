import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useTheme } from '../providers/ThemeProvider.jsx';

const EyeIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M2 12c2.5-4 6.5-6.5 10-6.5s7.5 2.5 10 6.5c-2.5 4-6.5 6.5-10 6.5S4.5 16 2 12Z" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" strokeWidth="2" />
    {!open && <line x1="4" y1="4" x2="20" y2="20" strokeWidth="2" />}
  </svg>
);

const LoginPage = () => {
  const { login, googleLogin, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    const stored = localStorage.getItem('pp-remember');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data?.email) setEmail(data.email);
        if (data?.password) setPassword(data.password);
        setRemember(true);
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');
    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      if (remember) {
        localStorage.setItem('pp-remember', JSON.stringify({ email, password }));
      } else {
        localStorage.removeItem('pp-remember');
      }
      navigate('/dashboard');
    } catch (err) {
      const msg = err?.message?.toLowerCase().includes('wrong-password') || err?.message?.toLowerCase().includes('user')
        ? 'Incorrect email or password.'
        : 'Login failed. Please check your details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setStatus('');
    setLoading(true);
    try {
      await googleLogin();
      navigate('/dashboard');
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setStatus('Google sign-in cancelled.');
      } else {
        setError(err?.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setError('');
    setStatus('');
    if (!email) {
      setError('Please enter your email to reset password.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setStatus('Password reset email sent. Please check your inbox or spam folder.');
    } catch (err) {
      setError(err?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-page ${isDark ? 'theme-dark' : ''}`}>
      <button
        type="button"
        className={`theme-toggle ${isDark ? 'active' : ''}`}
        onClick={toggleTheme}
        aria-pressed={isDark}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      >
        <span className="toggle-thumb" />
        <span className="toggle-labels">
          <span className="sun">☀</span>
          <span className="moon">☾</span>
        </span>
      </button>
      <div className="auth-panel card">
        <div className="auth-header">
          <h1>WELCOME BACK</h1>
          <p>Welcome back! Please enter your details.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
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
          <div className="auth-row">
            <label className="remember">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
            </label>
            <button type="button" className="mini-link" onClick={handleForgot} disabled={loading}>
              Forgot password
            </button>
          </div>
          <button className="pill btn-primary auth-submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <button type="button" className="pill btn-secondary auth-submit google" onClick={handleGoogle} disabled={loading}>
            <span className="google-icon">G</span> Sign in with Google
          </button>
          {error && <div className="form-status">{error}</div>}
          {!error && status && <div className="form-status">{status}</div>}
        </form>
        <div className="auth-footer">
          Don&apos;t have an account? <Link to="/register" className="primary-link">Sign up for free</Link>
        </div>
      </div>
      <div className="auth-hero">
        <img src="/pocket-logo-text.svg" alt="PocketPlan" className="hero-logo" />
        <div className="hero-about" onClick={() => navigate('/about')}>
          <span className="dot" /> ABOUT US
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
