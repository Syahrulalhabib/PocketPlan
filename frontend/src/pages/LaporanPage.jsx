import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useData } from '../providers/DataProvider.jsx';
import { getAuthToken } from '../services/firebase.js';

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
    const topNom = top ? formatIdr(top.total) : 'Rp 0';
    if (persenPerubahan > 0) insight = `Pengeluaran naik ${persenPerubahan}% vs bulan lalu, didorong oleh ${top?.nama || 'belanja'} (${topNom}). Jaga budget bulan depan!`;
    else if (persenPerubahan < 0) insight = `Keren! Pengeluaranmu hemat ${Math.abs(persenPerubahan)}% dibanding bulan lalu. Pertahankan!`;
    else insight = `Pengeluaran bulan ini stabil. Pos terbesar adalah ${top?.nama || 'belanja'} (${topNom}).`;
  }

  const badges = [
    { type: 'streak', icon: '🔥', text: '7 hari', sub: 'streak aktif' },
    { type: 'tx', icon: '📊', text: `${jumlahTransaksi}`, sub: 'transaksi' },
    { type: 'budget', icon: '💰', text: '3/4', sub: 'budget terjaga' },
    { type: 'goal', icon: '🎯', text: `${goalsList.filter((g) => g.persen >= 100).length}`, sub: 'target tercapai' }
  ];

  return {
    month: monthStr,
    prevMonth: prevMonthStr,
    daysInMonth,
    summary: { totalPemasukan, totalPengeluaran, surplus, rasioMenabung, jumlahTransaksi, persenPerubahan },
    byCategory,
    weeklyTrend,
    topTransactions,
    comparison,
    goals: goalsList,
    budgets: { total: 4, terjaga: 3 },
    streak: 7,
    funFacts: { rataRataHarian, hariTerboros, kategoriTerhemat },
    insight,
    badges
  };
}

const CAT_COLORS = ['#e45153', '#f59e0b', '#8b5cf6', '#3b82f6', '#10b981', '#94a3b8'];

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
  const needleX = 100 + 70 * Math.cos(rad);
  const needleY = 105 - 70 * Math.sin(rad);
  const gaugeDash = `${(savingPct / 100) * 251.3} 251.3`;

  // Weekly Trend points
  const maxWeekly = Math.max(...report.weeklyTrend, 1);
  const wtPts = report.weeklyTrend.map((v, i) => {
    const x = 15 + i * 90;
    const y = 95 - (v / maxWeekly) * 65;
    return { x, y };
  });
  const polylineStr = wtPts.map((p) => `${p.x},${p.y}`).join(' ');
  const polygonStr = `${wtPts[0].x},${wtPts[0].y} ${polylineStr} ${wtPts[3].x},105 ${wtPts[0].x},105`;

  // Daily map for heatmap
  const currTx = useMemo(() => {
    return transactions.filter((t) => typeof t.date === 'string' && t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const dailyMap = useMemo(() => {
    const m = new Map();
    for (const t of currTx) {
      const d = parseInt((t.date || '').slice(8, 10), 10);
      m.set(d, (m.get(d) || 0) + 1);
    }
    return m;
  }, [currTx]);
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
      <div className="laporan-sheet">
        <div className="laporan-strip" />

        {/* Header */}
        <div className="laporan-header">
          <div className="laporan-brand">
            <img src="/pocket-logo.svg" alt="Pocketplan logo" className="laporan-brand-logo" />
            <div className="word">Pocket<span>plan</span></div>
          </div>
          <div className="laporan-period">
            <div className="kicker">Laporan Bulanan</div>
            <h2>{periodLabel}</h2>
            <p>{user?.name || 'Pengguna'}</p>
          </div>
        </div>

        {/* Hero */}
        <p className="laporan-hero">
          Hai <b>{firstName}</b>! Ini rangkuman keuanganmu 1–{report.daysInMonth} {periodLabel}. Pocky yang hitungin, kamu yang tinggal baca ✨
        </p>

        {/* Summary Cards */}
        <div className="laporan-cards">
          <div className="laporan-card c-in">
            <small>💰 Pemasukan</small>
            <div className="num">{formatIdr(report.summary.totalPemasukan)}</div>
            <div className="sub">{report.summary.jumlahTransaksi} transaksi tercatat</div>
          </div>
          <div className="laporan-card c-out">
            <small>💸 Pengeluaran</small>
            <div className="num">{formatIdr(report.summary.totalPengeluaran)}</div>
            <div className="sub">
              {report.summary.persenPerubahan !== 0
                ? `${report.summary.persenPerubahan > 0 ? 'naik' : 'turun'} ${Math.abs(report.summary.persenPerubahan)}% vs bulan lalu`
                : 'stabil vs bulan lalu'}
            </div>
          </div>
          <div className="laporan-card c-ok">
            <small>✨ Surplus Tabungan</small>
            <div className="num">{formatIdr(report.summary.surplus)}</div>
            <div className="sub">{report.summary.rasioMenabung}% dari total pemasukan</div>
          </div>
        </div>
        {/* Sec 1: Rasio Menabung & Fakta Seru */}
        <h3 className="laporan-sec"><span className="n">1</span> Rasio Menabung &amp; Fakta Seru</h3>
        <div className="laporan-grid2">
          <div className="laporan-panel" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="140" height="95" viewBox="0 0 200 120">
              <path d="M 20 105 A 80 80 0 0 1 180 105" fill="none" stroke="#f1f5f9" strokeWidth="20" strokeLinecap="round" />
              <path d="M 20 105 A 80 80 0 0 1 180 105" fill="none" stroke="url(#ggr)" strokeWidth="20" strokeLinecap="round" strokeDasharray={gaugeDash} />
              <defs>
                <linearGradient id="ggr" x1="0" y1="0" x2="1" y2="0">
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
            <div style={{ fontSize: 11.5, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700 }}>Rasio menabungmu</div>
              <div style={{ color: '#6b7280' }}>
                {savingPct >= 20 ? 'Di atas rata-rata (≥ 20%) 🎉' : 'Bisa ditingkatkan lagi! 💪'}
              </div>
              <div style={{ color: '#6b7280' }}>Status: <b style={{ color: '#1f1f1f' }}>{savingPct >= 20 ? 'Aman & Sehat' : 'Perlu Dihemat'}</b></div>
            </div>
          </div>
          <div className="laporan-panel">
            <div className="laporan-fact">
              <div className="ic" style={{ background: '#fef2f2' }}>📆</div>
              <div>
                <div className="tx">Rata-rata belanja harian</div>
                <div className="vl">{formatIdr(report.funFacts.rataRataHarian)}</div>
              </div>
            </div>
            <div className="laporan-fact">
              <div className="ic" style={{ background: '#fffbeb' }}>🛒</div>
              <div>
                <div className="tx">Hari terboros</div>
                <div className="vl">{report.funFacts.hariTerboros.hari} • {formatShortNominal(report.funFacts.hariTerboros.total)}</div>
              </div>
            </div>
            <div className="laporan-fact">
              <div className="ic" style={{ background: '#ecfdf5' }}>🌱</div>
              <div>
                <div className="tx">Kategori paling hemat</div>
                <div className="vl">{report.funFacts.kategoriTerhemat.nama} • {formatShortNominal(report.funFacts.kategoriTerhemat.total)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sec 2: Komposisi & Tren Pengeluaran */}
        <h3 className="laporan-sec"><span className="n">2</span> Komposisi &amp; Tren Pengeluaran</h3>
        <div className="laporan-grid2">
          <div className="laporan-panel" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="130" height="130" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="70" fill="none" stroke="#f1f5f9" strokeWidth="26" />
              {(() => {
                let currentOffset = 0;
                return report.byCategory.map((cat, idx) => {
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
              <text x="90" y="86" textAnchor="middle" fontSize="16" fontWeight="800" fill="#1f1f1f" fontFamily="Poppins,sans-serif">
                {formatShortNominal(report.summary.totalPengeluaran)}
              </text>
              <text x="90" y="102" textAnchor="middle" fontSize="9.5" fill="#6b7280" fontFamily="Poppins,sans-serif">
                total belanja
              </text>
            </svg>
            <div className="laporan-legend">
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
          <div className="laporan-panel">
            <div className="laporan-panel-t">Tren 4 Pekan Terakhir</div>
            <svg width="100%" height="90" viewBox="0 0 300 110" preserveAspectRatio="none">
              <defs>
                <linearGradient id="wag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e45153" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#e45153" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={polygonStr} fill="url(#wag)" />
              <polyline points={polylineStr} fill="none" stroke="#e45153" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {wtPts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="4.5" fill="#fff" stroke="#e45153" strokeWidth="3" />
              ))}
              <text x="15" y="108" fontSize="9" fill="#9ca3af" fontFamily="Poppins,sans-serif">W1</text>
              <text x="105" y="108" fontSize="9" fill="#9ca3af" fontFamily="Poppins,sans-serif">W2</text>
              <text x="195" y="108" fontSize="9" fill="#9ca3af" fontFamily="Poppins,sans-serif">W3</text>
              <text x="285" y="108" fontSize="9" fill="#9ca3af" textAnchor="end" fontFamily="Poppins,sans-serif">W4</text>
            </svg>
          </div>
        </div>
        {/* Sec 3: Peta Aktivitas Harian */}
        <h3 className="laporan-sec"><span className="n">3</span> Peta Aktivitas Harian</h3>
        <div className="laporan-panel laporan-heatmap">
          <div className="laporan-hm-grid">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
              const count = dailyMap.get(day) || 0;
              let cls = '';
              if (count >= 3) cls = 'active-3';
              else if (count === 2) cls = 'active-2';
              else if (count === 1) cls = 'active-1';
              return (
                <div key={day} className={`laporan-hm-cell ${cls}`} title={`Tgl ${day}: ${count} transaksi`}>
                  {day}
                </div>
              );
            })}
          </div>
          <div className="laporan-hm-side">
            <div className="big">{dailyMap.size} hari aktif</div>
            <div style={{ color: '#6b7280', marginTop: 2 }}>dari {report.daysInMonth} hari bulan ini</div>
            <div className="laporan-hm-scale">
              <span>Jarang</span>
              <i style={{ background: '#f3f4f6' }} />
              <i style={{ background: '#fee2e2' }} />
              <i style={{ background: '#fca5a5' }} />
              <i style={{ background: '#ef4444' }} />
              <span>Sering</span>
            </div>
          </div>
        </div>

        {/* Sec 4: Insight Pocky */}
        <h3 className="laporan-sec"><span className="n">4</span> Catatan &amp; Saran Pocky</h3>
        <div className="laporan-insight">
          <div className="mascot">🪙</div>
          <div>{report.insight}</div>
        </div>
        {/* Sec 5: Perbandingan vs Bulan Lalu */}
        <h3 className="laporan-sec"><span className="n">5</span> Bulan Ini vs {prevPeriodLabel}</h3>
        <div className="laporan-panel">
          {report.comparison.map((cmp, i) => {
            const isUp = cmp.persenPerubahan > 0;
            const deltaClass = isUp ? 'laporan-delta-up' : 'laporan-delta-dn';
            const deltaSymbol = isUp ? '▲ +' : '▼ ';
            const maxVal = Math.max(cmp.bulanLalu, cmp.bulanIni, 1);
            const w1 = Math.round((cmp.bulanLalu / maxVal) * 100);
            const w2 = Math.round((cmp.bulanIni / maxVal) * 100);
            return (
              <div key={i} className="laporan-cmp-row">
                <div className="top">
                  <b>{i === 0 ? '💸 ' : '📌 '}{cmp.nama}</b>
                  <span>
                    <span className={deltaClass}>{deltaSymbol}{cmp.persenPerubahan}%</span>
                    &nbsp;&nbsp;{formatShortNominal(cmp.bulanLalu)} → <b>{formatShortNominal(cmp.bulanIni)}</b>
                  </span>
                </div>
                <div className="laporan-cmp-bars">
                  <div className="b1" style={{ width: `${w1}%` }} />
                  <div className="b2" style={{ width: `${w2}%` }} />
                </div>
              </div>
            );
          })}
          <div className="laporan-cmp-leg">
            <span><i style={{ display: 'inline-block', width: 12, height: 7, borderRadius: 4, background: '#e5e7eb', marginRight: 4 }} /> {prevPeriodLabel}</span>
            <span><i style={{ display: 'inline-block', width: 12, height: 7, borderRadius: 4, background: 'linear-gradient(90deg,#e45153,#f59e0b)', marginRight: 4 }} /> {periodLabel}</span>
          </div>
        </div>

        {/* Sec 6: Transaksi Terbesar */}
        <h3 className="laporan-sec"><span className="n">6</span> Transaksi Terbesar</h3>
        <div className="laporan-panel" style={{ padding: '6px 14px' }}>
          {report.topTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 12, color: '#9ca3af', fontSize: 11 }}>Belum ada transaksi di bulan ini.</div>
          ) : (
            <table className="laporan-table">
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
                    <td>{tx.tanggal}</td>
                    <td>{tx.keterangan}</td>
                    <td><span className="laporan-cat-pill">{tx.kategori}</span></td>
                    <td className="r"><b>{formatIdr(tx.nominal)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {/* Sec 7: Target Tabungan */}
        <h3 className="laporan-sec"><span className="n">7</span> Target Tabungan</h3>
        <div className="laporan-goals">
          {report.goals.length === 0 ? (
            <div className="laporan-goal" style={{ textAlign: 'center', color: '#9ca3af', fontSize: 11 }}>
              Belum ada target tabungan aktif.
            </div>
          ) : (
            report.goals.slice(0, 3).map((g, i) => (
              <div key={i} className="laporan-goal">
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
        <h3 className="laporan-sec"><span className="n">8</span> Pencapaian Bulan Ini</h3>
        <div className="laporan-badges">
          {report.badges.map((b, i) => (
            <div key={i} className="laporan-badge">
              <div className="e">{b.icon}</div>
              <div className="t">{b.text}</div>
              <div className="s">{b.sub}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="laporan-footer">
          <div className="fbrand">🪙 Pocketplan</div>
          <span>Dibuat otomatis • pocketplan-rul.vercel.app</span>
        </div>
      </div>
    </div>
  );
};

export default LaporanPage;

