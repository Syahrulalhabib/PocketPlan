import Modal from './Modal.jsx';
import { CameraIcon, CheckIcon } from './Icons.jsx';

export const PRESET_AVATARS = [
  { id: 'piggy', label: 'Piggy Bank', url: '/pocket-logo.svg', emoji: '🐷' },
  { id: 'koiny', label: 'Lucky Coin', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Koiny&backgroundColor=fbbf24', emoji: '🪙' },
  { id: 'felix', label: 'Adventurer', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix&backgroundColor=ffd5dc', emoji: '🧭' },
  { id: 'aria', label: 'Smart Saver', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Aria&backgroundColor=b6e3f4', emoji: '💡' },
  { id: 'emoji', label: 'Joyful Face', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Pocket&backgroundColor=d1fae5', emoji: '✨' },
  { id: 'bot', label: 'Budget Bot', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Saver&backgroundColor=c7d2fe', emoji: '🤖' }
];

const AvatarPickerModal = ({
  open,
  onClose,
  modalPhotoURL,
  setModalPhotoURL,
  onSave,
  isSubmitting
}) => {
  return (
    <Modal open={open} onClose={onClose} title="Choose Profile Avatar">
      <div className="avatar-modal-body">
        {/* Live Preview Circle */}
        <div className="avatar-modal-preview">
          <div className="preview-ring">
            <img
              src={modalPhotoURL || '/pocket-logo.svg'}
              alt="Avatar preview"
              className="preview-img"
            />
          </div>
          <span className="preview-label">Live Preview</span>
        </div>

        {/* Preset Mascot Avatars */}
        <div className="avatar-preset-section">
          <span className="avatar-preset-heading">Pick a Mascot or Avatar</span>
          <div className="avatar-presets-grid">
            {PRESET_AVATARS.map((preset) => {
              const isSelected = modalPhotoURL === preset.url;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`avatar-preset-card ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => setModalPhotoURL(preset.url)}
                >
                  <div className="preset-avatar-thumb">
                    <img src={preset.url} alt={preset.label} />
                    {isSelected && (
                      <span className="preset-check-badge">
                        <CheckIcon size={12} />
                      </span>
                    )}
                  </div>
                  <span className="preset-title">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Photo URL Input */}
        <div className="avatar-custom-url-section">
          <label htmlFor="custom-avatar-url" className="profile-field-label">
            Or Paste Custom Image URL
          </label>
          <div className="input-with-icon-wrap">
            <span className="input-icon-badge">
              <CameraIcon size={15} />
            </span>
            <input
              id="custom-avatar-url"
              className="input input-with-icon"
              value={modalPhotoURL}
              onChange={(e) => setModalPhotoURL(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
            />
          </div>
        </div>

        <div className="modal-actions avatar-modal-actions">
          <button
            type="button"
            className="pill btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pill btn-primary"
            onClick={onSave}
            disabled={isSubmitting}
          >
            <CheckIcon size={16} />
            <span>{isSubmitting ? 'Saving...' : 'Set Avatar'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AvatarPickerModal;
