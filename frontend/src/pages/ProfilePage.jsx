import { useAuth } from '../providers/AuthProvider.jsx';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Modal from '../components/Modal.jsx';

const EyeIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M2 12c2.5-4 6.5-6.5 10-6.5s7.5 2.5 10 6.5c-2.5 4-6.5 6.5-10 6.5S4.5 16 2 12Z" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" strokeWidth="2" />
    {!open && <line x1="4" y1="4" x2="20" y2="20" strokeWidth="2" />}
  </svg>
);

const ProfilePage = () => {
  const { user, updateProfileInfo } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('');
    if (password !== confirm) {
      setStatus('Password and confirmation do not match.');
      return;
    }
    try {
      await updateProfileInfo({ name, email, photoURL });
      setStatus('Profile updated successfully.');
    } catch (err) {
      setStatus(err?.message || 'Failed to update profile.');
    }
  };

  const handlePhotoSubmit = async () => {
    try {
      await updateProfileInfo({ name, email, photoURL });
      setStatus('Profile photo updated.');
      setShowPhotoModal(false);
    } catch (err) {
      setStatus(err?.message || 'Failed to update profile photo.');
    }
  };

  return (
    <div className="profile-page page-transition">
      <div className="profile-header">
        <button className="tab-item active profile-back" onClick={() => navigate('/dashboard')}>
          Dashboard
        </button>
      </div>
      <div className="profile-body">
        <div
          className="profile-avatar"
          onClick={() => {
            setShowPhotoModal(true);
          }}
          style={{ cursor: 'pointer' }}
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="avatar" />
          ) : (
            <img src="/pocket-logo.svg" alt="avatar" />
          )}
        </div>
        <h2 className="profile-name">{user?.name}</h2>
        <p className="profile-email">{user?.email}</p>

        <form className="profile-form card" onSubmit={handleSubmit}>
          <label>Fullname</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <label>Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>New Password</label>
          <div className="password-wrap">
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              placeholder="New password"
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
          <label>Confirm New Password</label>
          <div className="password-wrap">
            <input
              className="input"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm new password"
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
          <button className="pill btn-primary profile-submit">Submit</button>
          {status && <div className="form-status">{status}</div>}
        </form>
      </div>
      <Modal open={showPhotoModal} onClose={() => setShowPhotoModal(false)} title="Profile Photo">
        <div style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
          <img
            src={photoURL || user?.photoURL || '/pocket-logo.svg'}
            alt="Profile"
            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 16 }}
          />
          <div className="profile-photo-edit">
            <label>Photo URL</label>
            <input
              className="input"
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="pill btn-secondary" onClick={() => setShowPhotoModal(false)}>
              Cancel
            </button>
            <button type="button" className="pill btn-primary" onClick={handlePhotoSubmit}>
              Save Photo
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProfilePage;
