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

const LineChart = ({ transactions, days }) => {
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

    const incomeByDay = new Map();
    const expenseByDay = new Map();

    for (const t of parsed) {
      const day = new Date(t.__date);
      day.setHours(0, 0, 0, 0);
      if (day < start || day > end) continue;
      const key = toLocalDayKey(day);
      const amount = Number(t.amount) || 0;
      if (t.type === 'Income') incomeByDay.set(key, (incomeByDay.get(key) || 0) + amount);
      if (t.type === 'Expense') expenseByDay.set(key, (expenseByDay.get(key) || 0) + amount);
    }

    const labels = [];
    const incomeData = [];
    const expenseData = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = toLocalDayKey(cursor);
      labels.push(
        cursor.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short'
        })
      );
      incomeData.push(incomeByDay.get(key) || 0);
      expenseData.push(expenseByDay.get(key) || 0);
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      labels,
      datasets: [
        {
          label: 'Pemasukan (Harian)',
          data: incomeData,
          borderColor: '#5b77ff',
          backgroundColor: '#5b77ff',
          tension: 0.35,
          pointRadius: 4
        },
        {
          label: 'Pengeluaran (Harian)',
          data: expenseData,
          borderColor: '#e45153',
          backgroundColor: '#e45153',
          tension: 0.35,
          pointRadius: 4
        }
      ]
    };
  }, [transactions, days]);

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
