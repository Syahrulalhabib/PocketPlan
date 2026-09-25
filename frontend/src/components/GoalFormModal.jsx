import Modal from './Modal.jsx';
import { formatDisplayNumber, parseFormattedNumber, adjustMoney } from '../utils/formatters.js';

const QUICK_GOAL_AMOUNTS = [100000, 500000, 1000000, 5000000];

const GoalFormModal = ({ open, onClose, onSubmit, form, setForm, isEdit = false }) => {
  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Goal' : 'Add Goal'}>
      <form className="modal-form" onSubmit={onSubmit}>
        <label>Goal Name</label>
        <input
          className="input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. New Laptop, Vacation"
          required
        />

        <label>Type</label>
        <div className="pill-switch pill-switch-animated plain-switch" key={form.type}>
          <button
            type="button"
            className="pill small active"
            onClick={() => setForm({ ...form, type: 'Saving' })}
          >
            Saving
          </button>
        </div>

        <label>Your Target</label>
        <div className="number-input">
          <span className="currency-prefix">Rp</span>
          <input
            className="input number-field has-prefix"
            type="text"
            inputMode="numeric"
            value={formatDisplayNumber(form.target)}
            onChange={(e) => setForm({ ...form, target: parseFormattedNumber(e.target.value) })}
            required
          />
          <div className="number-controls">
            <button
              type="button"
              onClick={() => setForm({ ...form, target: adjustMoney(form.target, 10000) })}
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, target: adjustMoney(form.target, -10000) })}
            >
              ▼
            </button>
          </div>
        </div>

        <div className="quick-amounts">
          {QUICK_GOAL_AMOUNTS.map((step) => (
            <button
              key={step}
              type="button"
              className="chip-btn"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  target: (Number(prev.target) || 0) + step
                }))
              }
            >
              +{step >= 1000000 ? `${step / 1000000}M` : `${step / 1000}k`}
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="pill btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="pill btn-primary">
            {isEdit ? 'Update' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default GoalFormModal;
