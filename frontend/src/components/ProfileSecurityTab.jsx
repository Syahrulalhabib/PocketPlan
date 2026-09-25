import { LockIcon, ShieldCheckIcon, EyeIcon } from './Icons.jsx';

const ProfileSecurityTab = ({
  password,
  setPassword,
  confirm,
  setConfirm,
  showPassword,
  setShowPassword,
  showConfirm,
  setShowConfirm,
  pwdStrength,
  passwordsMatch,
  onSubmit,
  isSubmitting
}) => {
  return (
    <form className="profile-tab-form" onSubmit={onSubmit}>
      <div className="form-section-intro">
        <h3 className="section-title">Change Password</h3>
        <p className="section-desc">
          Ensure your account stays secure with a strong and unique password.
        </p>
      </div>

      <div className="profile-field-group">
        <label htmlFor="profile-new-pwd" className="profile-field-label">
          New Password
        </label>
        <div className="input-with-icon-wrap">
          <span className="input-icon-badge">
            <LockIcon size={16} />
          </span>
          <input
            id="profile-new-pwd"
            className="input input-with-icon"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter new password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {password && (
            <button
              type="button"
              className="input-eye-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={showPassword} size={16} />
            </button>
          )}
        </div>

        {/* Password Strength Meter */}
        {password && (
          <div className="pwd-strength-container">
            <div className="pwd-strength-bars">
              <span
                className={`strength-bar ${pwdStrength.score >= 1 ? 'active' : ''}`}
                style={{ backgroundColor: pwdStrength.score >= 1 ? pwdStrength.color : undefined }}
              />
              <span
                className={`strength-bar ${pwdStrength.score >= 2 ? 'active' : ''}`}
                style={{ backgroundColor: pwdStrength.score >= 2 ? pwdStrength.color : undefined }}
              />
              <span
                className={`strength-bar ${pwdStrength.score >= 3 ? 'active' : ''}`}
                style={{ backgroundColor: pwdStrength.score >= 3 ? pwdStrength.color : undefined }}
              />
            </div>
            <span className="pwd-strength-text" style={{ color: pwdStrength.color }}>
              Strength: {pwdStrength.label}
            </span>
          </div>
        )}
      </div>

      <div className="profile-field-group">
        <label htmlFor="profile-confirm-pwd" className="profile-field-label">
          Confirm New Password
        </label>
        <div className="input-with-icon-wrap">
          <span className="input-icon-badge">
            <ShieldCheckIcon size={16} />
          </span>
          <input
            id="profile-confirm-pwd"
            className="input input-with-icon"
            type={showConfirm ? 'text' : 'password'}
            placeholder="Re-enter your new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {confirm && (
            <button
              type="button"
              className="input-eye-btn"
              onClick={() => setShowConfirm((prev) => !prev)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={showConfirm} size={16} />
            </button>
          )}
        </div>
        {passwordsMatch && (
          <div className="pwd-match-badge">
            <ShieldCheckIcon size={13} />
            <span>Passwords match</span>
          </div>
        )}
      </div>

      <div className="profile-form-footer">
        <button
          type="submit"
          className="pill btn-primary profile-save-btn"
          disabled={isSubmitting || !password}
        >
          <LockIcon size={16} />
          <span>{isSubmitting ? 'Updating Password...' : 'Update Password'}</span>
        </button>
      </div>
    </form>
  );
};

export default ProfileSecurityTab;
