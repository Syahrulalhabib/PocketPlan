import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useTheme } from '../providers/ThemeProvider.jsx';
import SavingsMascot from '../components/SavingsMascot.jsx';

const VerificationPage = () => {
  const { resendVerification } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await resendVerification(email, password);
      setStatus('Verification email sent. Please check your inbox.');
    } catch (err) {
      setError(err?.message || 'Failed to send verification email.');
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
      <div className="auth-hero left">
        <SavingsMascot mode="hero" />
      </div>
      <div className="auth-panel card">
        <div className="auth-header">
          <h1>EMAIL VERIFICATION</h1>
          <p>Request a verification email for your account.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Email</label>
          <input className="input" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Password</label>
          <input
            className="input"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="pill btn-primary auth-submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send verification email'}
          </button>
          {error && <div className="form-status">{error}</div>}
          {!error && status && <div className="form-status">{status}</div>}
        </form>
        <div className="auth-footer">
          <Link to="/login" className="primary-link">Back to sign in</Link>
        </div>
        <div className="auth-footer">
          <button type="button" className="mini-link" onClick={() => navigate('/register')}>
            Create a new account
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerificationPage;
