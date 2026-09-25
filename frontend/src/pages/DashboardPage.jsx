import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LineChart from '../components/LineChart.jsx';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useData } from '../providers/DataProvider.jsx';
import { formatRupiah, capitalizeWords } from '../utils/formatters.js';
import { WalletIcon, TrendingUpIcon, TrendingDownIcon, TargetIcon, EyeIcon, ProgressCoinIcon, SmilingCoinIcon } from '../components/Icons.jsx';
import SavingsMascot from '../components/SavingsMascot.jsx';
import { IncomeMascot, ExpenseMascot } from '../components/StatCardMascots.jsx';

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { summary, transactions, goals, loading } = useData();
  const [chartPeriod, setChartPeriod] = useState('daily');
  const [showBalance, setShowBalance] = useState(() => {
    const saved = localStorage.getItem('pocketplan_show_balance');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleShowBalance = () => {
    setShowBalance((prev) => {
      const next = !prev;
      localStorage.setItem('pocketplan_show_balance', String(next));
      return next;
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.name?.trim() ? user.name.trim().split(' ')[0] : 'there';

  const progressPercent = (goal) => {
    if (!goal) return 0;
    const targetValue = Number(goal.target) || 0;
    if (!targetValue) return 0;
    const balanceValue = Number(summary.balance) || 0;
    return Math.max(0, Math.min(100, Math.round((balanceValue / targetValue) * 100)));
  };

  if (loading) {
    return (
      <div className="dashboard dashboard-loading" aria-busy="true">
        <div className="hero-title">
          <div className="shimmer-bone" style={{ width: '220px', height: '28px', marginBottom: '8px' }} />
          <div className="shimmer-bone" style={{ width: '320px', height: '16px' }} />
        </div>

        <div className="balance-card card balance-mascot-card card-is-loading">
          <div className="balance-card-left">
            <div className="shimmer-bone" style={{ width: '130px', height: '20px', marginBottom: '14px' }} />
            <div className="shimmer-bone" style={{ width: '200px', height: '36px', marginBottom: '12px' }} />
            <div className="shimmer-bone" style={{ width: '240px', height: '14px' }} />
          </div>
          <div className="shimmer-bone" style={{ width: '74px', height: '74px', borderRadius: '50%' }} />
        </div>

        <div className="grid-2">
          <div className="card stat-card income-card card-is-loading">
            <div className="stat-card-row">
              <div className="stat-card-main">
                <div className="shimmer-bone" style={{ width: '110px', height: '18px', marginBottom: '12px' }} />
                <div className="shimmer-bone" style={{ width: '160px', height: '30px', marginBottom: '10px' }} />
                <div className="shimmer-bone" style={{ width: '130px', height: '14px' }} />
              </div>
              <div className="shimmer-bone" style={{ width: '74px', height: '74px', borderRadius: '50%' }} />
            </div>
          </div>
          <div className="card stat-card expense-card card-is-loading">
            <div className="stat-card-row">
              <div className="stat-card-main">
                <div className="shimmer-bone" style={{ width: '110px', height: '18px', marginBottom: '12px' }} />
                <div className="shimmer-bone" style={{ width: '160px', height: '30px', marginBottom: '10px' }} />
                <div className="shimmer-bone" style={{ width: '130px', height: '14px' }} />
              </div>
              <div className="shimmer-bone" style={{ width: '74px', height: '74px', borderRadius: '50%' }} />
            </div>
          </div>
        </div>

        <div className="grid-2 chart-block">
          <div className="card chart-card card-is-loading">
            <div className="shimmer-bone" style={{ width: '140px', height: '22px', marginBottom: '20px' }} />
            <div className="shimmer-bone" style={{ width: '100%', height: '180px', borderRadius: '12px' }} />
          </div>
          <div className="card goals-card card-is-loading">
            <div className="shimmer-bone" style={{ width: '140px', height: '22px', marginBottom: '20px' }} />
            <div className="shimmer-bone" style={{ width: '100%', height: '48px', marginBottom: '12px', borderRadius: '10px' }} />
            <div className="shimmer-bone" style={{ width: '100%', height: '48px', borderRadius: '10px' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="hero-title">
        <h1 className="section-title">{getGreeting()}, {firstName}! 👋</h1>
        <p className="subtitle">Here's your financial overview and goal progress for today.</p>
      </div>

      <div className="balance-card card balance-mascot-card stat-card-cute">
        <div className="balance-card-left">
          <div className="card-badge-row">
            <span className="card-icon-badge balance">
              <WalletIcon size={20} />
            </span>
            <span className="label">Current Balance</span>
            <span className="card-cute-pill balance-pill">⭐ Main Wallet</span>
            <button
              type="button"
              className={`balance-visibility-btn inline-btn ${showBalance ? 'is-visible' : 'is-hidden'}`}
              onClick={toggleShowBalance}
              title={showBalance ? 'Hide balances (Privacy Mode)' : 'Show balances'}
              aria-label={showBalance ? 'Hide balances' : 'Show balances'}
            >
              <EyeIcon open={showBalance} size={16} />
            </button>
          </div>
          <div className="value">
            {showBalance ? formatRupiah(summary.balance) : 'Rp ••••••••'}
          </div>
          <div className="balance-savings-motto">
            <span className="sparkle-icon">✨</span> Save consistently, achieve your financial dreams!
          </div>
        </div>
        <SavingsMascot mode="balance" />
      </div>

      <div className="grid-2">
        <div className="card stat-card income-card stat-card-cute">
          <div className="stat-card-row">
            <div className="stat-card-main">
              <div className="card-badge-row">
                <span className="card-icon-badge income">
                  <TrendingUpIcon size={20} />
                </span>
                <span className="label">Total Income</span>
                <span className="card-cute-pill income-pill">🌱 Healthy Earnings</span>
              </div>
              <div className="value income-text">
                {showBalance ? formatRupiah(summary.income) : 'Rp ••••••••'}
              </div>
              <div className="muted">
                {showBalance ? `+ ${formatRupiah(summary.monthIncome)} recorded` : '+ Rp •••••• recorded'}
              </div>
            </div>
            <IncomeMascot size={78} />
          </div>
        </div>

        <div className="card stat-card expense-card stat-card-cute">
          <div className="stat-card-row">
            <div className="stat-card-main">
              <div className="card-badge-row">
                <span className="card-icon-badge expense">
                  <TrendingDownIcon size={20} />
                </span>
                <span className="label">Total Expense</span>
                <span className="card-cute-pill expense-pill">🦉 Under Control</span>
              </div>
              <div className="value expense-text">
                {showBalance ? formatRupiah(summary.expense) : 'Rp ••••••••'}
              </div>
              <div className="muted">
                {showBalance ? `- ${formatRupiah(summary.monthExpense)} recorded` : '- Rp •••••• recorded'}
              </div>
            </div>
            <ExpenseMascot size={78} />
          </div>
        </div>
      </div>

      <div className="grid-2 chart-block">
        <div className="card chart-card stat-card-cute">
          <div className="chart-header-row">
            <div className="card-badge-row chart-title-badge">
              <span className="card-icon-badge chart-icon-badge">
                <TrendingUpIcon size={18} />
              </span>
              <span className="label">Cash Flow Overview</span>
              <span className="card-cute-pill chart-pill">📊 Financial Trends</span>
            </div>
            <div className="filter-group chart-toolbar">
              <div className="pill-switch" role="tablist">
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
          </div>
          <LineChart transactions={transactions} period={chartPeriod} showBalance={showBalance} />
        </div>
        <div className="card goals-card stat-card-cute">
          <div className="goals-card-header">
            <div className="card-badge-row">
              <span className="card-icon-badge target">
                <TargetIcon size={18} />
              </span>
              <span className="label">Saving Goals</span>
              <span className="card-cute-pill goals-pill">🎯 Savings Goals</span>
            </div>
            {goals.length > 0 && <span className="goals-count-badge">{goals.length} active</span>}
          </div>

          {goals.length ? (
            <div className="goals-list">
              {goals.map((goal) => {
                const pct = progressPercent(goal);
                const isAchieved = pct >= 100;
                return (
                  <div className={`goal-item ${isAchieved ? 'goal-completed' : ''}`} key={goal.id || goal.name}>
                    <div className="goal-header">
                      <span className="goal-name">{capitalizeWords(goal.name)}</span>
                      <span className="goal-amount">
                        {showBalance
                          ? `${formatRupiah(summary.balance)} / ${formatRupiah(goal.target)}`
                          : 'Rp •••••• / ••••••'}
                      </span>
                    </div>
                    <div
                      className={`progress-shell ${!showBalance ? 'is-privacy' : ''}`}
                      role="progressbar"
                      aria-valuenow={showBalance ? pct : undefined}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`fill ${isAchieved ? 'completed' : ''} ${!showBalance ? 'privacy-shimmer-fill' : ''}`}
                        style={{ width: showBalance ? `${pct}%` : '100%' }}
                      />
                      {showBalance && (
                        <div
                          className={`progress-coin-marker ${isAchieved ? 'is-achieved' : ''}`}
                          style={{ left: `clamp(11px, ${pct}%, calc(100% - 11px))` }}
                          aria-hidden="true"
                        >
                          {isAchieved ? <SmilingCoinIcon size={24} /> : <ProgressCoinIcon size={22} />}
                        </div>
                      )}
                    </div>
                    <div className="goal-meta-row">
                      <span className={`goal-percent-text ${isAchieved ? 'achieved' : ''} ${!showBalance ? 'is-privacy-text' : ''}`}>
                        {showBalance
                          ? isAchieved
                            ? 'Target Achieved! 🎯'
                            : `${pct}% reached`
                          : '🔒 Value hidden (••••%)'}
                      </span>
                      <span className="goal-type-badge">{goal.type || 'Saving'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <TargetIcon size={28} className="empty-icon" />
              <p className="empty-text">No goals yet</p>
              <p className="empty-sub">Create your first goal to track your savings.</p>
              <button
                type="button"
                className="pill small btn-primary empty-action-btn"
                onClick={() => navigate('/goals')}
              >
                Set a Goal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
