import Modal from './Modal.jsx';
import { formatDisplayNumber, parseFormattedNumber, adjustMoney } from '../utils/formatters.js';

const QUICK_AMOUNTS = [50000, 100000, 500000, 1000000];

const TransactionFormModal = ({ open, onClose, onSubmit, form, setForm, isEdit = false, goals = [] }) => {
  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Transaction' : 'Add Transaction'}>
      <form className="modal-form" onSubmit={onSubmit}>
        {!isEdit && form.type === 'Expense' && goals?.length > 0 && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '12px', background: 'var(--card-bg-subtle, rgba(120,120,120,0.06))', border: '1px dashed var(--border-color, #cbd5e1)' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              🎯 Hubungkan dengan Goal (Opsional)
            </label>
            <select
              className="input"
              value={form.completedGoalId || ''}
              onChange={(e) => {
                const gId = e.target.value;
                const targetGoal = goals.find((g) => g.id === gId);
                if (targetGoal) {
                  setForm((prev) => ({
                    ...prev,
                    completedGoalId: targetGoal.id,
                    category: 'Shopping',
                    amount: targetGoal.target,
                    description: `Pembelian Goal: ${targetGoal.name}`
                  }));
                } else {
                  setForm((prev) => ({
                    ...prev,
                    completedGoalId: ''
                  }));
                }
              }}
            >
              <option value="">-- Bukan Pembelian Goal --</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  🎯 {g.name} (Rp {formatDisplayNumber(g.target)})
                </option>
              ))}
            </select>
            {form.completedGoalId && (
              <small style={{ display: 'block', marginTop: '0.35rem', color: '#10b981', fontSize: '0.78rem' }}>
                ✓ Goal ini otomatis diselesaikan dan dihapus saat transaksi disimpan.
              </small>
            )}
          </div>
        )}

        <label>Category</label>
        <input
          className="input"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          required
        />

        <label>Type</label>
        <div className="pill-switch pill-switch-animated plain-switch" key={form.type}>
          {['Income', 'Expense'].map((type) => (
            <button
              key={type}
              type="button"
              className={`pill small ${form.type === type ? 'active' : ''}`}
              onClick={() => setForm({ ...form, type, amount: '' })}
            >
              {type}
            </button>
          ))}
        </div>

        <label>Amount</label>
        <div className="number-input">
          <span className="currency-prefix">Rp</span>
          <input
            className="input number-field has-prefix"
            type="text"
            inputMode="numeric"
            value={formatDisplayNumber(form.amount)}
            onChange={(e) => setForm({ ...form, amount: parseFormattedNumber(e.target.value) })}
            required
          />
          <div className="number-controls">
            <button
              type="button"
              onClick={() => setForm({ ...form, amount: adjustMoney(form.amount, 10000) })}
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, amount: adjustMoney(form.amount, -10000) })}
            >
              ▼
            </button>
          </div>
        </div>

        <div className="quick-amounts">
          {QUICK_AMOUNTS.map((step) => (
            <button
              key={step}
              type="button"
              className="chip-btn"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  amount: (Number(prev.amount) || 0) + step
                }))
              }
            >
              +{step >= 1000000 ? `${step / 1000000}M` : `${step / 1000}k`}
            </button>
          ))}
        </div>

        <label>Date</label>
        <input
          className="input"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          required
        />

        <label>Description</label>
        <input
          className="input"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Optional"
        />

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

export default TransactionFormModal;
