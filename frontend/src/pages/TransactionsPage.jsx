import { useMemo, useState } from 'react';
import { useData } from '../providers/DataProvider.jsx';
import {
  formatRupiah,
  formatDisplayNumber,
  parseFormattedNumber,
  adjustMoney,
  capitalizeWords
} from '../utils/formatters.js';
import Modal from '../components/Modal.jsx';
import TransactionFormModal from '../components/TransactionFormModal.jsx';
import { PlusIcon, SearchIcon, ViewIcon, EditIcon, TrashIcon, ReceiptIcon, CloseIcon, ScanIcon } from '../components/Icons.jsx';
import LuckyCoinMascot from '../components/LuckyCoinMascot.jsx';
import ReceiptScannerModal from '../components/ReceiptScannerModal.jsx';

const today = new Date().toISOString().slice(0, 10);
const emptyForm = {
  category: '',
  type: 'Expense',
  amount: '',
  date: today,
  description: ''
};

const TransactionsPage = () => {
  const { transactions, addTransaction, updateTransaction, deleteTransaction, goals, deleteGoal } = useData();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest');
  const [showModal, setShowModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState(null);
  const [scanModal, setScanModal] = useState(false);

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
    await addTransaction({
      ...form,
      category: capitalizeWords(form.category),
      description: capitalizeWords(form.description)
    });
    if (form.completedGoalId) {
      await deleteGoal(form.completedGoalId);
    }
    setForm(emptyForm);
    setShowModal(false);
  };

  const openModal = () => {
    setForm(emptyForm);
    setShowModal(true);
  };

  const handleScanResult = (result) => {
    setForm({
      category: result.category || '',
      type: result.type || 'Expense',
      amount: result.amount || '',
      date: result.date || new Date().toISOString().slice(0, 10),
      description: result.description || ''
    });
    setShowModal(true);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    await updateTransaction(selected.id, {
      ...form,
      category: capitalizeWords(form.category),
      description: capitalizeWords(form.description)
    });
    setEditModal(false);
    setSelected(null);
  };

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1 className="section-title">Transactions</h1>
          <div className="subtitle">Manage your transactions</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="pill btn-secondary btn-add shadowed" onClick={() => setScanModal(true)}
            title="Scan struk">
            <ScanIcon size={16} />
            <span>Scan Struk</span>
          </button>
          <button type="button" className="pill btn-primary btn-add shadowed" onClick={openModal}>
            <PlusIcon size={16} />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      <div className="toolbar transactions-toolbar">
        <div className="search-box card">
          <SearchIcon size={16} className="search-icon" />
          <input
            className="pill-input"
            type="text"
            placeholder="Search category, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search transactions"
          />
          {search && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearch('')}
              aria-label="Clear search input"
            >
              <CloseIcon size={13} />
            </button>
          )}
        </div>

        <div className="toolbar-filters">
          <div className="filter-group">
            <span className="filter-label">Filter:</span>
            <div className="pill-switch" role="tablist">
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
                <th>Date</th>
                <th>Description</th>
                <th className="actions-header">Actions</th>
              </tr>
            </thead>
            <tbody className="filter-animated" key={`${typeFilter}-${sortOrder}`}>
              {filtered.map((t) => (
                <tr key={t.id} className="table-card-row">
                  <td className="cell-category" data-label="Category">
                    <span className="table-cell-bold">{capitalizeWords(t.category)}</span>
                  </td>
                  <td className="cell-type" data-label="Type">
                    <span className={`badge ${t.type === 'Income' ? 'income' : 'expense'}`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="cell-amount" data-label="Amount">
                    <span className={t.type === 'Income' ? 'income-text' : 'expense-text'}>
                      {t.type === 'Income' ? '+ ' : '- '}{formatRupiah(t.amount)}
                    </span>
                  </td>
                  <td className="cell-date muted-cell" data-label="Date">
                    <span>{t.date ? new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span>
                  </td>
                  <td className="cell-desc desc-cell" data-label="Description">
                    <span>{t.description ? capitalizeWords(t.description) : '-'}</span>
                  </td>
                  <td className="cell-actions actions">
                    <button
                      type="button"
                      className="table-action-btn view"
                      title="View details"
                      aria-label="View transaction"
                      onClick={() => {
                        setSelected(t);
                        setViewModal(true);
                      }}
                    >
                      <ViewIcon size={15} />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      className="table-action-btn edit"
                      title="Edit transaction"
                      aria-label="Edit transaction"
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
                      <EditIcon size={15} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="table-action-btn delete"
                      title="Delete transaction"
                      aria-label="Delete transaction"
                      onClick={() => setDeleteTarget(t)}
                    >
                      <TrashIcon size={15} />
                      <span>Delete</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr className="empty-row">
                  <td colSpan="6" className="empty-table-cell">
                    <LuckyCoinMascot
                      mode="empty"
                      message={search ? 'No transactions match your search.' : 'No transactions recorded yet!'}
                    />
                    {!search && (
                      <button
                        type="button"
                        className="pill small btn-primary empty-action-btn"
                        onClick={openModal}
                      >
                        + Add Transaction
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TransactionFormModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setForm(emptyForm);
        }}
        onSubmit={submitForm}
        form={form}
        setForm={setForm}
        goals={goals}
      />

      <Modal open={viewModal} onClose={() => setViewModal(false)} title="Transaction Detail">
        {selected && (
          <div className="detail-modal-body">
            <div className="detail-hero">
              <span className={`detail-hero-badge ${selected.type === 'Income' ? 'income' : 'expense'}`}>
                {selected.type}
              </span>
              <div className={`detail-hero-amount ${selected.type === 'Income' ? 'income-text' : 'expense-text'}`}>
                {selected.type === 'Income' ? '+ ' : '- '}{formatRupiah(selected.amount)}
              </div>
            </div>
            <div className="detail-list">
              <div className="detail-item">
                <span className="detail-item-label">Category</span>
                <span className="detail-item-value">{capitalizeWords(selected.category)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">Date</span>
                <span className="detail-item-value">{selected.date}</span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">Description</span>
                <span className="detail-item-value">{selected.description ? capitalizeWords(selected.description) : '—'}</span>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="pill btn-secondary" onClick={() => setViewModal(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <TransactionFormModal
        open={editModal}
        onClose={() => {
          setEditModal(false);
          setSelected(null);
        }}
        onSubmit={submitEdit}
        form={form}
        setForm={setForm}
        isEdit
      />

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Confirm Delete">
        {deleteTarget && (
          <div className="modal-form">
            <p className="delete-confirm-text">
              Are you sure you want to delete this transaction?
            </p>
            <div className="delete-preview-card">
              <div className="delete-preview-header">
                <span className="table-cell-bold">{deleteTarget.category}</span>
                <span className={`badge ${deleteTarget.type === 'Income' ? 'income' : 'expense'}`}>
                  {deleteTarget.type}
                </span>
              </div>
              <div className={`delete-preview-amount ${deleteTarget.type === 'Income' ? 'income-text' : 'expense-text'}`}>
                {deleteTarget.type === 'Income' ? '+ ' : '- '}{formatRupiah(deleteTarget.amount)}
              </div>
              {deleteTarget.description && (
                <div className="delete-preview-sub">
                  {deleteTarget.description}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="pill btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="pill btn-danger"
                onClick={async () => {
                  await deleteTransaction(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
      <ReceiptScannerModal
        open={scanModal}
        onClose={() => setScanModal(false)}
        onResult={handleScanResult}
      />
    </div>
  );
};

export default TransactionsPage;
