import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';
import { useMemo } from 'react';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

const toLocalDayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseTransactionDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const periodLabels = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly'
};

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as first day of week
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const LineChart = ({ transactions, days, period = 'daily' }) => {
  const data = useMemo(() => {
    const parsed = transactions
      .map((t) => {
        const date = parseTransactionDate(t.date) || parseTransactionDate(t.createdAt);
        return date ? { ...t, __date: date } : null;
      })
      .filter(Boolean);

    const end = parsed.length
      ? new Date(Math.max(...parsed.map((t) => t.__date.getTime())))
      : new Date();
    end.setHours(0, 0, 0, 0);

    const start = (() => {
      const parsedDays = Number(days);
      if (Number.isFinite(parsedDays) && parsedDays > 0) {
        const safeDays = Math.max(1, Math.min(3660, Math.floor(parsedDays)));
        const windowStart = new Date(end);
        windowStart.setDate(end.getDate() - (safeDays - 1));
        return windowStart;
      }

      if (parsed.length) {
        const min = new Date(Math.min(...parsed.map((t) => t.__date.getTime())));
        min.setHours(0, 0, 0, 0);
        return min;
      }

      return new Date(end);
    })();

    const bucketIncome = new Map();
    const bucketExpense = new Map();

    for (const t of parsed) {
      const day = new Date(t.__date);
      day.setHours(0, 0, 0, 0);
      if (day < start || day > end) continue;
      let key;
      if (period === 'weekly') {
        key = toLocalDayKey(startOfWeek(day));
      } else if (period === 'monthly') {
        key = toMonthKey(day);
      } else {
        key = toLocalDayKey(day);
      }
      const amount = Number(t.amount) || 0;
      if (t.type === 'Income') bucketIncome.set(key, (bucketIncome.get(key) || 0) + amount);
      if (t.type === 'Expense') bucketExpense.set(key, (bucketExpense.get(key) || 0) + amount);
    }

    const labels = [];
    const incomeData = [];
    const expenseData = [];
    const cursor = new Date(start);
    if (period === 'weekly') {
      cursor.setTime(startOfWeek(cursor).getTime());
    } else if (period === 'monthly') {
      cursor.setDate(1);
      cursor.setHours(0, 0, 0, 0);
    }

    while (cursor <= end) {
      let key;
      if (period === 'weekly') {
        key = toLocalDayKey(cursor);
        labels.push(
          `Week of ${cursor.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short'
          })}`
        );
        cursor.setDate(cursor.getDate() + 7);
      } else if (period === 'monthly') {
        key = toMonthKey(cursor);
        labels.push(
          cursor.toLocaleDateString('en-GB', {
            month: 'short',
            year: 'numeric'
          })
        );
        cursor.setMonth(cursor.getMonth() + 1);
      } else {
        key = toLocalDayKey(cursor);
        labels.push(
          cursor.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short'
          })
        );
        cursor.setDate(cursor.getDate() + 1);
      }

      incomeData.push(bucketIncome.get(key) || 0);
      expenseData.push(bucketExpense.get(key) || 0);
    }

    const periodLabel = periodLabels[period] || periodLabels.daily;
    return {
      labels,
      datasets: [
        {
          label: `Income (${periodLabel})`,
          data: incomeData,
          borderColor: '#5b77ff',
          backgroundColor: '#5b77ff',
          tension: 0.35,
          pointRadius: 4
        },
        {
          label: `Expense (${periodLabel})`,
          data: expenseData,
          borderColor: '#e45153',
          backgroundColor: '#e45153',
          tension: 0.35,
          pointRadius: 4
        }
      ]
    };
  }, [transactions, days, period]);

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const value = Number(ctx.parsed?.y || 0);
            return `${ctx.dataset.label}: Rp ${value.toLocaleString('id-ID')}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `Rp ${Number(value).toLocaleString('id-ID')}`
        }
      }
    }
  };

  return <Line data={data} options={options} />;
};

export default LineChart;
