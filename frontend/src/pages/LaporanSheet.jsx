import pocketLogo from '../assets/pocket-logo.svg';

const CAT_COLORS = ['#e45153', '#f59e0b', '#8b5cf6', '#3b82f6', '#94a3b8', '#10b981'];

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

const LaporanSheet = ({ report, monthLabel, prevMonthLabel, userName = 'User' }) => {
  if (!report) return null;

  const rasio = Math.min(100, Math.max(0, report.summary?.rasioMenabung || 0));
  const gaugeAngle = (rasio / 100) * 180;
  const rad = ((180 - gaugeAngle) * Math.PI) / 180;
  const needleX = 100 + 58 * Math.cos(rad);
  const needleY = 95 - 58 * Math.sin(rad);

  const wt = report.weeklyTrend || [0, 0, 0, 0];
  const maxWeekly = Math.max(...wt, 1);
  const pts = wt.map((v, i) => {
    const x = 30 + i * 72;
    const y = 92 - Math.round((v / maxWeekly) * 65);
    return { x, y, val: v };
  });
  const polylineStr = pts.map((p) => `${p.x},${p.y}`).join(' ');

  const [reportYear, reportMonth] = (report.month || '').split('-').map(Number);
  const startDayOfWeek = !isNaN(reportYear) && !isNaN(reportMonth)
    ? new Date(Date.UTC(reportYear, reportMonth - 1, 1)).getUTCDay()
    : 0;

  const dailyExpenses = new Map();
  let maxDailySpend = 1;
  (report.topTransactions || []).forEach((tx) => {
    const d = parseInt((tx.tanggal || tx.date || '').slice(8, 10), 10);
    const amt = Number(tx.nominal || tx.amount) || 0;
    if (d >= 1 && d <= 31) {
      const current = dailyExpenses.get(d) || 0;
      const total = current + amt;
      dailyExpenses.set(d, total);
      if (total > maxDailySpend) maxDailySpend = total;
    }
  });

  let donutAcc = 0;
  const donutSegments = (report.byCategory || []).slice(0, 5).map((cat, idx) => {
    const start = donutAcc;
    donutAcc += cat.persen;
    const end = donutAcc;
    const color = CAT_COLORS[idx % CAT_COLORS.length];
    return `${color} ${start}% ${end}%`;
  });
  if (donutAcc < 100 && report.byCategory?.length > 0) {
    donutSegments.push(`#e5e7eb ${donutAcc}% 100%`);
  }
  const donutGradient = donutSegments.length > 0
    ? `conic-gradient(${donutSegments.join(', ')})`
    : 'conic-gradient(#e5e7eb 0% 100%)';

  return (
    <div className="laporan-sheet">
      <div className="laporan-strip" />

      {/* Header */}
      <div className="laporan-header">
        <div className="laporan-brand">
          <img src={pocketLogo} alt="Pocketplan" className="laporan-logo" />
          <div className="laporan-word">
            Pocket<span>plan</span>
          </div>
        </div>
        <div className="laporan-period">
          <div className="laporan-kicker">MONTHLY REPORT</div>
          <h2>{monthLabel}</h2>
          <p>Prepared for <b>{userName}</b></p>
        </div>
      </div>

      {/* Hero Description */}
      <div className="laporan-hero">
        Your monthly financial performance summary — income, expenses, savings rate, and spending habits.
      </div>

      {/* 3 Summary Cards */}
      <div className="laporan-cards">
        <div className="laporan-card laporan-c-in">
          <small>Total Income</small>
          <div className="num">{formatIdr(report.summary?.totalPemasukan)}</div>
          <div className="sub">{report.summary?.jumlahTransaksiIn ?? report.summary?.jumlahTransaksi ?? 0} transactions</div>
        </div>
        <div className="laporan-card laporan-c-out">
          <small>Total Expenses</small>
          <div className="num">{formatIdr(report.summary?.totalPengeluaran)}</div>
          <div className="sub">{report.summary?.jumlahTransaksiOut ?? report.summary?.jumlahTransaksi ?? 0} transactions</div>
        </div>
        <div className="laporan-card laporan-c-ok">
          <small>Net Surplus / Deficit</small>
          <div className="num">{formatIdr(report.summary?.surplus)}</div>
          <div className="sub">Savings rate {report.summary?.rasioMenabung ?? 0}%</div>
        </div>
      </div>
      {/* Sec 1: Savings Rate & Fun Facts */}
      <h3 className="laporan-sec"><span className="n">1</span> Savings Rate &amp; Fun Facts</h3>
      <div className="laporan-grid2">
        <div className="laporan-panel" style={{ textAlign: 'center' }}>
          <div className="laporan-panel-t">Monthly Savings Rate</div>
          <svg viewBox="0 0 200 120" style={{ width: 175, height: 105, margin: '0 auto', display: 'block' }}>
            <path d="M 25 95 A 75 75 0 0 1 175 95" fill="none" stroke="#fee2e2" strokeWidth="18" strokeLinecap="round" />
            <path
              d="M 25 95 A 75 75 0 0 1 175 95"
              fill="none"
              stroke="url(#lpG1)"
              strokeWidth="18"
              strokeDasharray="235.6"
              strokeDashoffset={235.6 * (1 - rasio / 100)}
              strokeLinecap="round"
            />
            <line x1="100" y1="95" x2={needleX} y2={needleY} stroke="#1f1f1f" strokeWidth="3" strokeLinecap="round" />
            <circle cx="100" cy="95" r="5" fill="#1f1f1f" />
            <defs>
              <linearGradient id="lpG1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#e45153" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
          </svg>
          <div style={{ fontSize: 21, fontWeight: 800, marginTop: -4 }}>{rasio}%</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Healthy target: <b>&ge; 20%</b> of income</div>
        </div>

        <div className="laporan-panel">
          <div className="laporan-panel-t">Your Financial Facts</div>
          <div className="laporan-fact">
            <div className="ico">📅</div>
            <div>
              <div className="flabel">Daily Average Spend</div>
              <div className="fval">{formatIdr(report.funFacts?.rataRataHarian)} / day</div>
            </div>
          </div>
          <div className="laporan-fact">
            <div className="ico">⚡</div>
            <div>
              <div className="flabel">Peak Spending Day</div>
              <div className="fval">
                {report.funFacts?.hariTerboros?.hari || '-'} ({formatShortNominal(report.funFacts?.hariTerboros?.total || 0)})
              </div>
            </div>
          </div>
          <div className="laporan-fact">
            <div className="ico">🌱</div>
            <div>
              <div className="flabel">Most Frugal Category</div>
              <div className="fval">
                {report.funFacts?.kategoriTerhemat?.nama || '-'} ({formatShortNominal(report.funFacts?.kategoriTerhemat?.total || 0)})
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sec 2: Expense Composition & Trend */}
      <h3 className="laporan-sec"><span className="n">2</span> Expense Composition &amp; Trend</h3>
      <div className="laporan-grid2">
        <div className="laporan-panel">
          <div className="laporan-panel-t">Expense Categories</div>
          <div className="laporan-donut-wrap">
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                background: donutGradient,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column'
                }}
              >
                <div style={{ fontSize: 8, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</div>
                <div style={{ fontSize: 10, fontWeight: 800 }}>{formatShortNominal(report.summary?.totalPengeluaran)}</div>
              </div>
            </div>

            <div className="laporan-donut-list">
              {(report.byCategory || []).slice(0, 4).map((c, i) => (
                <div key={i} className="laporan-donut-item">
                  <span>
                    <span className="laporan-donut-dot" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                    <b>{c.nama}</b>
                  </span>
                  <span style={{ color: '#6b7280' }}>
                    {c.persen}% • {formatShortNominal(c.total)}
                  </span>
                </div>
              ))}
              {(!report.byCategory || report.byCategory.length === 0) && (
                <div style={{ fontSize: 11, color: '#9ca3af' }}>No expenses recorded yet</div>
              )}
            </div>
          </div>
        </div>

        <div className="laporan-panel">
          <div className="laporan-panel-t">Weekly Trend (Wk 1 - 4)</div>
          <svg viewBox="0 0 270 115" style={{ width: '100%', height: 90 }}>
            <line x1="20" y1="92" x2="255" y2="92" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="20" y1="58" x2="255" y2="58" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="20" y1="24" x2="255" y2="24" stroke="#f1f5f9" strokeWidth="1" />
            <polyline fill="none" stroke="#e45153" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={polylineStr} />
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#e45153" strokeWidth="2.5" />
                <text x={p.x} y={Math.max(14, p.y - 7)} fontSize="8.5" fontWeight="700" textAnchor="middle" fill="#1f1f1f">
                  {formatShortNominal(p.val)}
                </text>
                <text x={p.x} y="106" fontSize="9" fill="#9ca3af" textAnchor="middle">
                  Wk {i + 1}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Sec 3: Daily Activity Map */}
      <h3 className="laporan-sec"><span className="n">3</span> Daily Activity Map</h3>
      <div className="laporan-panel">
        <div className="laporan-hm">
          <div className="laporan-hm-grid">
            {Array.from({ length: startDayOfWeek }, (_, i) => (
              <div key={`empty-${i}`} className="laporan-hm-cell hm-empty" />
            ))}
            {Array.from({ length: report.daysInMonth || 30 }, (_, i) => i + 1).map((day) => {
              const spend = dailyExpenses.get(day) || 0;
              let bg = '#f9fafb';
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
                  className="laporan-hm-cell"
                  style={{ background: bg }}
                  title={`Day ${day}: ${spend > 0 ? formatIdr(spend) : 'No spending recorded'}`}
                >
                  {day}
                </div>
              );
            })}
          </div>
          <div className="laporan-hm-side">
            <div className="big">🔥 {report.streak || 23} day streak!</div>
            <div style={{ color: '#6b7280', marginTop: 4 }}>
              Darker shades indicate higher spending. Empty blocks indicate no spending recorded.
            </div>
            <div className="laporan-hm-scale">
              <span>Low</span>
              <i style={{ background: '#fee2e2' }} />
              <i style={{ background: '#fecaca' }} />
              <i style={{ background: '#fca5a5' }} />
              <i style={{ background: '#f87171' }} />
              <i style={{ background: '#e45153' }} />
              <span>High</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sec 4: Pocky's Insights */}
      <h3 className="laporan-sec"><span className="n">4</span> Pocky&apos;s Insights</h3>
      <div className="laporan-insight">
        <div className="mascot"><img src={pocketLogo} alt="Pocky" style={{ width: 34, height: 34, objectFit: 'contain', display: 'block' }} /></div>
        <div>{report.insight}</div>
      </div>

      {/* Sec 5: This Month vs Prev */}
      <h3 className="laporan-sec"><span className="n">5</span> This Month vs {prevMonthLabel}</h3>
      <div className="laporan-panel">
        {(report.comparison || []).map((cmp, i) => {
          const isUp = cmp.persenPerubahan > 0;
          const deltaClass = isUp ? 'delta-up' : 'delta-dn';
          const deltaSymbol = isUp ? '▲ +' : '▼ ';
          const maxVal = Math.max(cmp.bulanLalu, cmp.bulanIni, 1);
          const w1 = Math.round((cmp.bulanLalu / maxVal) * 100);
          const w2 = Math.round((cmp.bulanIni / maxVal) * 100);
          const icon = i === 0 ? '💸 ' : (i === 1 ? '🍔 ' : '🚗 ');
          return (
            <div key={i} className="laporan-cmp-row">
              <div className="top">
                <b>{icon}{cmp.nama}</b>
                <span>
                  <span className={deltaClass}>{deltaSymbol}{cmp.persenPerubahan}%</span>
                  &nbsp; {formatShortNominal(cmp.bulanLalu)} → <b>{formatShortNominal(cmp.bulanIni)}</b>
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
          <span><i style={{ display: 'inline-block', width: 14, height: 8, borderRadius: 4, background: '#e5e7eb', marginRight: 4 }} /> {prevMonthLabel}</span>
          <span><i style={{ display: 'inline-block', width: 14, height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#e45153,#f59e0b)', marginRight: 4 }} /> {monthLabel}</span>
        </div>
      </div>

      {/* Sec 6: Top Transactions */}
      <h3 className="laporan-sec"><span className="n">6</span> Top Transactions</h3>
      <div className="laporan-panel" style={{ padding: '4px 14px' }}>
        {(!report.topTransactions || report.topTransactions.length === 0) ? (
          <div style={{ textAlign: 'center', padding: 12, color: '#9ca3af', fontSize: 11 }}>No transactions recorded this month.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {report.topTransactions.map((tx, idx) => (
                <tr key={idx}>
                  <td>{formatShortDate(tx.tanggal || tx.date)}</td>
                  <td>{tx.keterangan || tx.title || '-'}</td>
                  <td><span className="laporan-cat-pill">{tx.kategori || tx.category || 'General'}</span></td>
                  <td className="r"><b>{formatIdr(tx.nominal || tx.amount)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sec 7: Savings Goals */}
      <h3 className="laporan-sec"><span className="n">7</span> Savings Goals</h3>
      <div className="laporan-goals">
        {(!report.goals || report.goals.length === 0) ? (
          <div className="laporan-goal" style={{ textAlign: 'center', color: '#9ca3af', fontSize: 11 }}>
            No active savings goals yet.
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

      {/* Sec 8: Monthly Achievements */}
      <h3 className="laporan-sec"><span className="n">8</span> Monthly Achievements</h3>
      <div className="laporan-badges">
        {(report.badges || []).map((b, i) => (
          <div key={i} className="laporan-badge">
            <div className="e">{b.icon}</div>
            <div className="t">{b.text}</div>
            <div className="s">{b.sub}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="laporan-footer">
        <div className="fbrand"><img src={pocketLogo} alt="" style={{ width: 18, height: 18, objectFit: 'contain', display: 'block' }} /> Pocketplan</div>
        <span className="laporan-footer-url">
          <span className="footer-auto-text">Generated automatically</span>
          <span className="footer-sep">•</span>
          <span className="footer-link-text">pocketplan.ai.id</span>
        </span>
      </div>
    </div>
  );
};

export default LaporanSheet;