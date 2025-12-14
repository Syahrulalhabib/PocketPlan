import LineChart from '../components/LineChart.jsx';
import { useData } from '../providers/DataProvider.jsx';

const formatRupiah = (value) =>
  `Rp ${value.toLocaleString('id-ID')}`;

const DashboardPage = () => {
  const { summary, transactions, goals } = useData();

  const progressPercent = (goal) => (goal ? Math.min(100, Math.round((goal.amount / goal.target) * 100)) : 0);

  return (
    <div className="dashboard">
      <div className="hero-title">
        <h1 className="section-title">Dashboard</h1>
        <p className="subtitle">Ringkasan Pemasukkan, Pengeluaran dan progress goals anda.</p>
      </div>

      <div className="balance-card card">
        <div className="label">⟳ Current Balance</div>
        <div className="value">{formatRupiah(summary.balance)}</div>
      </div>

      <div className="grid-2">
        <div className="card stat-card">
          <div className="label">⬆ Income</div>
          <div className="value">{formatRupiah(summary.income)}</div>
          <div className="muted">+ {formatRupiah(summary.monthIncome)} this month</div>
        </div>
        <div className="card stat-card">
          <div className="label">⬇ Expense</div>
          <div className="value">{formatRupiah(summary.expense)}</div>
          <div className="muted">- {formatRupiah(summary.monthExpense)} this month</div>
        </div>
      </div>

      <div className="grid-2 chart-block">
        <div className="card chart-card">
          <LineChart transactions={transactions} />
        </div>
        <div className="card goals-card">
          <div className="label">Saving Goals</div>
          {goals.length ? (
            goals.map((goal) => (
              <div className="goal-item" key={goal.id || goal.name}>
                <div className="goal-header">
                  <span className="goal-name">{goal.name}</span>
                  <span className="goal-amount">
                    {goal.amount.toLocaleString('id-ID')}/{goal.target.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="progress-shell">
                  <div className="fill" style={{ width: `${progressPercent(goal)}%` }} />
                </div>
              </div>
            ))
          ) : (
            <p className="muted">No goals yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
