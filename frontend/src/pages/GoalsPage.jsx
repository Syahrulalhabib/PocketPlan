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
import GoalFormModal from '../components/GoalFormModal.jsx';
import { PlusIcon, SearchIcon, ViewIcon, EditIcon, TrashIcon, TargetIcon, CloseIcon, ProgressCoinIcon, SmilingCoinIcon } from '../components/Icons.jsx';
import LuckyCoinMascot from '../components/LuckyCoinMascot.jsx';

const emptyForm = {
  name: '',
  type: 'Saving',
  target: ''
};

const GoalsPage = () => {
  const { goals, addGoal, updateGoal, deleteGoal, addTransaction, summary } = useData();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [buyTarget, setBuyTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState(null);

  const confirmBuyGoal = async () => {
    if (!buyTarget) return;
    const amt = Number(buyTarget.target) || 0;
    if ((summary?.balance ?? 0) < amt) {
      setBuyTarget(null);
      return;
    }
    await addTransaction({
      category: 'Shopping',
      type: 'Expense',
      amount: Number(buyTarget.target),
      date: new Date().toISOString().split('T')[0],
      description: `Pembelian Goal: ${buyTarget.name}`,
      goalBackup: {
        name: buyTarget.name,
        target: buyTarget.target,
        amount: buyTarget.amount || 0,
        type: buyTarget.type || 'Saving',
        createdAt: buyTarget.createdAt || new Date().toISOString()
      }
    });
    await deleteGoal(buyTarget.id);
    setBuyTarget(null);
    setViewModal(false);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = goals.filter((g) => {
      const matchesSearch = (g.name || '').toLowerCase().includes(q) || (g.type || '').toLowerCase().includes(q);
      return matchesSearch;
    });
    return list;
  }, [goals, search]);

  const submitForm = async (e) => {
    e.preventDefault();
    await addGoal({ ...form, name: capitalizeWords(form.name), type: 'Saving' });
    setForm(emptyForm);
    setShowModal(false);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    await updateGoal(selected.id, { ...form, name: capitalizeWords(form.name), type: 'Saving' });
    setEditModal(false);
    setSelected(null);
  };

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1 className="section-title">Goals</h1>
          <div className="subtitle">Manage your savings goals</div>
        </div>
        <button type="button" className="pill btn-primary btn-add shadowed" onClick={() => setShowModal(true)}>
          <PlusIcon size={16} />
          <span>Add Goal</span>
        </button>
      </div>

      <LuckyCoinMascot
        mode="banner"
        goals={goals}
        balance={summary?.balance}
      />

      <div className="toolbar goals-toolbar">
        <div className="search-box card">
          <SearchIcon size={16} className="search-icon" />
          <input
            className="pill-input"
            type="text"
            placeholder="Search savings goals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search goals"
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
      </div>

      <div className="card table-card goals-table-card">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Type</th>
                <th>Target Amount</th>
                <th className="actions-header">Actions</th>
              </tr>
            </thead>
            <tbody className="filter-animated">
              {filtered.map((g) => (
                <tr key={g.id} className="table-card-row">
                  <td className="cell-category" data-label="Category">
                    <span className="table-cell-bold">{capitalizeWords(g.name)}</span>
                  </td>
                  <td className="cell-type" data-label="Type">
                    <span className={`badge ${g.type === 'Saving' ? 'income' : 'expense'}`}>
                      {g.type}
                    </span>
                  </td>
                  <td className="cell-amount" data-label="Target Amount">
                    <div className="goal-table-target-wrap">
                      <span className="goal-target-val">{formatRupiah(g.target)}</span>
                      {(() => {
                        const bal = Number(summary?.balance) || 0;
                        const tgt = Number(g.target) || 1;
                        const p = Math.max(0, Math.min(100, Math.round((bal / tgt) * 100)));
                        return (
                          <span className={`goal-table-pct ${p >= 100 ? 'done' : ''}`}>
                            {p >= 100 ? '100% 🎯' : `${p}%`}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="cell-actions actions">
                    {(() => {
                      const bal = Number(summary?.balance) || 0;
                      const tgt = Number(g.target) || 1;
                      if (bal >= tgt) {
                        return (
                          <button
                            type="button"
                            className="table-action-btn buy"
                            title="Beli & Realisasikan Goal Ini"
                            onClick={() => setBuyTarget(g)}
                            style={{ color: '#10b981', fontWeight: 600 }}
                          >
                            <span>🛍️ Beli</span>
                          </button>
                        );
                      }
                      return null;
                    })()}
                    <button
                      type="button"
                      className="table-action-btn view"
                      title="View goal details"
                      aria-label="View goal"
                      onClick={() => {
                        setSelected(g);
                        setViewModal(true);
                      }}
                    >
                      <ViewIcon size={15} />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      className="table-action-btn edit"
                      title="Edit goal"
                      aria-label="Edit goal"
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
                      <EditIcon size={15} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="table-action-btn delete"
                      title="Delete goal"
                      aria-label="Delete goal"
                      onClick={() => setDeleteTarget(g)}
                    >
                      <TrashIcon size={15} />
                      <span>Delete</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr className="empty-row">
                  <td colSpan="4" className="empty-table-cell">
                    <LuckyCoinMascot
                      mode="empty"
                      message={search ? 'No savings goals match your search keywords.' : 'No savings goals added yet!'}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <GoalFormModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setForm(emptyForm);
        }}
        onSubmit={submitForm}
        form={form}
        setForm={setForm}
      />

      <Modal open={viewModal} onClose={() => setViewModal(false)} title="Goal Detail">
        {selected && (() => {
          const balance = Number(summary?.balance) || 0;
          const target = Number(selected.target) || 1;
          const pct = Math.max(0, Math.min(100, Math.round((balance / target) * 100)));
          const isAchieved = pct >= 100;
          return (
            <div className="detail-modal-body">
              <div className="detail-hero">
                <span className="detail-hero-badge income">{selected.type || 'Saving'}</span>
                <div className="detail-hero-amount income-text">
                  {formatRupiah(selected.target)}
                </div>
                <div className="detail-hero-sub">Target Amount</div>
              </div>
              <div className="detail-progress-card">
                <div className="detail-progress-header">
                  <span>Current Balance: <strong>{formatRupiah(balance)}</strong></span>
                  <span className={`detail-progress-pct ${isAchieved ? 'achieved' : ''}`}>
                    {isAchieved ? '🎉 100% Reached!' : `${pct}%`}
                  </span>
                </div>
                <div className="progress-shell" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`fill ${isAchieved ? 'completed' : ''}`} style={{ width: `${pct}%` }} />
                  <div
                    className={`progress-coin-marker ${isAchieved ? 'is-achieved' : ''}`}
                    style={{ left: `clamp(11px, ${pct}%, calc(100% - 11px))` }}
                    aria-hidden="true"
                  >
                    {isAchieved ? <SmilingCoinIcon size={24} /> : <ProgressCoinIcon size={22} />}
                  </div>
                </div>
              </div>
              <div className="detail-list">
                <div className="detail-item">
                  <span className="detail-item-label">Goal Name</span>
                  <span className="detail-item-value">{capitalizeWords(selected.name)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-item-label">Status</span>
                  <span className="detail-item-value">{isAchieved ? 'Achieved 🎯' : 'In Progress'}</span>
                </div>
              </div>
              <div className="modal-actions">
                {isAchieved && (
                  <button
                    type="button"
                    className="pill btn-primary"
                    onClick={() => {
                      setBuyTarget(selected);
                      setViewModal(false);
                    }}
                  >
                    🛍️ Beli Goal Ini Sekarang
                  </button>
                )}
                <button type="button" className="pill btn-secondary" onClick={() => setViewModal(false)}>
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <GoalFormModal
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
              Are you sure you want to delete this savings goal?
            </p>
            <div className="delete-preview-card">
              <div className="delete-preview-header">
                <span className="table-cell-bold">{deleteTarget.name}</span>
                <span className="badge income">
                  {deleteTarget.type || 'Saving'}
                </span>
              </div>
              <div className="delete-preview-amount income-text">
                Target: {formatRupiah(deleteTarget.target)}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="pill btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="pill btn-danger"
                onClick={async () => {
                  await deleteGoal(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={Boolean(buyTarget)} onClose={() => setBuyTarget(null)} title="Beli & Realisasikan Goal">
        {buyTarget && (
          <div className="modal-form">
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
              Selamat! Saldo tabunganmu sudah mencukupi. Beli target <strong>{buyTarget.name}</strong> sekarang?
            </p>
            <div className="delete-preview-card" style={{ borderColor: '#10b981' }}>
              <div className="delete-preview-header">
                <span className="table-cell-bold">{buyTarget.name}</span>
                <span className="badge income">🎯 Siap Dibeli</span>
              </div>
              <div className="delete-preview-amount income-text">
                Target: {formatRupiah(buyTarget.target)}
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              Sistem akan otomatis mencatat pengeluaran sebesar <strong>{formatRupiah(buyTarget.target)}</strong> dan menyelesaikan target ini (menghapus dari daftar aktif).
            </p>
            <div className="modal-actions">
              <button type="button" className="pill btn-secondary" onClick={() => setBuyTarget(null)}>
                Batal
              </button>
              <button
                type="button"
                className="pill btn-primary"
                onClick={confirmBuyGoal}
              >
                🛍️ Ya, Beli Sekarang
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default GoalsPage;
