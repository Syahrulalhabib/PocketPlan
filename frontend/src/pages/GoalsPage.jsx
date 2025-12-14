import { useMemo, useState } from 'react';
import { useData } from '../providers/DataProvider.jsx';
import Modal from '../components/Modal.jsx';

const formatRupiah = (value) => `Rp. ${Number(value).toLocaleString('id-ID')}`;

const emptyForm = {
  name: '',
  type: 'Saving',
  amount: '',
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
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest');
  const [showModal, setShowModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = goals.filter((g) => {
      const matchesSearch = g.name.toLowerCase().includes(q) || g.type.toLowerCase().includes(q);
      const matchesType = typeFilter === 'All' || g.type === typeFilter;
      return matchesSearch && matchesType;
    });
    return [...list].sort((a, b) => {
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      return sortOrder === 'newest' ? bDate - aDate : aDate - bDate;
    });
  }, [goals, search, typeFilter, sortOrder]);

  const submitForm = async (e) => {
    e.preventDefault();
    await addGoal(form);
    setForm(emptyForm);
    setShowModal(false);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    await updateGoal(selected.id, form);
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
        <div className="filter-group">
          <span className="filter-label">Filter:</span>
          <div className="pill-switch">
            {['All', 'Saving', 'Expense'].map((type) => (
              <button
                key={type}
                type="button"
                className={`pill small ${typeFilter === type ? 'active' : ''}`}
                onClick={() => setTypeFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <span className="filter-label">Sort:</span>
          <div className="pill-switch">
            {['newest', 'oldest'].map((order) => (
              <button
                key={order}
                type="button"
                className={`pill small ${sortOrder === order ? 'active' : ''}`}
                onClick={() => setSortOrder(order)}
              >
                {order === 'newest' ? 'Newest' : 'Oldest'}
              </button>
            ))}
          </div>
        </div>
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
              <th />
              <th>Category</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Your Target</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="filter-animated" key={`${typeFilter}-${sortOrder}`}>
            {filtered.map((g) => (
              <tr key={g.id}>
                <td>
                  <input type="checkbox" />
                </td>
                <td>{g.name}</td>
                <td>
                  <span className={`badge ${g.type === 'Saving' ? 'income' : 'expense'}`}>{g.type}</span>
                </td>
                <td>{formatRupiah(g.amount)}</td>
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
                        amount: g.amount,
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
                <td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: '#6b7280' }}>
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
            {['Saving', 'Expense'].map((type) => (
              <button
                key={type}
                type="button"
                className={`pill small ${form.type === type ? 'active' : ''}`}
                onClick={() => setForm({ ...form, type, amount: '', target: '' })}
              >
                {type}
              </button>
            ))}
          </div>
          <label>Amount</label>
          <div className="number-input">
            <input
              className="input number-field"
              type="text"
              inputMode="numeric"
              value={formatDisplayNumber(form.amount)}
              onChange={(e) => setForm({ ...form, amount: parseFormattedNumber(e.target.value) })}
              required
            />
            <div className="number-controls">
              <button type="button" onClick={() => setForm({ ...form, amount: adjustMoney(form.amount, 10000) })}>
                ▲
              </button>
              <button type="button" onClick={() => setForm({ ...form, amount: adjustMoney(form.amount, -10000) })}>
                ▼
              </button>
            </div>
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
            <div><strong>Amount:</strong> {formatRupiah(selected.amount)}</div>
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
            {['Saving', 'Expense'].map((type) => (
              <button
                key={type}
                type="button"
                className={`pill small ${form.type === type ? 'active' : ''}`}
                onClick={() => setForm({ ...form, type })}
              >
                {type}
              </button>
            ))}
          </div>
          <label>Amount</label>
          <div className="number-input">
            <input
              className="input number-field"
              type="text"
              inputMode="numeric"
              value={formatDisplayNumber(form.amount)}
              onChange={(e) => setForm({ ...form, amount: parseFormattedNumber(e.target.value) })}
              required
            />
            <div className="number-controls">
              <button type="button" onClick={() => setForm({ ...form, amount: adjustMoney(form.amount, 10000) })}>
                ▲
              </button>
              <button type="button" onClick={() => setForm({ ...form, amount: adjustMoney(form.amount, -10000) })}>
                ▼
              </button>
            </div>
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
