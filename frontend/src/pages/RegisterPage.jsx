import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useTheme } from '../providers/ThemeProvider.jsx';
import { useState } from 'react';
import { EyeIcon, SunIcon, MoonIcon } from '../components/Icons.jsx';
import SavingsMascot from '../components/SavingsMascot.jsx';
import pocketLogo from '../assets/pocket-logo.svg';

const RegisterPage = () => {
  const { register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

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
        setStatus('Verification email sent. Please verify your inbox before signing in.');
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
      <div className="auth-mobile-bar">
        <Link to="/" className="mini-link auth-back-link">
          &larr; Back to Home
        </Link>
        <button
          type="button"
          className="theme-btn-topbar auth-theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        >
          {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        </button>
      </div>
      <div className="auth-hero left">
        <SavingsMascot mode="hero" />
      </div>
      <div className="auth-panel card">
        <div className="auth-top-nav">
          <div className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <img src={pocketLogo} alt="Pocketplan logo" style={{ width: '32px', height: '26px' }} />
            <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.02em', color: 'var(--text)' }}>Pocketplan</span>
          </div>
          <Link to="/" className="mini-link" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--primary)' }}>
            &larr; Back to Home
          </Link>
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
          {error && <div className="form-status">{error}</div>}
          {!error && status && <div className="form-status">{status}</div>}
        </form>
        <div className="auth-footer">
          Already have an account? <Link to="/login" className="primary-link">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
