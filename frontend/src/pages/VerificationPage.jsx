import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, isDummyEmail } from '../providers/AuthProvider.jsx';
import { useTheme } from '../providers/ThemeProvider.jsx';
import { SunIcon, MoonIcon, EyeIcon } from '../components/Icons.jsx';
import SavingsMascot from '../components/SavingsMascot.jsx';
import pocketLogo from '../assets/pocket-logo.svg';

const VerificationPage = () => {
  const {
    user,
    logout,
    resendVerification,
    changeEmailAndSendVerification,
    checkEmailVerified,
    setupWebPassword
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const [emailInput, setEmailInput] = useState('');
  const [editEmail, setEditEmail] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPwd, setGuestPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const hasDummy = user ? isDummyEmail(user.email) : false;
  const isVerified = user ? Boolean(user.emailVerified) : false;
  const hasWebPwd = user ? Boolean(user.webPasswordSet) : false;

  let step = 1;
  if (user) {
    if (hasDummy || editEmail) step = 1;
    else if (!isVerified) step = 2;
    else if (!hasWebPwd) step = 3;
    else step = 4;
  }

  useEffect(() => {
    if (user && step === 4) navigate('/dashboard', { replace: true });
  }, [user, step, navigate]);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');
    const target = emailInput.trim();
    if (!target || !target.includes('@') || isDummyEmail(target)) {
      setError('Masukkan email asli yang valid.');
      return;
    }
    setLoading(true);
    try {
      await changeEmailAndSendVerification(target);
      setEditEmail(false);
      setStatus(`Email verifikasi dikirim ke ${target}. Silakan periksa inbox/spam.`);
    } catch (err) {
      setError(err?.message || 'Gagal mengirim verifikasi.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerify = async () => {
    setError('');
    setStatus('');
    setLoading(true);
    try {
      const ok = await checkEmailVerified();
      if (ok) setStatus('Email terverifikasi! Silakan set password web.');
      else setError('Email belum diverifikasi. Buka link verifikasi di email Anda terlebih dahulu.');
    } catch (err) {
      setError(err?.message || 'Gagal memeriksa verifikasi.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');
    if (!password || password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }
    if (password !== confirm) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }
    setLoading(true);
    try {
      await setupWebPassword(password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err?.message || 'Gagal menyimpan password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');
    if (!guestEmail || !guestPwd) {
      setError('Masukkan email dan password.');
      return;
    }
    setLoading(true);
    try {
      await resendVerification(guestEmail, guestPwd);
      setStatus('Verification email sent.');
    } catch (err) {
      setError(err?.message || 'Gagal mengirim email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-page ${isDark ? 'theme-dark' : ''}`}>
      <div className="auth-mobile-bar">
        {user ? (
          <button type="button" className="mini-link auth-back-link" onClick={() => logout().then(() => navigate('/login'))}>
            &larr; Keluar
          </button>
        ) : (
          <Link to="/" className="mini-link auth-back-link">&larr; Back to Home</Link>
        )}
        <button type="button" className="theme-btn-topbar auth-theme-toggle" onClick={toggleTheme}>
          {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        </button>
      </div>

      <div className="auth-hero left">
        <SavingsMascot mode="hero" />
      </div>

      <div className="auth-panel card">
        <div className="auth-top-nav">
          <div className="brand" onClick={() => (user ? null : navigate('/'))}>
            <img src={pocketLogo} alt="Pocketplan logo" style={{ width: '32px', height: '26px' }} />
            <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.02em', color: 'var(--text)' }}>Pocketplan</span>
          </div>
          {user ? (
            <button type="button" className="mini-link" onClick={() => logout().then(() => navigate('/login'))}>Keluar</button>
          ) : (
            <Link to="/" className="mini-link">&larr; Back to Home</Link>
          )}
        </div>
        {user ? (
          <div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= 1 ? 'var(--primary, #0ea5e9)' : 'var(--border, #e2e8f0)' }} />
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= 2 ? 'var(--primary, #0ea5e9)' : 'var(--border, #e2e8f0)' }} />
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= 3 ? 'var(--primary, #0ea5e9)' : 'var(--border, #e2e8f0)' }} />
            </div>

            {step === 1 && (
              <>
                <div className="auth-header">
                  <h1>AKTIVASI AKUN WEB</h1>
                  <p>Langkah 1/3: Masukkan email asli Anda untuk mengamankan akun dan membuka akses website.</p>
                </div>
                <form className="auth-form" onSubmit={handleEmailSubmit}>
                  <label>Email Asli</label>
                  <input className="input" type="email" placeholder="nama@gmail.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} required />
                  <button className="pill btn-primary auth-submit" disabled={loading}>{loading ? 'Mengirim...' : 'Kirim Link Verifikasi'}</button>
                  {error && <div className="form-status" style={{ color: '#ef4444' }}>{error}</div>}
                  {!error && status && <div className="form-status" style={{ color: '#10b981' }}>{status}</div>}
                </form>
              </>
            )}

            {step === 2 && (
              <>
                <div className="auth-header">
                  <h1>VERIFIKASI EMAIL</h1>
                  <p>Langkah 2/3: Link verifikasi dikirim ke: <strong>{user.email}</strong>. Buka email Anda lalu klik link verifikasi.</p>
                </div>
                <div className="auth-form" style={{ gap: '10px' }}>
                  <button type="button" className="pill btn-primary auth-submit" onClick={handleCheckVerify} disabled={loading}>
                    {loading ? 'Memeriksa...' : '✅ Saya Sudah Klik Verifikasi'}
                  </button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="pill btn-secondary" style={{ flex: 1 }} onClick={() => changeEmailAndSendVerification(user.email).then(() => setStatus('Link dikirim ulang.'))} disabled={loading}>
                      🔄 Kirim Ulang
                    </button>
                    <button type="button" className="pill btn-secondary" style={{ flex: 1 }} onClick={() => setEditEmail(true)}>
                      ✏️ Ganti Email
                    </button>
                  </div>
                  {error && <div className="form-status" style={{ color: '#ef4444' }}>{error}</div>}
                  {!error && status && <div className="form-status" style={{ color: '#10b981' }}>{status}</div>}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="auth-header">
                  <h1>ATUR PASSWORD WEB</h1>
                  <p>Langkah 3/3: Email terverifikasi! Buat password untuk login website Pocketplan kapan saja.</p>
                </div>
                <form className="auth-form" onSubmit={handlePasswordSubmit}>
                  <label>Password Baru</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input" type={showPwd ? 'text' : 'password'} placeholder="Minimal 6 karakter" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowPwd((p) => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <EyeIcon size={16} />
                    </button>
                  </div>
                  <label>Konfirmasi Password</label>
                  <input className="input" type={showPwd ? 'text' : 'password'} placeholder="Ulangi password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                  <button className="pill btn-primary auth-submit" disabled={loading}>{loading ? 'Menyimpan...' : '🚀 Simpan & Buka Dashboard'}</button>
                  {error && <div className="form-status" style={{ color: '#ef4444' }}>{error}</div>}
                  {!error && status && <div className="form-status" style={{ color: '#10b981' }}>{status}</div>}
                </form>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="auth-header">
              <h1>EMAIL VERIFICATION</h1>
              <p>Request a verification email for your account.</p>
            </div>
            <form className="auth-form" onSubmit={handleGuestSubmit}>
              <label>Email</label>
              <input className="input" placeholder="Enter your email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
              <label>Password</label>
              <input className="input" type="password" placeholder="Enter your password" value={guestPwd} onChange={(e) => setGuestPwd(e.target.value)} />
              <button className="pill btn-primary auth-submit" disabled={loading}>{loading ? 'Sending...' : 'Send verification email'}</button>
              {error && <div className="form-status">{error}</div>}
              {!error && status && <div className="form-status">{status}</div>}
            </form>
            <div className="auth-footer">
              <Link to="/login" className="primary-link">Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerificationPage;
