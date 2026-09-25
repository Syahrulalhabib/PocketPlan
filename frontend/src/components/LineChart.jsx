import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { memo, useMemo, useState } from 'react';
import { useTheme } from '../providers/ThemeProvider.jsx';
import { formatRupiah } from '../utils/formatters.js';

ChartJS.register(LineElement, BarElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

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

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as first day of week
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const LineChart = ({ transactions = [], days, period = 'daily', showBalance = true }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [visibleSeries, setVisibleSeries] = useState({ income: true, expense: true });
  const [chartShape, setChartShape] = useState('area'); // 'area' | 'bar'

  const toggleSeries = (key) => {
    setVisibleSeries((prev) => {
      const otherKey = key === 'income' ? 'expense' : 'income';
      if (prev[key] && !prev[otherKey]) {
        return { income: true, expense: true };
      }
      return { ...prev, [key]: !prev[key] };
    });
  };
  const { chartData, totals, hasData } = useMemo(() => {
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

      const minDate = parsed.length
        ? new Date(Math.min(...parsed.map((t) => t.__date.getTime())))
        : new Date(end);
      minDate.setHours(0, 0, 0, 0);

      // Default minimum window when days prop is omitted so the chart is always full
      const defaultStart = new Date(end);
      if (period === 'weekly') {
        defaultStart.setDate(end.getDate() - 28); // 4 weeks
      } else if (period === 'monthly') {
        defaultStart.setMonth(end.getMonth() - 5); // 6 months
        defaultStart.setDate(1);
      } else {
        defaultStart.setDate(end.getDate() - 6); // 7 days
      }

      if (minDate < defaultStart) {
        if (period === 'daily') {
          // Cap daily view to at most 30 days to keep labels legible
          const maxDaily = new Date(end);
          maxDaily.setDate(end.getDate() - 29);
          return minDate < maxDaily ? maxDaily : minDate;
        }
        return minDate;
      }

      return defaultStart;
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
    let periodIncomeTotal = 0;
    let periodExpenseTotal = 0;
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
          cursor.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short'
          })
        );
        cursor.setDate(cursor.getDate() + 7);
      } else if (period === 'monthly') {
        key = toMonthKey(cursor);
        labels.push(
          cursor.toLocaleDateString('en-GB', {
            month: 'short',
            year: '2-digit'
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

      const inc = bucketIncome.get(key) || 0;
      const exp = bucketExpense.get(key) || 0;
      incomeData.push(inc);
      expenseData.push(exp);
      periodIncomeTotal += inc;
      periodExpenseTotal += exp;
    }

    const datasets = chartShape === 'bar'
      ? [
          {
            label: 'Income',
            data: incomeData,
            backgroundColor: (context) => {
              const { ctx, chartArea } = context.chart;
              if (!chartArea) return '#10b981';
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, '#10b981');
              gradient.addColorStop(1, '#059669');
              return gradient;
            },
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.72,
            categoryPercentage: 0.65,
            hidden: !visibleSeries.income
          },
          {
            label: 'Expense',
            data: expenseData,
            backgroundColor: (context) => {
              const { ctx, chartArea } = context.chart;
              if (!chartArea) return '#f43f5e';
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, '#f43f5e');
              gradient.addColorStop(1, '#e11d48');
              return gradient;
            },
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.72,
            categoryPercentage: 0.65,
            hidden: !visibleSeries.expense
          }
        ]
      : [
          {
            label: 'Income',
            data: incomeData,
            borderColor: '#10b981',
            borderWidth: 3,
            fill: true,
            backgroundColor: (context) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'transparent';
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, 'rgba(16, 185, 129, 0.32)');
              gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.08)');
              gradient.addColorStop(1, 'rgba(16, 185, 129, 0.00)');
              return gradient;
            },
            tension: 0.42,
            pointRadius: labels.length > 14 ? 0 : 2.5,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#10b981',
            pointBorderWidth: 2,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: '#10b981',
            pointHoverBorderColor: isDark ? '#0f172a' : '#ffffff',
            pointHoverBorderWidth: 3,
            hidden: !visibleSeries.income
          },
          {
            label: 'Expense',
            data: expenseData,
            borderColor: '#f43f5e',
            borderWidth: 3,
            fill: true,
            backgroundColor: (context) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'transparent';
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, 'rgba(244, 63, 94, 0.28)');
              gradient.addColorStop(0.5, 'rgba(244, 63, 94, 0.07)');
              gradient.addColorStop(1, 'rgba(244, 63, 94, 0.00)');
              return gradient;
            },
            tension: 0.42,
            pointRadius: labels.length > 14 ? 0 : 2.5,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#f43f5e',
            pointBorderWidth: 2,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: '#f43f5e',
            pointHoverBorderColor: isDark ? '#0f172a' : '#ffffff',
            pointHoverBorderWidth: 3,
            hidden: !visibleSeries.expense
          }
        ];

    return {
      chartData: { labels, datasets },
      totals: {
        income: periodIncomeTotal,
        expense: periodExpenseTotal,
        net: periodIncomeTotal - periodExpenseTotal
      },
      hasData: periodIncomeTotal > 0 || periodExpenseTotal > 0
    };
  }, [transactions, days, period, visibleSeries, isDark, chartShape]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      animation: {
        duration: 500,
        easing: 'easeOutQuart'
      },
      layout: {
        padding: {
          left: 4,
          right: 10,
          top: 10,
          bottom: 2
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#334155',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
          borderWidth: 1,
          padding: {
            top: 10,
            bottom: 10,
            left: 12,
            right: 12
          },
          cornerRadius: 10,
          boxPadding: 6,
          usePointStyle: true,
          titleFont: {
            family: 'Poppins, sans-serif',
            size: 12,
            weight: '600'
          },
          bodyFont: {
            family: 'Poppins, sans-serif',
            size: 12,
            weight: '500'
          },
          callbacks: {
            title: (items) => {
              if (!items.length) return '';
              return items[0].label;
            },
            label: (ctx) => {
              if (!showBalance) {
                return ` ${ctx.dataset.label}: Rp ••••••`;
              }
              const value = Number(ctx.parsed?.y || 0);
              return ` ${ctx.dataset.label}: Rp ${value.toLocaleString('id-ID')}`;
            },
            afterBody: (items) => {
              if (items.length < 2 || !showBalance) return '';
              const inc = items.find((i) => i.dataset.label === 'Income')?.parsed?.y || 0;
              const exp = items.find((i) => i.dataset.label === 'Expense')?.parsed?.y || 0;
              const diff = inc - exp;
              const prefix = diff > 0 ? '+Rp ' : diff < 0 ? '-Rp ' : 'Rp ';
              return `\nNet Flow: ${prefix}${Math.abs(diff).toLocaleString('id-ID')}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            autoSkip: true,
            maxTicksLimit: 7,
            maxRotation: 0,
            color: isDark ? '#94a3b8' : '#64748b',
            font: {
              family: 'Poppins, sans-serif',
              size: 11,
              weight: '500'
            }
          },
          grid: {
            display: false,
            drawBorder: false
          },
          border: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grace: '6%',
          ticks: {
            maxTicksLimit: 5,
            color: isDark ? '#94a3b8' : '#64748b',
            font: {
              family: 'Poppins, sans-serif',
              size: 11,
              weight: '500'
            },
            callback: (value) => {
              if (!showBalance) return '••••';
              const num = Number(value);
              if (num === 0) return '0';
              if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
              if (num >= 1000000) return `${(num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1)}M`;
              if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
              return num;
            }
          },
          grid: {
            color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
            drawBorder: false,
            borderDash: [4, 4]
          },
          border: {
            display: false
          }
        }
      }
    };
  }, [isDark, showBalance]);

  const crosshairPlugin = useMemo(() => {
    return {
      id: 'crosshair',
      afterDraw: (chart) => {
        if (chartShape !== 'area') return;
        if (chart.tooltip?._active?.length) {
          const activePoint = chart.tooltip._active[0];
          const { ctx } = chart;
          const x = activePoint.element.x;
          const topY = chart.chartArea?.top || 0;
          const bottomY = chart.chartArea?.bottom || chart.height;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x, topY);
          ctx.lineTo(x, bottomY);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.10)';
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.restore();
        }
      }
    };
  }, [chartShape, isDark]);

  const ChartComponent = chartShape === 'bar' ? Bar : Line;

  return (
    <div className="chart-wrapper">
      <div className="chart-legend-kpi">
        <div className="chart-kpi-group">
          <button
            type="button"
            className={`chart-kpi-chip income ${!visibleSeries.income ? 'is-muted' : ''}`}
            onClick={() => toggleSeries('income')}
            title="Click to toggle Income"
          >
            <span className="chart-kpi-dot income-dot" />
            <span className="chart-kpi-name">Income:</span>
            <span className="chart-kpi-val">
              {showBalance ? formatRupiah(totals.income) : 'Rp ••••••'}
            </span>
          </button>

          <button
            type="button"
            className={`chart-kpi-chip expense ${!visibleSeries.expense ? 'is-muted' : ''}`}
            onClick={() => toggleSeries('expense')}
            title="Click to toggle Expense"
          >
            <span className="chart-kpi-dot expense-dot" />
            <span className="chart-kpi-name">Expense:</span>
            <span className="chart-kpi-val">
              {showBalance ? formatRupiah(totals.expense) : 'Rp ••••••'}
            </span>
          </button>
        </div>

        <div className="chart-controls-group">
          <div className={`chart-net-pill ${totals.net >= 0 ? 'is-positive' : 'is-negative'}`}>
            <span className="net-pill-label">{totals.net >= 0 ? 'Surplus:' : 'Deficit:'}</span>
            <span className="net-pill-val">
              {showBalance ? `${totals.net >= 0 ? '+' : ''}${formatRupiah(totals.net)}` : 'Rp ••••••'}
            </span>
          </div>

          <div className="chart-shape-switch" role="group" aria-label="Chart display type">
            <button
              type="button"
              className={`chart-shape-btn ${chartShape === 'area' ? 'active' : ''}`}
              onClick={() => setChartShape('area')}
              title="Area Spline View (Smooth Curve)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18l6-7 5 4 7-9" />
              </svg>
              <span>Area</span>
            </button>
            <button
              type="button"
              className={`chart-shape-btn ${chartShape === 'bar' ? 'active' : ''}`}
              onClick={() => setChartShape('bar')}
              title="Grouped Bar View"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="12" width="4" height="9" rx="1" />
                <rect x="10" y="7" width="4" height="14" rx="1" />
                <rect x="17" y="3" width="4" height="18" rx="1" />
              </svg>
              <span>Bar</span>
            </button>
          </div>
        </div>
      </div>

      <div className="chart-canvas-wrap">
        <ChartComponent data={chartData} options={chartOptions} plugins={[crosshairPlugin]} />
        {!hasData && (
          <div className="chart-empty-badge">
            <span>💡 No transactions recorded in this period yet</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(LineChart);
