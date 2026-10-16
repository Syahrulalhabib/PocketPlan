import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, isDummyEmail } from '../providers/AuthProvider.jsx';
import { useTheme } from '../providers/ThemeProvider.jsx';
import { SunIcon, MoonIcon, EyeIcon } from '../components/Icons.jsx';
import { PockySvg } from '../components/FloatingMascot.jsx';
import pocketLogo from '../assets/pocket-logo.svg';

const ActionCard = ({
  actionStatus,
  user,
  navigate,
  resendEmail,
  setResendEmail,
  resendLoading,
  handleResendFromAction,
  error,
  status
}) => {
  if (actionStatus === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '24px 8px' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid #fee2e2', borderTop: '3px solid #e45153', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 1s linear infinite' }} />
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text, #0f172a)' }}>Memverifikasi Email Kamu...</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-subtle, #64748b)', margin: 0, lineHeight: 1.5 }}>
          Mohon tunggu sebentar, sistem sedang memvalidasi tautan keamanan akun Anda.
        </p>
      </div>
    );
  }

  if (actionStatus === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '24px 8px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#ecfdf5', border: '2px solid #a7f3d0', color: '#10b981', display: 'grid', placeItems: 'center', margin: '0 auto 18px', fontSize: '32px', fontWeight: 800 }}>
          ✓
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 10px', color: 'var(--text, #0f172a)' }}>
          Email Telah Diverifikasi ✓
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-subtle, #64748b)', margin: '0 0 24px', lineHeight: 1.6 }}>
          Alamat email Anda telah berhasil diverifikasi. Akun Pocketplan Anda kini aktif dan siap digunakan.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="pill btn-primary auth-submit"
            onClick={() => {
              if (user) navigate('/dashboard');
              else navigate('/login');
            }}
          >
            {user ? 'Buka Dashboard' : 'Masuk ke Akun'}
          </button>
          <Link to="/" className="mini-link" style={{ textAlign: 'center', marginTop: '6px' }}>
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  if (actionStatus === 'expired') {
    return (
      <div style={{ textAlign: 'center', padding: '16px 8px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fef3c7', border: '2px solid #fde68a', color: '#d97706', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: '28px' }}>
          ⏱️
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text, #0f172a)' }}>
          Tautan Verifikasi Kedaluwarsa
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-subtle, #64748b)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Tautan verifikasi ini sudah kedaluwarsa karena telah melewati batas waktu 24 jam.
        </p>
        {user ? (
          <div className="auth-form" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '14px', margin: '0 0 12px', color: 'var(--text)' }}>
              Kirim ulang link verifikasi ke: <strong>{user.email}</strong>
            </p>
            <button
              type="button"
              className="pill btn-primary auth-submit"
              onClick={handleResendFromAction}
              disabled={resendLoading}
            >
              {resendLoading ? 'Mengirim...' : 'Kirim Ulang Email Verifikasi'}
            </button>
            {error && <div className="form-status" style={{ color: '#ef4444' }}>{error}</div>}
            {!error && status && <div className="form-status" style={{ color: '#10b981' }}>{status}</div>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              className="pill btn-primary auth-submit"
              onClick={() => navigate('/login')}
            >
              Masuk untuk Minta Link Baru
            </button>
          </div>
        )}
        <div className="auth-footer" style={{ marginTop: '20px' }}>
          <Link to="/login" className="primary-link">Kembali ke Halaman Masuk</Link>
        </div>
      </div>
    );
  }

  if (actionStatus === 'invalid') {
    return (
      <div style={{ textAlign: 'center', padding: '16px 8px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', border: '2px solid #fecaca', color: '#ef4444', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: '28px' }}>
          ⚠️
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text, #0f172a)' }}>
          Tautan Tidak Valid
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-subtle, #64748b)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Tautan verifikasi tidak dikenali, rusak, atau sudah pernah digunakan sebelumnya.
        </p>
        {user ? (
          <div className="auth-form" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '14px', margin: '0 0 12px', color: 'var(--text)' }}>
              Kirim ulang link verifikasi ke: <strong>{user.email}</strong>
            </p>
            <button
              type="button"
              className="pill btn-primary auth-submit"
              onClick={handleResendFromAction}
              disabled={resendLoading}
            >
              {resendLoading ? 'Mengirim...' : 'Kirim Link Verifikasi Baru'}
            </button>
            {error && <div className="form-status" style={{ color: '#ef4444' }}>{error}</div>}
            {!error && status && <div className="form-status" style={{ color: '#10b981' }}>{status}</div>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              className="pill btn-primary auth-submit"
              onClick={() => navigate('/login')}
            >
              Masuk ke Akun
            </button>
          </div>
        )}
        <div className="auth-footer" style={{ marginTop: '20px' }}>
          <Link to="/login" className="primary-link">Kembali ke Halaman Masuk</Link>
        </div>
      </div>
    );
  }

  return null;
};

const VerificationPage = () => {
  const {
    user,
    logout,
    resendVerification,
    changeEmailAndSendVerification,
    checkEmailVerified,
    setupWebPassword,
    verifyCode
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const location = useLocation();

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

  // Action status: 'idle' | 'loading' | 'success' | 'expired' | 'invalid'
  const [actionStatus, setActionStatus] = useState('idle');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

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

  // Handle email action codes (?oobCode=... or preview ?state=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oobCode = params.get('oobCode');
    const stateParam = params.get('state');
    const sourceParam = params.get('source');
    const emailParam = params.get('email');
    if (emailParam) setResendEmail(emailParam);

    if (stateParam === 'expired' || oobCode === 'expired') {
      setActionStatus('expired');
      return;
    }
    if (stateParam === 'invalid' || oobCode === 'invalid') {
      setActionStatus('invalid');
      return;
    }
    if (stateParam === 'loading') {
      setActionStatus('loading');
      return;
    }
    if (stateParam === 'success') {
      setActionStatus('success');
      return;
    }

    if (oobCode) {
      setActionStatus('loading');
      verifyCode(oobCode)
        .then((res) => {
          setActionStatus('success');
          const isTg = Boolean(res?.isTelegramUser || user?.isTelegramUser);
          const hasPwd = Boolean(res?.webPasswordSet || user?.webPasswordSet);
          if (isTg && !hasPwd) {
            // Skenario B: otomatis arahkan ke form pembuatan password akun web
            setTimeout(() => {
              setActionStatus('idle');
            }, 1000);
          } else if (sourceParam === 'register') {
            // Skenario A: registrasi web biasa -> redirect ke halaman registrasi dengan verified=true
            navigate('/registration?verified=true', { replace: true });
          }
        })
        .catch((err) => {
          if (err?.code === 'auth/expired-action-code') {
            setActionStatus('expired');
          } else {
            setActionStatus('invalid');
          }
        });
    }
  }, [location.search, verifyCode, user, navigate]);

  // Skenario B: Auto-polling when user is waiting on step 2
  useEffect(() => {
    if (!user || step !== 2 || actionStatus !== 'idle') return;
    const interval = setInterval(async () => {
      try {
        const ok = await checkEmailVerified();
        if (ok) {
          // isVerified becomes true, step automatically updates to 3!
        }
      } catch {
        // silent polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [user, step, actionStatus, checkEmailVerified]);

  useEffect(() => {
    if (user && step === 4 && actionStatus === 'idle') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, step, actionStatus, navigate]);

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

  const handleResendFromAction = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    setResendLoading(true);
    setError('');
    setStatus('');
    try {
      await sendVerificationEmail();
      setResendSuccess(true);
      setStatus(`Tautan verifikasi baru berhasil dikirim ke ${user.email}. Silakan periksa inbox Anda.`);
    } catch (err) {
      setError(err?.message || 'Gagal mengirim ulang email verifikasi.');
    } finally {
      setResendLoading(false);
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
      <div className="auth-mascot">
        <PockySvg width={80} height={85} />
      </div>

      <div className="auth-panel card">
        <div className="auth-top-nav">
          {user ? (
            <button type="button" className="mini-link auth-back-link" onClick={() => logout().then(() => navigate('/login'))}>
              &larr; Keluar
            </button>
          ) : (
            <Link to="/" className="mini-link auth-back-link">
              &larr; Back to Home
            </Link>
          )}
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
            <div className="brand" onClick={() => (user ? null : navigate('/'))}>
              <img src={pocketLogo} alt="Pocketplan logo" style={{ width: '32px', height: '26px' }} />
              <span className="brand-name">Pocketplan</span>
            </div>
          </div>
        </div>
        {actionStatus !== 'idle' ? (
          <ActionCard
            actionStatus={actionStatus}
            user={user}
            navigate={navigate}
            resendEmail={resendEmail}
            setResendEmail={setResendEmail}
            resendLoading={resendLoading}
            handleResendFromAction={handleResendFromAction}
            error={error}
            status={status}
          />
        ) : user ? (
          <div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= 1 ? 'var(--primary, #e45153)' : 'var(--border, #e2e8f0)' }} />
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= 2 ? 'var(--primary, #e45153)' : 'var(--border, #e2e8f0)' }} />
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= 3 ? 'var(--primary, #e45153)' : 'var(--border, #e2e8f0)' }} />
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
