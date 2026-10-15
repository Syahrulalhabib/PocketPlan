import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useData } from '../providers/DataProvider.jsx';
import { getAuthToken } from '../services/firebase.js';
import LaporanSheet from './LaporanSheet.jsx';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatIdr(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

function formatShortNominal(n) {
  const num = Number(n || 0);
  if (num >= 1000000) return (num / 1000000).toFixed(2).replace(/\.00$/, '') + ' jt';
  if (num >= 1000) return (num / 1000).toFixed(0) + ' rb';
  return String(num);
}

function formatShortDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '-';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const day = parts[2].slice(0, 2);
  const m = parseInt(parts[1], 10);
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${MONTH_SHORT[m - 1] || ''}`;
}

export function getIndoMonthLabel(monthStr) {
  if (!monthStr || !monthStr.includes('-')) return '';
  const [y, m] = monthStr.split('-').map(Number);
  return `${MONTH_NAMES[m - 1] || ''} ${y}`;
}

export function computeLocalReport(monthStr, transactions = [], goals = [], user = null) {
  const [y, m] = monthStr.split('-').map(Number);
  const prevDate = new Date(Date.UTC(y, m - 2, 1));
  const prevMonthStr = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const currTx = transactions.filter((t) => typeof t.date === 'string' && t.date.startsWith(monthStr));
  const prevTx = transactions.filter((t) => typeof t.date === 'string' && t.date.startsWith(prevMonthStr));

  const currIn = currTx.filter((t) => t.type === 'Income');
  const currOut = currTx.filter((t) => t.type === 'Expense');
  const totalPemasukan = currIn.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalPengeluaran = currOut.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const surplus = totalPemasukan - totalPengeluaran;
  const rasioMenabung = totalPemasukan > 0 ? Math.max(0, Math.round((surplus / totalPemasukan) * 100)) : 0;
  const jumlahTransaksi = currTx.length;
  const jumlahTransaksiIn = currIn.length;
  const jumlahTransaksiOut = currOut.length;

  const prevPengeluaran = prevTx.filter((t) => t.type === 'Expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const persenPerubahan = prevPengeluaran > 0 ? Math.round(((totalPengeluaran - prevPengeluaran) / prevPengeluaran) * 100) : 0;

  const catMap = new Map();
  for (const t of currOut) {
    const c = t.category || 'Other';
    catMap.set(c, (catMap.get(c) || 0) + (Number(t.amount) || 0));
  }
  const byCategory = [...catMap.entries()]
    .map(([nama, total]) => ({ nama, total, persen: totalPengeluaran > 0 ? Math.round((total / totalPengeluaran) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);

  const weeklyTrend = [0, 0, 0, 0];
  for (const t of currOut) {
    const d = parseInt((t.date || '').slice(8, 10), 10);
    const amt = Number(t.amount) || 0;
    if (d <= 7) weeklyTrend[0] += amt;
    else if (d <= 14) weeklyTrend[1] += amt;
    else if (d <= 21) weeklyTrend[2] += amt;
    else weeklyTrend[3] += amt;
  }

  const topTransactions = [...currOut]
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .slice(0, 5)
    .map((t) => ({ tanggal: t.date, keterangan: t.description || 'Expense', kategori: t.category || 'Other', nominal: Number(t.amount) || 0 }));

  const prevCatMap = new Map();
  for (const t of prevTx.filter((x) => x.type === 'Expense')) {
    const c = t.category || 'Other';
    prevCatMap.set(c, (prevCatMap.get(c) || 0) + (Number(t.amount) || 0));
  }

  const comparison = [{ nama: 'Total Expenses', bulanLalu: prevPengeluaran, bulanIni: totalPengeluaran, persenPerubahan }];
  for (let i = 0; i < Math.min(2, byCategory.length); i++) {
    const cat = byCategory[i].nama;
    const curVal = byCategory[i].total;
    const preVal = prevCatMap.get(cat) || 0;
    const delta = preVal > 0 ? Math.round(((curVal - preVal) / preVal) * 100) : 0;
    comparison.push({ nama: cat, bulanLalu: preVal, bulanIni: curVal, persenPerubahan: delta });
  }

  const baseBal = Number(user?.baseBalance || 0);
  const allIn = transactions.filter((t) => t.type === 'Income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const allOut = transactions.filter((t) => t.type === 'Expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const currentBal = Math.max(0, baseBal + allIn - allOut);

  const goalsList = goals.map((g) => {
    const tgt = Number(g.target) || 0;
    const collected = Math.min(tgt, (g.amount !== undefined && Number(g.amount) > currentBal) ? Number(g.amount) : currentBal);
    const pct = tgt > 0 ? Math.max(0, Math.min(100, Math.round((collected / tgt) * 100))) : 0;
    return {
      id: g.id,
      nama: g.name || 'Goal',
      terkumpul: collected,
      target: tgt,
      persen: pct
    };
  });

  const rataRataHarian = daysInMonth > 0 ? Math.round(totalPengeluaran / daysInMonth) : 0;

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daySpend = [0, 0, 0, 0, 0, 0, 0];
  for (const t of currOut) {
    daySpend[new Date(`${t.date}T00:00:00Z`).getUTCDay()] += Number(t.amount) || 0;
  }
  let maxDayIdx = 0;
  for (let i = 1; i < 7; i++) if (daySpend[i] > daySpend[maxDayIdx]) maxDayIdx = i;
  const hariTerboros = { hari: DAYS[maxDayIdx], total: daySpend[maxDayIdx] };
  const kategoriTerhemat = byCategory.length > 0 ? byCategory[byCategory.length - 1] : { nama: '-', total: 0 };

  let insight = '';
  if (!totalPengeluaran && !totalPemasukan) {
    insight = 'No transactions recorded this month. Start logging your daily expenses!';
  } else {
    const top = byCategory[0];
    const topNom = top ? formatShortNominal(top.total) : '0';
    const topNama = top?.nama || 'expenses';
    const surpStr = formatShortNominal(Math.max(0, surplus));
    if (persenPerubahan > 0) {
      insight = `Your spending rose ${persenPerubahan}% compared to last month — driven mostly by ${topNama} (${topNom}). Good news: you maintained a net surplus of ${surpStr} and kept your streak alive. Keep steady and watch your ${topNama} budget next month! 🎯`;
    } else if (persenPerubahan < 0) {
      insight = `Great job! Your spending was ${Math.abs(persenPerubahan)}% lower than last month. Top category was ${topNama} (${topNom}) and your net surplus reached ${surpStr}. Keep up this healthy habit! ✨`;
    } else {
      insight = `Spending remained stable this month with a net surplus of ${surpStr}. Top category was ${topNama} (${topNom}). Keep watching your savings targets! 💪`;
    }
  }

  const badges = [
    { type: 'streak', icon: '🔥', text: '23 days', sub: 'logging streak' },
    { type: 'tx', icon: '📊', text: `${jumlahTransaksi}`, sub: 'transactions' },
    { type: 'budget', icon: '💰', text: '3/5', sub: 'budgets on track' },
    { type: 'goal', icon: '🎯', text: `${goalsList.filter((g) => g.persen >= 100).length || 1}`, sub: 'goals reached' },
    { type: 'challenge', icon: '🎖️', text: '2', sub: 'challenges completed' }
  ];

  return {
    month: monthStr,
    prevMonth: prevMonthStr,
    daysInMonth,
    summary: { totalPemasukan, totalPengeluaran, surplus, rasioMenabung, jumlahTransaksi, jumlahTransaksiIn, jumlahTransaksiOut, persenPerubahan },
    byCategory,
    weeklyTrend,
    topTransactions,
    comparison,
    goals: goalsList,
    budgets: { total: 5, terjaga: 3 },
    streak: 23,
    funFacts: { rataRataHarian, hariTerboros, kategoriTerhemat },
    insight,
    badges
  };
}

const CAT_COLORS = ['#e45153', '#f59e0b', '#8b5cf6', '#3b82f6', '#94a3b8', '#10b981'];

const LaporanPage = () => {
  const { user, isDemo } = useAuth();
  const { transactions, goals } = useData();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [report, setReport] = useState(() => computeLocalReport(currentMonthStr, transactions, goals));
  const [loading, setLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    document.title = 'Monthly Financial Report - Pocketplan';
  }, []);

  useEffect(() => {
    if (isDemo) {
      setReport(computeLocalReport(selectedMonth, transactions, goals));
      return;
    }

    let active = true;
    async function fetchReport() {
      setLoading(true);
      try {
        const token = await getAuthToken();
        if (!token) {
          if (active) setReport(computeLocalReport(selectedMonth, transactions, goals));
          return;
        }
        const res = await fetch(`/api/report?month=${selectedMonth}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('API report error');
        const data = await res.json();
        if (active) setReport(data);
      } catch (e) {
        if (active) setReport(computeLocalReport(selectedMonth, transactions, goals));
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchReport();
    return () => { active = false; };
  }, [selectedMonth, isDemo, transactions, goals]);

  const userName = user?.displayName || user?.name || (isDemo ? 'Demo User' : 'User');
  const monthLabel = useMemo(() => getIndoMonthLabel(selectedMonth), [selectedMonth]);
  const prevMonthLabel = useMemo(() => {
    if (!report?.prevMonth) {
      const [y, m] = selectedMonth.split('-').map(Number);
      const prevDate = new Date(Date.UTC(y, m - 2, 1));
      const prevStr = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
      return getIndoMonthLabel(prevStr);
    }
    return getIndoMonthLabel(report.prevMonth);
  }, [selectedMonth, report?.prevMonth]);

  return (
    <div className="laporan-container">
      <div className="laporan-toolbar no-print">
        <div className="laporan-month-picker">
          <label htmlFor="month-select" style={{ fontWeight: 600, fontSize: '0.92rem' }}>Select Month:</label>
          <input
            id="month-select"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn-laporan-print"
          onClick={() => window.open(`/laporan/cetak?month=${selectedMonth}`, '_blank')}
        >
          🖨️ Print / Save PDF
        </button>
      </div>

      {loading && !report ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Loading financial report...
        </div>
      ) : (
        <LaporanSheet
          report={report}
          monthLabel={monthLabel}
          prevMonthLabel={prevMonthLabel}
          userName={userName}
        />
      )}
    </div>
  );
};

export default LaporanPage;
