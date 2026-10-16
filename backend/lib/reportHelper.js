// Monthly Report Aggregation Helper
const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function getPrevMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getDaysInMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

export function getTxMonth(t) {
  if (!t) return '';
  if (t.date && typeof t.date.toDate === 'function') {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(t.date.toDate()).slice(0, 7);
  }
  if (typeof t.date === 'string' && t.date.trim()) {
    const s = t.date.trim();
    if (/^\d{4}[-/]\d{2}/.test(s)) return s.slice(0, 7).replace('/', '-');
    const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}`;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d).slice(0, 7);
  }
  if (t.createdAt) {
    if (typeof t.createdAt.toDate === 'function') {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(t.createdAt.toDate()).slice(0, 7);
    }
    const d = new Date(t.createdAt);
    if (!isNaN(d.getTime())) return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d).slice(0, 7);
  }
  return '';
}

export function buildMonthlyReport({ month, transactions = [], goals = [], budgets = [], userDocData = {} }) {
  const prevMonth = getPrevMonth(month);
  const daysInMonth = getDaysInMonth(month);
  const currTx = transactions.filter((t) => getTxMonth(t) === month);
  const prevTx = transactions.filter((t) => getTxMonth(t) === prevMonth);

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

  const baseBalance = Number(userDocData.baseBalance || 0);
  const allIn = transactions.filter((t) => t.type === 'Income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const allOut = transactions.filter((t) => t.type === 'Expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const currentBal = Math.max(0, baseBalance + allIn - allOut);

  const goalsList = goals.map((g) => {
    const tgt = Number(g.target) || 0;
    const collected = Math.min(tgt, (g.amount !== undefined && Number(g.amount) > currentBal) ? Number(g.amount) : currentBal);
    const pct = tgt > 0 ? Math.max(0, Math.min(100, Math.round((collected / tgt) * 100))) : 0;
    return {
      id: g.id,
      nama: g.name || 'Target',
      terkumpul: collected,
      target: tgt,
      persen: pct
    };
  });

  const budgetList = Array.isArray(budgets) ? budgets : [];
  let budgetTerjaga = 0;
  for (const b of budgetList) {
    if (Number(b.amount) > 0 && (catMap.get(b.category) || 0) <= Number(b.amount)) budgetTerjaga++;
  }

  const streak = Number(userDocData.currentStreak) || 0;
  const rataRataHarian = daysInMonth > 0 ? Math.round(totalPengeluaran / daysInMonth) : 0;

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
    const topNom = top ? `Rp ${top.total.toLocaleString('id-ID')}` : 'Rp 0';
    if (persenPerubahan > 0) insight = `Pengeluaran naik ${persenPerubahan}% vs bulan lalu, didorong oleh ${top?.nama || 'belanja'} (${topNom}). Jaga budget bulan depan!`;
    else if (persenPerubahan < 0) insight = `Keren! Pengeluaran hemat ${Math.abs(persenPerubahan)}% dibanding bulan lalu. Pertahankan!`;
    else insight = `Pengeluaran bulan ini stabil. Pos terbesar adalah ${top?.nama || 'belanja'} (${topNom}).`;
  }

  const badges = [
    { type: 'streak', icon: '🔥', text: `${streak} hari`, sub: 'streak catat' },
    { type: 'tx', icon: '📊', text: `${jumlahTransaksi}`, sub: 'transaksi' },
    { type: 'budget', icon: '💰', text: `${budgetTerjaga}/${budgetList.length || 0}`, sub: 'budget terjaga' },
    { type: 'goal', icon: '🎯', text: `${goalsList.filter((g) => g.persen >= 100).length}`, sub: 'target tercapai' }
  ];

  return {
    month,
    prevMonth,
    daysInMonth,
    summary: { totalPemasukan, totalPengeluaran, surplus, rasioMenabung, jumlahTransaksi, jumlahTransaksiIn: currIn.length, jumlahTransaksiOut: currOut.length, persenPerubahan },
    byCategory,
    weeklyTrend,
    topTransactions,
    comparison,
    goals: goalsList,
    budgets: { total: budgetList.length, terjaga: budgetTerjaga },
    streak,
    funFacts: { rataRataHarian, hariTerboros, kategoriTerhemat },
    insight,
    badges
  };
}
