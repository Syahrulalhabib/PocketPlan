import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useData } from '../providers/DataProvider.jsx';
import { getAuthToken } from '../services/firebase.js';
import pocketLogo from '../assets/pocket-logo.svg';

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

function getIndoMonthLabel(monthStr) {
  if (!monthStr || !monthStr.includes('-')) return '';
  const [y, m] = monthStr.split('-').map(Number);
  return `${MONTH_NAMES[m - 1] || ''} ${y}`;
}

function computeLocalReport(monthStr, transactions = [], goals = []) {
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

  const handlePrint = () => {
    setShowPrintModal(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const periodLabel = getIndoMonthLabel(selectedMonth);
  const prevPeriodLabel = getIndoMonthLabel(report.prevMonth);
  const firstName = user?.name ? user.name.split(' ')[0] : 'Teman';
  const savingPct = Math.min(100, Math.max(0, report.summary?.rasioMenabung || 0));

  // Gauge calculation
  const gaugeAngle = (savingPct / 100) * 180;
  const rad = (180 - gaugeAngle) * (Math.PI / 180);
  const needleX = (100 + 70 * Math.cos(rad)).toFixed(1);
  const needleY = (105 - 70 * Math.sin(rad)).toFixed(1);
  const gaugeDash = `${((savingPct / 100) * 251.3).toFixed(1)} 251.3`;

  // Weekly Trend points
  const maxWeekly = Math.max(...report.weeklyTrend, 1);
  const wtPts = report.weeklyTrend.map((v, i) => {
    const x = 15 + i * 90;
    const y = 85 - (v / maxWeekly) * 55;
    return { x, y: Math.max(25, Math.min(85, y)) };
  });
  const polylineStr = wtPts.map((p) => `${p.x},${p.y}`).join(' ');
  const polygonStr = `${wtPts[0].x},${wtPts[0].y} ${polylineStr} ${wtPts[3].x},110 ${wtPts[0].x},110`;

  // Daily map and heatmap data
  const currTx = useMemo(() => {
    return transactions.filter((t) => typeof t.date === 'string' && t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const [selYear, selMo] = selectedMonth.split('-').map(Number);
  const startDayOfWeek = new Date(Date.UTC(selYear, selMo - 1, 1)).getUTCDay();

  const dailyExpenses = useMemo(() => {
    const map = new Map();
    for (const t of currTx.filter((x) => x.type === 'Expense')) {
      const d = parseInt((t.date || '').slice(8, 10), 10);
      map.set(d, (map.get(d) || 0) + (Number(t.amount) || 0));
    }
    return map;
  }, [currTx]);

  const maxDailySpend = useMemo(() => {
    const vals = [...dailyExpenses.values()];
    return vals.length > 0 ? Math.max(...vals, 1) : 1;
  }, [dailyExpenses]);

  return (
    <div className="laporan-container">
      {/* Print Checklist Modal */}
      {showPrintModal && (
        <div className="modal-backdrop no-print" onClick={() => setShowPrintModal(false)}>
          <div className="card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: 12, fontWeight: 700 }}>🖨️ Tips Cetak PDF A4</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: 16 }}>
              Agar hasil cetak PDF rapi dan warna background tidak hilang, pastikan pengaturan berikut di jendela print:
            </p>
            <ul style={{ fontSize: '0.88rem', lineHeight: 1.8, paddingLeft: 20, marginBottom: 20 }}>
              <li>☑ <b>Margins:</b> Default</li>
              <li>☑ <b>Background graphics:</b> Dicentang / Aktif</li>
              <li>☑ <b>Headers and footers:</b> Mati / Dihapus centang</li>
              <li>☑ <b>Ukuran kertas:</b> A4</li>
            </ul>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary pill" onClick={() => setShowPrintModal(false)}>
                Batal
              </button>
              <button type="button" className="btn-primary pill" onClick={handlePrint}>
                Lanjut Cetak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="laporan-toolbar no-print">
        <div className="laporan-month-picker">
          <label htmlFor="month-select" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Pilih Bulan:</label>
          <input
            id="month-select"
            type="month"
            value={selectedMonth}
            onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
          />
        </div>
        <button type="button" className="btn-laporan-print" onClick={() => setShowPrintModal(true)}>
          🖨️ Cetak / Simpan PDF
        </button>
      </div>

      {/* Laporan Sheet */}
      <div className="laporan-sheet page">
        <div className="strip" />

        {/* Header */}
        <div className="header">
          <div className="brand">
            <img src={pocketLogo} alt="Pocketplan logo" className="brand-logo" />
            <div className="word">Pocket<span>plan</span></div>
          </div>
          <div className="period">
            <div className="kicker">Laporan Bulanan</div>
            <h2>{periodLabel}</h2>
            <p>{user?.name || 'Pengguna'}</p>
          </div>
        </div>

        {/* Hero */}
        <p className="hero">
          Hai <b>{firstName}</b>! Ini rangkuman keuanganmu 1–{report.daysInMonth} {periodLabel}. Pocky yang hitungin, kamu yang tinggal baca ✨
        </p>

        {/* Summary Cards */}
        <div className="cards">
          <div className="card c-in">
            <small>💰 Pemasukan</small>
            <div className="num">{formatIdr(report.summary.totalPemasukan)}</div>
            <div className="sub">{report.summary.jumlahTransaksiIn || report.summary.jumlahTransaksi} transaksi</div>
          </div>
          <div className="card c-out">
            <small>💸 Pengeluaran</small>
            <div className="num">{formatIdr(report.summary.totalPengeluaran)}</div>
            <div className="sub">
              {report.summary.jumlahTransaksiOut || report.summary.jumlahTransaksi} transaksi
              {report.summary.persenPerubahan !== 0 && (
                ` • ${report.summary.persenPerubahan > 0 ? 'naik' : 'turun'} ${Math.abs(report.summary.persenPerubahan)}%`
              )}
            </div>
          </div>
          <div className="card c-ok">
            <small>✨ Surplus</small>
            <div className="num">{formatIdr(report.summary.surplus)}</div>
            <div className="sub">{savingPct}% dari pemasukan</div>
          </div>
        </div>

        {/* Sec 1: Rasio Menabung & Fakta Seru */}
        <h3 className="sec"><span className="n">1</span> Rasio Menabung &amp; Fakta Seru</h3>
        <div className="grid2">
          <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="150" height="100" viewBox="0 0 200 120">
              <path d="M 20 105 A 80 80 0 0 1 180 105" fill="none" stroke="#f1f5f9" strokeWidth="20" strokeLinecap="round" />
              <path d="M 20 105 A 80 80 0 0 1 180 105" fill="none" stroke="url(#gg)" strokeWidth="20" strokeLinecap="round" strokeDasharray={gaugeDash} />
              <defs>
                <linearGradient id="gg" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#e45153" />
                  <stop offset="100%" stopColor="#fcd34d" />
                </linearGradient>
              </defs>
              <line x1="100" y1="105" x2={needleX} y2={needleY} stroke="#1f1f1f" strokeWidth="4" strokeLinecap="round" />
              <circle cx="100" cy="105" r="7" fill="#1f1f1f" />
              <text x="100" y="92" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1f1f1f" fontFamily="Poppins,sans-serif">{savingPct}%</text>
              <text x="14" y="118" fontSize="9" fill="#9ca3af" fontFamily="Poppins,sans-serif">0%</text>
              <text x="182" y="118" fontSize="9" fill="#9ca3af" textAnchor="end" fontFamily="Poppins,sans-serif">100%</text>
            </svg>
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700 }}>Rasio menabungmu</div>
              <div style={{ color: '#6b7280' }}>
                {savingPct >= 20 ? 'Di atas rata-rata pengguna (25%) 🎉' : 'Perlu ditingkatkan bulan depan 💪'}
              </div>
              <div style={{ color: '#6b7280' }}>
                Ideal: <b style={{ color: '#1f1f1f' }}>≥ 20%</b> — {savingPct >= 20 ? 'kamu aman!' : 'ayo berhemat!'}
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="fact"><div className="ic" style={{ background: '#fef2f2' }}>📆</div><div><div className="tx">Rata-rata belanja harian</div><div className="vl">{formatIdr(report.funFacts.rataRataHarian)}</div></div></div>
            <div className="fact"><div className="ic" style={{ background: '#fffbeb' }}>🛒</div><div><div className="tx">Hari terboros</div><div className="vl">{report.funFacts.hariTerboros.hari} • {formatShortNominal(report.funFacts.hariTerboros.total)}</div></div></div>
            <div className="fact"><div className="ic" style={{ background: '#ecfdf5' }}>🌱</div><div><div className="tx">Kategori paling hemat</div><div className="vl">{report.funFacts.kategoriTerhemat.nama} • {formatShortNominal(report.funFacts.kategoriTerhemat.total)}</div></div></div>
          </div>
        </div>

        {/* Sec 2: Komposisi & Tren Pengeluaran */}
        <h3 className="sec"><span className="n">2</span> Komposisi &amp; Tren Pengeluaran</h3>
        <div className="grid2">
          <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="140" height="140" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="70" fill="none" stroke="#f1f5f9" strokeWidth="26" />
              {(() => {
                let currentOffset = 0;
                return report.byCategory.slice(0, 5).map((cat, idx) => {
                  const strokeLen = (cat.persen / 100) * 439.8;
                  const dash = `${strokeLen} 439.8`;
                  const offset = -currentOffset;
                  currentOffset += strokeLen;
                  return (
                    <circle
                      key={idx}
                      cx="90"
                      cy="90"
                      r="70"
                      fill="none"
                      stroke={CAT_COLORS[idx % CAT_COLORS.length]}
                      strokeWidth="26"
                      strokeDasharray={dash}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      transform="rotate(-90 90 90)"
                    />
                  );
                });
              })()}
              <text x="90" y="86" textAnchor="middle" fontSize="17" fontWeight="800" fill="#1f1f1f" fontFamily="Poppins,sans-serif">
                {formatShortNominal(report.summary.totalPengeluaran)}
              </text>
              <text x="90" y="104" textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="Poppins,sans-serif">
                total bulan ini
              </text>
            </svg>
            <div className="legend">
              {report.byCategory.slice(0, 5).map((cat, idx) => (
                <div key={idx} className="row">
                  <span className="dot" style={{ background: CAT_COLORS[idx % CAT_COLORS.length] }} />
                  <span className="nm">{cat.nama}</span>
                  <span className="pc">{cat.persen}%</span>
                  <span className="vl">{formatShortNominal(cat.total)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-t">Tren 4 minggu terakhir</div>
            <svg width="100%" height="100" viewBox="0 0 300 110" preserveAspectRatio="none">
              <defs>
                <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e45153" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#e45153" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={polygonStr} fill="url(#ag)" />
              <polyline points={polylineStr} fill="none" stroke="#e45153" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {wtPts.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={i === 3 ? 5.5 : 4.5}
                  fill={i === 3 ? '#e45153' : '#fff'}
                  stroke="#e45153"
                  strokeWidth="3"
                />
              ))}
            </svg>
            <div className="trend-lbl">
              <span>Mg 1<br /><b>{formatShortNominal(report.weeklyTrend[0])}</b></span>
              <span>Mg 2<br /><b>{formatShortNominal(report.weeklyTrend[1])}</b></span>
              <span>Mg 3<br /><b>{formatShortNominal(report.weeklyTrend[2])}</b></span>
              <span>Mg 4<br /><b>{formatShortNominal(report.weeklyTrend[3])}</b></span>
            </div>
          </div>
        </div>
        {/* Sec 3: Peta Aktivitas Harian */}
        <h3 className="sec"><span className="n">3</span> Peta Aktivitas Harian</h3>
        <div className="panel">
          <div className="hm">
            <div className="hm-grid">
              {Array.from({ length: startDayOfWeek }, (_, i) => (
                <div key={`empty-${i}`} className="hm-cell hm-empty" />
              ))}
              {Array.from({ length: report.daysInMonth }, (_, i) => i + 1).map((day) => {
                const spend = dailyExpenses.get(day) || 0;
                let bg = 'transparent';
                if (spend > 0) {
                  const ratio = spend / maxDailySpend;
                  if (ratio <= 0.2) bg = '#fee2e2';
                  else if (ratio <= 0.4) bg = '#fecaca';
                  else if (ratio <= 0.6) bg = '#fca5a5';
                  else if (ratio <= 0.8) bg = '#f87171';
                  else bg = '#e45153';
                }
                return (
                  <div
                    key={day}
                    className="hm-cell"
                    style={{ background: bg }}
                    title={`Tgl ${day}: ${spend > 0 ? formatIdr(spend) : 'Tidak ada belanja'}`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
            <div className="hm-side">
              <div className="big">🔥 {report.streak || dailyExpenses.size} hari streak!</div>
              <div style={{ color: '#6b7280', marginTop: 4 }}>
                Warna makin pekat = belanja makin besar hari itu. Kotak kosong = nggak ada transaksi tercatat.
              </div>
              <div className="hm-scale">
                <span>Sepi</span>
                <i style={{ background: '#fee2e2' }} />
                <i style={{ background: '#fecaca' }} />
                <i style={{ background: '#fca5a5' }} />
                <i style={{ background: '#f87171' }} />
                <i style={{ background: '#e45153' }} />
                <span>Ramai</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sec 4: Insight Pocky */}
        <h3 className="sec"><span className="n">4</span> Insight Pocky</h3>
        <div className="insight">
          <div className="mascot">🪙</div>
          <div>{report.insight}</div>
        </div>

        {/* Sec 5: Bulan Ini vs Prev */}
        <h3 className="sec"><span className="n">5</span> Bulan Ini vs {prevPeriodLabel}</h3>
        <div className="panel">
          {report.comparison.map((cmp, i) => {
            const isUp = cmp.persenPerubahan > 0;
            const deltaClass = isUp ? 'delta-up' : 'delta-dn';
            const deltaSymbol = isUp ? '▲ +' : '▼ ';
            const maxVal = Math.max(cmp.bulanLalu, cmp.bulanIni, 1);
            const w1 = Math.round((cmp.bulanLalu / maxVal) * 100);
            const w2 = Math.round((cmp.bulanIni / maxVal) * 100);
            const icon = i === 0 ? '💸 ' : (i === 1 ? '🍔 ' : '🚗 ');
            return (
              <div key={i} className="cmp-row">
                <div className="top">
                  <b>{icon}{cmp.nama}</b>
                  <span>
                    <span className={deltaClass}>{deltaSymbol}{cmp.persenPerubahan}%</span>
                    &nbsp; {formatShortNominal(cmp.bulanLalu)} → <b>{formatShortNominal(cmp.bulanIni)}</b>
                  </span>
                </div>
                <div className="cmp-bars">
                  <div className="b1" style={{ width: `${w1}%` }} />
                  <div className="b2" style={{ width: `${w2}%` }} />
                </div>
              </div>
            );
          })}
          <div className="cmp-leg">
            <span><i style={{ display: 'inline-block', width: 14, height: 8, borderRadius: 4, background: '#e5e7eb', marginRight: 4 }} /> {prevPeriodLabel}</span>
            <span><i style={{ display: 'inline-block', width: 14, height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#e45153,#f59e0b)', marginRight: 4 }} /> {periodLabel}</span>
          </div>
        </div>

        {/* Sec 6: Transaksi Terbesar */}
        <h3 className="sec"><span className="n">6</span> Transaksi Terbesar</h3>
        <div className="panel" style={{ padding: '4px 14px' }}>
          {report.topTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 12, color: '#9ca3af', fontSize: 11 }}>Belum ada transaksi di bulan ini.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Keterangan</th>
                  <th>Kategori</th>
                  <th className="r">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {report.topTransactions.map((tx, idx) => (
                  <tr key={idx}>
                    <td>{formatShortDate(tx.tanggal)}</td>
                    <td>{tx.keterangan}</td>
                    <td><span className="cat-pill">{tx.kategori}</span></td>
                    <td className="r"><b>{formatIdr(tx.nominal)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Sec 7: Target Tabungan */}
        <h3 className="sec"><span className="n">7</span> Target Tabungan</h3>
        <div className="goals">
          {report.goals.length === 0 ? (
            <div className="goal" style={{ textAlign: 'center', color: '#9ca3af', fontSize: 11 }}>
              Belum ada target tabungan aktif.
            </div>
          ) : (
            report.goals.slice(0, 3).map((g, i) => (
              <div key={i} className="goal">
                <div className="gname">{g.nama}</div>
                <div className="pct">{formatShortNominal(g.terkumpul)} / {formatShortNominal(g.target)} • <b>{g.persen}%</b></div>
                <div className="track">
                  <div className="fill" style={{ width: `${Math.min(100, g.persen)}%` }} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sec 8: Pencapaian Bulan Ini */}
        <h3 className="sec"><span className="n">8</span> Pencapaian Bulan Ini</h3>
        <div className="badges">
          {report.badges.map((b, i) => (
            <div key={i} className="badge">
              <div className="e">{b.icon}</div>
              <div className="t">{b.text}</div>
              <div className="s">{b.sub}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="footer">
          <div className="fbrand">🪙 Pocketplan</div>
          <span>Dibuat otomatis • pocketplan-rul.vercel.app</span>
        </div>
      </div>
    </div>
  );
};

export default LaporanPage;

