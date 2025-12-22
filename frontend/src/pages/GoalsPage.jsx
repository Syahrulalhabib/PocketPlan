import { useMemo, useState } from 'react';
import { useData } from '../providers/DataProvider.jsx';
import Modal from '../components/Modal.jsx';

const formatRupiah = (value) => `Rp. ${Number(value).toLocaleString('id-ID')}`;

const emptyForm = {
  name: '',
  type: 'Saving',
  target: ''
};

const parseFormattedNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits === '' ? '' : Number(digits);
};

const formatDisplayNumber = (value) =>
  value === '' || value === null || value === undefined ? '' : Number(value).toLocaleString('id-ID');

const adjustMoney = (current, delta) => {
  const next = Math.max(0, (Number(current) || 0) + delta);
  return next;
};

const GoalsPage = () => {
  const { goals, addGoal, updateGoal, deleteGoal } = useData();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = goals.filter((g) => {
      const matchesSearch = g.name.toLowerCase().includes(q) || g.type.toLowerCase().includes(q);
      return matchesSearch;
    });
    return list;
  }, [goals, search]);

  const submitForm = async (e) => {
    e.preventDefault();
    await addGoal({ ...form, type: 'Saving' });
    setForm(emptyForm);
    setShowModal(false);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    await updateGoal(selected.id, { ...form, type: 'Saving' });
    setEditModal(false);
    setSelected(null);
  };

  return (
    <div className="page">
      <h1 className="section-title">Goals</h1>
      <div className="subtitle">Kelola target tabungan anda</div>

      <div className="toolbar">
        <button className="pill btn-secondary shadowed" onClick={() => setShowModal(true)}>
          ➕ Add Goals
        </button>
        <div className="search-box card">
          <span>🔍</span>
          <input
            className="pill-input"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span>⚙</span>
        </div>
      </div>

      <div className="card table-card goals-table-card">
        <div className="table-scroll">
          <table className="table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Type</th>
              <th>Your Target</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="filter-animated">
            {filtered.map((g) => (
              <tr key={g.id}>
                <td>{g.name}</td>
                <td>
                  <span className={`badge ${g.type === 'Saving' ? 'income' : 'expense'}`}>{g.type}</span>
                </td>
                <td>{formatRupiah(g.target)}</td>
                <td className="actions">
                  <button
                    className="mini-link"
                    onClick={() => {
                      setSelected(g);
                      setViewModal(true);
                    }}
                  >
                    👁 View
                  </button>
                  <button
                    className="mini-link"
                    onClick={() => {
                      setSelected(g);
                      setForm({
                        name: g.name,
                        type: g.type,
                        target: g.target
                      });
                      setEditModal(true);
                    }}
                  >
                    ✏ Edit
                  </button>
                  <button className="mini-link" onClick={() => deleteGoal(g.id)}>
                    🗑 Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '16px', color: '#6b7280' }}>
                  No goals found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Goal">
        <form className="modal-form" onSubmit={submitForm}>
          <label>Category</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <label>Type</label>
          <div className="pill-switch pill-switch-animated plain-switch" key={form.type}>
            <button type="button" className="pill small active" onClick={() => setForm({ ...form, type: 'Saving' })}>
              Saving
            </button>
          </div>
          <label>Your Target</label>
          <div className="number-input">
            <input
              className="input number-field"
              type="text"
              inputMode="numeric"
              value={formatDisplayNumber(form.target)}
              onChange={(e) => setForm({ ...form, target: parseFormattedNumber(e.target.value) })}
              required
            />
            <div className="number-controls">
              <button type="button" onClick={() => setForm({ ...form, target: adjustMoney(form.target, 10000) })}>
                ▲
              </button>
              <button type="button" onClick={() => setForm({ ...form, target: adjustMoney(form.target, -10000) })}>
                ▼
              </button>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="pill btn-secondary" onClick={() => { setShowModal(false); setForm(emptyForm); }}>
              Cancel
            </button>
            <button type="submit" className="pill btn-primary">
              Save
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={viewModal} onClose={() => setViewModal(false)} title="Goal Detail">
        {selected && (
          <div className="modal-form">
            <div><strong>Category:</strong> {selected.name}</div>
            <div><strong>Type:</strong> {selected.type}</div>
            <div><strong>Target:</strong> {formatRupiah(selected.target)}</div>
          </div>
        )}
      </Modal>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Goal">
        <form className="modal-form" onSubmit={submitEdit}>
          <label>Category</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <label>Type</label>
          <div className="pill-switch pill-switch-animated plain-switch" key={form.type}>
            <button type="button" className="pill small active" onClick={() => setForm({ ...form, type: 'Saving' })}>
              Saving
            </button>
          </div>
          <label>Your Target</label>
          <div className="number-input">
            <input
              className="input number-field"
              type="text"
              inputMode="numeric"
              value={formatDisplayNumber(form.target)}
              onChange={(e) => setForm({ ...form, target: parseFormattedNumber(e.target.value) })}
              required
            />
            <div className="number-controls">
              <button type="button" onClick={() => setForm({ ...form, target: adjustMoney(form.target, 10000) })}>
                ▲
              </button>
              <button type="button" onClick={() => setForm({ ...form, target: adjustMoney(form.target, -10000) })}>
                ▼
              </button>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="pill btn-secondary" onClick={() => { setEditModal(false); setSelected(null); }}>
              Cancel
            </button>
            <button type="submit" className="pill btn-primary">
              Update
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default GoalsPage;
