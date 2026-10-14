import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useData } from '../providers/DataProvider.jsx';
import { getAuthToken } from '../services/firebase.js';
import LaporanSheet from './LaporanSheet.jsx';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
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
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
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
    const c = t.category || 'Lainnya';
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
    .map((t) => ({ tanggal: t.date, keterangan: t.description || 'Pengeluaran', kategori: t.category || 'Lainnya', nominal: Number(t.amount) || 0 }));

  const prevCatMap = new Map();
  for (const t of prevTx.filter((x) => x.type === 'Expense')) {
    const c = t.category || 'Lainnya';
    prevCatMap.set(c, (prevCatMap.get(c) || 0) + (Number(t.amount) || 0));
  }

  const comparison = [{ nama: 'Total Pengeluaran', bulanLalu: prevPengeluaran, bulanIni: totalPengeluaran, persenPerubahan }];
  for (let i = 0; i < Math.min(2, byCategory.length); i++) {
    const cat = byCategory[i].nama;
    const curVal = byCategory[i].total;
    const preVal = prevCatMap.get(cat) || 0;
    const delta = preVal > 0 ? Math.round(((curVal - preVal) / preVal) * 100) : 0;
    comparison.push({ nama: cat, bulanLalu: preVal, bulanIni: curVal, persenPerubahan: delta });
  }

  const goalsList = goals.map((g) => ({
    nama: g.name || 'Target',
    terkumpul: Number(g.amount) || 0,
    target: Number(g.target) || 0,
    persen: Number(g.target) > 0 ? Math.min(100, Math.round(((Number(g.amount) || 0) / Number(g.target)) * 100)) : 0
  }));

  const rataRataHarian = daysInMonth > 0 ? Math.round(totalPengeluaran / daysInMonth) : 0;

  const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const daySpend = [0, 0, 0, 0, 0, 0, 0];
  for (const t of currOut) {
    daySpend[new Date(`${t.date}T00:00:00Z`).getUTCDay()] += Number(t.amount) || 0;
  }
  let maxDayIdx = 0;
  for (let i = 1; i < 7; i++) if (daySpend[i] > daySpend[maxDayIdx]) maxDayIdx = i;
  const hariTerboros = { hari: INDO_DAYS[maxDayIdx], total: daySpend[maxDayIdx] };
  const kategoriTerhemat = byCategory.length > 0 ? byCategory[byCategory.length - 1] : { nama: '-', total: 0 };

  let insight = '';
  if (!totalPengeluaran && !totalPemasukan) {
    insight = 'Belum ada transaksi bulan ini. Catat transaksi harianmu!';
  } else {
    const top = byCategory[0];
    const topNom = top ? formatShortNominal(top.total) : '0';
    const topNama = top?.nama || 'belanja';
    const surpStr = formatShortNominal(Math.max(0, surplus));
    if (persenPerubahan > 0) {
      insight = `Pengeluaranmu naik ${persenPerubahan}% dibanding bulan lalu — pemicunya ${topNama} Rp ${topNom}! Kabar baiknya kamu tetap surplus Rp ${surpStr} dan streak tetap terjaga. Pertahankan dan kendalikan pos ${topNama} bulan depan! 🎯`;
    } else if (persenPerubahan < 0) {
      insight = `Keren! Pengeluaranmu lebih hemat ${Math.abs(persenPerubahan)}% dibanding bulan lalu. Pos terbesar adalah ${topNama} (Rp ${topNom}) dan surplusmu mencapai Rp ${surpStr}. Pertahankan kebiasaan bijak ini! ✨`;
    } else {
      insight = `Pengeluaran bulan ini stabil dengan surplus Rp ${surpStr}. Pos belanja terbesar ada pada ${topNama} (Rp ${topNom}). Terus pantau target tabunganmu! 💪`;
    }
  }

  const badges = [
    { type: 'streak', icon: '🔥', text: '23 hari', sub: 'streak catat' },
    { type: 'tx', icon: '📊', text: `${jumlahTransaksi}`, sub: 'transaksi' },
    { type: 'budget', icon: '💰', text: '3/5', sub: 'budget terjaga' },
    { type: 'goal', icon: '🎯', text: `${goalsList.filter((g) => g.persen >= 100).length || 1}`, sub: 'target tercapai' },
    { type: 'challenge', icon: '🎖️', text: '2', sub: 'tantangan selesai' }
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
    document.title = 'Laporan Keuangan Bulanan - Pocketplan';
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

  const userName = user?.displayName || user?.name || (isDemo ? 'Demo User' : 'Pengguna');
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
          <label htmlFor="month-select" style={{ fontWeight: 600, fontSize: '0.92rem' }}>Pilih Bulan:</label>
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
          🖨️ Cetak / Simpan PDF
        </button>
      </div>

      {loading && !report ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Memuat laporan keuangan...
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
