import { useMemo, useState } from 'react';
import { useData } from '../providers/DataProvider.jsx';
import Modal from '../components/Modal.jsx';

const formatRupiah = (value) => `Rp. ${Number(value).toLocaleString('id-ID')}`;

const today = new Date().toISOString().slice(0, 10);
const emptyForm = {
  category: '',
  type: 'Expense',
  amount: '',
  date: today,
  description: ''
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

const TransactionsPage = () => {
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useData();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest');
  const [showModal, setShowModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = transactions.filter((t) => {
      const matchesSearch =
        t.category.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q);
      const matchesType = typeFilter === 'All' || t.type === typeFilter;
      return matchesSearch && matchesType;
    });
    return [...list].sort((a, b) => {
      const aDate = new Date(a.date || a.createdAt || 0).getTime();
      const bDate = new Date(b.date || b.createdAt || 0).getTime();
      return sortOrder === 'newest' ? bDate - aDate : aDate - bDate;
    });
  }, [transactions, search, typeFilter, sortOrder]);

  const submitForm = async (e) => {
    e.preventDefault();
    await addTransaction(form);
    setForm(emptyForm);
    setShowModal(false);
  };

  const openModal = () => {
    setForm(emptyForm);
    setShowModal(true);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    await updateTransaction(selected.id, form);
    setEditModal(false);
    setSelected(null);
  };

  return (
    <div className="page">
      <h1 className="section-title">Transactions</h1>
      <div className="subtitle">Manage your transactions</div>

      <div className="toolbar">
        <button className="pill btn-secondary shadowed" onClick={openModal}>
          ➕ Add Transactions
        </button>
        <div className="filter-group">
          <span className="filter-label">Filter:</span>
          <div className="pill-switch">
            {['All', 'Income', 'Expense'].map((type) => (
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

      <div className="card table-card">
        <div className="table-scroll">
          <table className="table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Time</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="filter-animated" key={`${typeFilter}-${sortOrder}`}>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td>{t.category}</td>
                <td>
                  <span className={`badge ${t.type === 'Income' ? 'income' : 'expense'}`}>{t.type}</span>
                </td>
                <td>{formatRupiah(t.amount)}</td>
                <td>{t.date ? new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
                <td>{t.description}</td>
                <td className="actions">
                  <button
                    className="mini-link"
                    onClick={() => {
                      setSelected(t);
                      setViewModal(true);
                    }}
                  >
                    👁 View
                  </button>
                  <button
                    className="mini-link"
                    onClick={() => {
                      setSelected(t);
                      setForm({
                        category: t.category,
                        type: t.type,
                        amount: t.amount,
                        date: t.date || today,
                        description: t.description || ''
                      });
                      setEditModal(true);
                    }}
                  >
                    ✏ Edit
                  </button>
                  <button className="mini-link" onClick={() => deleteTransaction(t.id)}>
                    🗑 Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '16px', color: '#6b7280' }}>
                  No transactions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Transaction">
        <form className="modal-form" onSubmit={submitForm}>
          <label>Category</label>
          <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
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
              <button type="button" onClick={() => setForm({ ...form, amount: adjustMoney(form.amount, 10000) })}>
                ▲
              </button>
              <button type="button" onClick={() => setForm({ ...form, amount: adjustMoney(form.amount, -10000) })}>
                ▼
              </button>
            </div>
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
            <button type="button" className="pill btn-secondary" onClick={() => { setShowModal(false); setForm(emptyForm); }}>
              Cancel
            </button>
            <button type="submit" className="pill btn-primary">
              Save
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={viewModal} onClose={() => setViewModal(false)} title="Transaction Detail">
        {selected && (
          <div className="modal-form">
            <div><strong>Category:</strong> {selected.category}</div>
            <div><strong>Type:</strong> {selected.type}</div>
            <div><strong>Amount:</strong> {formatRupiah(selected.amount)}</div>
            <div><strong>Date:</strong> {selected.date}</div>
            <div><strong>Description:</strong> {selected.description || '-'}</div>
          </div>
        )}
      </Modal>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Transaction">
        <form className="modal-form" onSubmit={submitEdit}>
          <label>Category</label>
          <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
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
              <button type="button" onClick={() => setForm({ ...form, amount: adjustMoney(form.amount, 10000) })}>
                ▲
              </button>
              <button type="button" onClick={() => setForm({ ...form, amount: adjustMoney(form.amount, -10000) })}>
                ▼
              </button>
            </div>
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

export default TransactionsPage;
