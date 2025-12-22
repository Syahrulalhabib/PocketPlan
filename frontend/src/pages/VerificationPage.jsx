import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider.jsx';

const VerificationPage = () => {
  const { resendVerification } = useAuth();
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
    <div className="auth-page">
      <div className="auth-hero left">
        <img src="/pocket-logo-text.svg" alt="PocketPlan" className="hero-logo" />
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
