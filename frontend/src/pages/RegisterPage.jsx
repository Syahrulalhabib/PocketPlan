import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useState } from 'react';

const EyeIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M2 12c2.5-4 6.5-6.5 10-6.5s7.5 2.5 10 6.5c-2.5 4-6.5 6.5-10 6.5S4.5 16 2 12Z" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" strokeWidth="2" />
    {!open && <line x1="4" y1="4" x2="20" y2="20" strokeWidth="2" />}
  </svg>
);

const RegisterPage = () => {
  const { register } = useAuth();
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
        setError('Email already in use. Please sign in or use a different email.');
      } else {
        setError(err?.message || 'Registration failed. Please try again.');
      }
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
          <h1>REGISTRATION</h1>
          <p>Please enter your details.</p>
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
