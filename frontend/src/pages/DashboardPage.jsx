import { useState } from 'react';
import LineChart from '../components/LineChart.jsx';
import { useData } from '../providers/DataProvider.jsx';

const formatRupiah = (value) =>
  `Rp ${value.toLocaleString('id-ID')}`;

const DashboardPage = () => {
  const { summary, transactions, goals } = useData();
  const [chartPeriod, setChartPeriod] = useState('daily');

  const progressPercent = (goal) => {
    if (!goal) return 0;
    const targetValue = Number(goal.target) || 0;
    if (!targetValue) return 0;
    const balanceValue = Number(summary.balance) || 0;
    return Math.max(0, Math.min(100, Math.round((balanceValue / targetValue) * 100)));
  };

  return (
    <div className="dashboard">
      <div className="hero-title">
        <h1 className="section-title">Dashboard</h1>
        <p className="subtitle">Summary of your income, expenses, and goal progress.</p>
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
          <div className="filter-group" style={{ marginBottom: '12px' }}>
            <span className="filter-label">Filter:</span>
            <div className="pill-switch">
              {['daily', 'weekly', 'monthly'].map((period) => (
                <button
                  key={period}
                  type="button"
                  className={`pill small ${chartPeriod === period ? 'active' : ''}`}
                  onClick={() => setChartPeriod(period)}
                >
                  {period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>
          <LineChart transactions={transactions} period={chartPeriod} />
        </div>
        <div className="card goals-card">
          <div className="label">Saving Goals</div>
          {goals.length ? (
            goals.map((goal) => (
              <div className="goal-item" key={goal.id || goal.name}>
                <div className="goal-header">
                  <span className="goal-name">{goal.name}</span>
                  <span className="goal-amount">
                    {summary.balance.toLocaleString('id-ID')}/{goal.target.toLocaleString('id-ID')}
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
