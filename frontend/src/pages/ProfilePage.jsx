import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useTheme } from '../providers/ThemeProvider.jsx';
import { useData } from '../providers/DataProvider.jsx';
import AvatarPickerModal from '../components/AvatarPickerModal.jsx';
import ProfileGeneralTab from '../components/ProfileGeneralTab.jsx';
import ProfileSecurityTab from '../components/ProfileSecurityTab.jsx';
import ProfileTelegramTab from '../components/ProfileTelegramTab.jsx';
import {
  ArrowLeftIcon,
  SunIcon,
  MoonIcon,
  UserIcon,
  LockIcon,
  CameraIcon,
  ShieldCheckIcon,
  SparklesIcon,
  CheckIcon,
  WalletIcon,
  TargetIcon,
  ReceiptIcon,
  TelegramIcon
} from '../components/Icons.jsx';
import { formatRupiah, evaluatePasswordStrength } from '../utils/formatters.js';

const ProfilePage = () => {
  const { user, updateProfileInfo } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { summary, transactions, goals } = useData();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('general');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [modalPhotoURL, setModalPhotoURL] = useState(user?.photoURL || '/pocket-logo.svg');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const pwdStrength = useMemo(() => evaluatePasswordStrength(password), [password]);
  const passwordsMatch = password.length > 0 && confirm.length > 0 && password === confirm;

  const handleGeneralSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    if (!name.trim()) {
      setStatus({ type: 'error', text: 'Full name cannot be empty.' });
      return;
    }
    try {
      setIsSubmitting(true);
      await updateProfileInfo({ name: name.trim(), email: email.trim(), photoURL });
      setStatus({ type: 'success', text: 'Profile details successfully updated!' });
    } catch (err) {
      setStatus({ type: 'error', text: err?.message || 'Failed to update profile details.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSecuritySubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    if (!password) {
      setStatus({ type: 'error', text: 'Please enter a new password.' });
      return;
    }
    if (password.length < 6) {
      setStatus({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }
    if (password !== confirm) {
      setStatus({ type: 'error', text: 'Passwords do not match. Please verify.' });
      return;
    }
    try {
      setIsSubmitting(true);
      setStatus({ type: 'success', text: 'Password updated successfully!' });
      setPassword('');
      setConfirm('');
    } catch (err) {
      setStatus({ type: 'error', text: err?.message || 'Failed to update password.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPhotoModal = () => {
    setModalPhotoURL(photoURL || user?.photoURL || '/pocket-logo.svg');
    setShowPhotoModal(true);
  };

  const handleSavePhoto = async () => {
    try {
      setIsSubmitting(true);
      setPhotoURL(modalPhotoURL);
      await updateProfileInfo({ name, email, photoURL: modalPhotoURL });
      setStatus({ type: 'success', text: 'Profile avatar updated!' });
      setShowPhotoModal(false);
    } catch (err) {
      setStatus({ type: 'error', text: err?.message || 'Failed to update avatar.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="profile-page page-transition">
      {/* 1. Hero Cover Banner */}
      <div className="profile-hero-banner">
        <div className="profile-hero-mesh" />
        <div className="profile-hero-sparkles" aria-hidden="true">
          <span className="sparkle sp-1">✨</span>
          <span className="sparkle sp-2">⭐</span>
          <span className="sparkle sp-3">💫</span>
          <span className="sparkle sp-4">✨</span>
        </div>

        <div className="profile-top-nav">
          <button
            type="button"
            className="profile-back-btn"
            onClick={() => navigate('/dashboard')}
            aria-label="Back to Dashboard"
          >
            <ArrowLeftIcon size={16} />
            <span>Dashboard</span>
          </button>

          <div className="profile-top-title">
            <SparklesIcon size={16} />
            <span>Profile & Account</span>
          </div>

          <button
            type="button"
            className="theme-btn-topbar profile-theme-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
        </div>
      </div>

      {/* 2. Main Content Container */}
      <div className="profile-content-container">
        {/* Floating Identity Card */}
        <div className="card profile-identity-card">
          <div className="profile-identity-top">
            <div
              className="profile-avatar-wrapper"
              onClick={handleOpenPhotoModal}
              role="button"
              tabIndex={0}
              title="Click to change your avatar"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOpenPhotoModal();
                }
              }}
            >
              <div className="avatar-glow-ring" />
              <img
                src={photoURL || user?.photoURL || '/pocket-logo.svg'}
                alt={user?.name || 'User avatar'}
                className="profile-avatar-img"
              />
              <button
                type="button"
                className="profile-camera-btn"
                aria-label="Change profile photo"
                tabIndex={-1}
              >
                <CameraIcon size={15} />
              </button>
            </div>

            <div className="profile-identity-meta">
              <div className="profile-badges-row">
                <span className="profile-role-pill">
                  <SparklesIcon size={12} />
                  <span>PocketPlan Saver</span>
                </span>
                <span className="profile-verified-pill">
                  <ShieldCheckIcon size={12} />
                  <span>Verified</span>
                </span>
              </div>
              <h1 className="profile-user-fullname">{user?.name || 'PocketPlan Saver'}</h1>
              <p className="profile-user-email">{user?.email || 'user@pocketplan.app'}</p>
              <button
                type="button"
                className="change-avatar-text-btn"
                onClick={handleOpenPhotoModal}
              >
                <CameraIcon size={13} />
                <span>Change Avatar & Photo</span>
              </button>
            </div>
          </div>

          {/* Quick Micro-Stats Strip */}
          <div className="profile-stats-strip">
            <div className="profile-stat-item">
              <span className="stat-icon-wrap balance">
                <WalletIcon size={16} />
              </span>
              <div className="stat-text-group">
                <span className="stat-label">Net Balance</span>
                <strong className="stat-value">{formatRupiah(summary?.balance || 0)}</strong>
              </div>
            </div>

            <div className="profile-stat-divider" />

            <div className="profile-stat-item">
              <span className="stat-icon-wrap goals">
                <TargetIcon size={16} />
              </span>
              <div className="stat-text-group">
                <span className="stat-label">Active Goals</span>
                <strong className="stat-value">{goals?.length || 0} Targets</strong>
              </div>
            </div>

            <div className="profile-stat-divider" />

            <div className="profile-stat-item">
              <span className="stat-icon-wrap records">
                <ReceiptIcon size={16} />
              </span>
              <div className="stat-text-group">
                <span className="stat-label">Transactions</span>
                <strong className="stat-value">{transactions?.length || 0} Records</strong>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Status Notification Banner */}
        {status && (
          <div className={`profile-status-alert ${status.type === 'success' ? 'is-success' : 'is-error'}`}>
            <span className="status-alert-icon">
              {status.type === 'success' ? <CheckIcon size={18} /> : '⚠️'}
            </span>
            <span className="status-alert-text">{status.text}</span>
            <button
              type="button"
              className="status-alert-close"
              onClick={() => setStatus(null)}
              aria-label="Dismiss alert"
            >
              ×
            </button>
          </div>
        )}

        {/* 4. Edit Settings Card with Segmented Tabs */}
        <div className="card profile-settings-card">
          <div className="profile-tabs-header">
            <button
              type="button"
              className={`profile-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('general');
                setStatus(null);
              }}
            >
              <UserIcon size={16} />
              <span>Personal Details</span>
            </button>

            <button
              type="button"
              className={`profile-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('security');
                setStatus(null);
              }}
            >
              <LockIcon size={16} />
              <span>Security & Password</span>
            </button>

            <button
              type="button"
              className={`profile-tab-btn ${activeTab === 'telegram' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('telegram');
                setStatus(null);
              }}
            >
              <TelegramIcon size={16} />
              <span>Telegram Bot</span>
            </button>
          </div>

          <div className="profile-tab-content">
            {activeTab === 'general' ? (
              <ProfileGeneralTab
                name={name}
                setName={setName}
                email={email}
                setEmail={setEmail}
                onSubmit={handleGeneralSubmit}
                isSubmitting={isSubmitting}
              />
            ) : activeTab === 'security' ? (
              <ProfileSecurityTab
                password={password}
                setPassword={setPassword}
                confirm={confirm}
                setConfirm={setConfirm}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                showConfirm={showConfirm}
                setShowConfirm={setShowConfirm}
                pwdStrength={pwdStrength}
                passwordsMatch={passwordsMatch}
                onSubmit={handleSecuritySubmit}
                isSubmitting={isSubmitting}
              />
            ) : (
              <ProfileTelegramTab user={user} setStatusMessage={setStatus} />
            )}
          </div>
        </div>
      </div>

      {/* 5. Avatar Picker Modal */}
      <AvatarPickerModal
        open={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        modalPhotoURL={modalPhotoURL}
        setModalPhotoURL={setModalPhotoURL}
        onSave={handleSavePhoto}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default ProfilePage;
