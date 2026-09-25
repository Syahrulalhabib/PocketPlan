import { UserIcon, MailIcon, CheckIcon } from './Icons.jsx';

const ProfileGeneralTab = ({
  name,
  setName,
  email,
  setEmail,
  onSubmit,
  isSubmitting
}) => {
  return (
    <form className="profile-tab-form" onSubmit={onSubmit}>
      <div className="form-section-intro">
        <h3 className="section-title">Personal Information</h3>
        <p className="section-desc">
          Update your account details and manage how your profile appears across PocketPlan.
        </p>
      </div>

      <div className="profile-field-group">
        <label htmlFor="profile-fullname" className="profile-field-label">
          Full Name
        </label>
        <div className="input-with-icon-wrap">
          <span className="input-icon-badge">
            <UserIcon size={16} />
          </span>
          <input
            id="profile-fullname"
            className="input input-with-icon"
            placeholder="e.g. John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="profile-field-group">
        <label htmlFor="profile-email" className="profile-field-label">
          Email Address
        </label>
        <div className="input-with-icon-wrap">
          <span className="input-icon-badge">
            <MailIcon size={16} />
          </span>
          <input
            id="profile-email"
            className="input input-with-icon"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <span className="field-hint">
          Used for login and notifications. Keep your address current.
        </span>
      </div>

      <div className="profile-form-footer">
        <button
          type="submit"
          className="pill btn-primary profile-save-btn"
          disabled={isSubmitting}
        >
          <CheckIcon size={16} />
          <span>{isSubmitting ? 'Saving Changes...' : 'Save Changes'}</span>
        </button>
      </div>
    </form>
  );
};

export default ProfileGeneralTab;
