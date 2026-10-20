import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../providers/ThemeProvider.jsx';
import { SunIcon, MoonIcon } from '../components/Icons.jsx';
import FloatingMascot from '../components/FloatingMascot.jsx';
import pocketLogo from '../assets/pocket-logo.svg';

const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'yourpocketplan_bot';
const telegramUrl = `https://t.me/${botUsername}`;

// ——— SVG trust icons (replaces emoji) ———
const CloudSyncIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
);
const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);
const SparkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.3L12 16.5l-6.2 4.5 2.4-7.3L2 9.2h7.6z" /></svg>
);

// ——— Feature cards: 6 balanced, no duplicate icons ———
const features = [
  { icon: '🤖', title: 'Pocky Telegram Bot', desc: 'Catat pengeluaran semudah kirim chat. Foto struk langsung dibaca AI dan dikelompokkan otomatis.', featured: true, badge: 'Core Feature' },
  { icon: '🎯', title: 'Smart Savings Goals', desc: 'Tetapkan target tabungan — dari dana darurat hingga gadget impian. Progres sinkron real-time dengan saldo.', featured: true, badge: 'Popular' },
  { icon: '💰', title: 'Track Balance & Cashflow', desc: 'Pantau arus kas masuk-keluar harian. Saldo bersih selalu akurat di setiap perangkat.' },
  { icon: '📊', title: 'Monthly Reports & Analytics', desc: 'Visualisasi pengeluaran per kategori, tren mingguan, dan cetak laporan rapi siap dokumen.' },
  { icon: '🔥', title: 'Streaks & Milestones', desc: 'Bangun disiplin finansial lewat streak harian dan koleksi lencana pencapaian.' },
  { icon: '🔗', title: 'Telegram ↔ Web Sync', desc: 'Satu data, dua akses. Catat di Telegram, lihat analitik lengkap di dashboard web — sinkron instan.' },
];

const steps = [
  { step: '1', icon: '💬', title: 'Mulai di Telegram atau Web', desc: 'Buka @yourpocketplan_bot atau langsung ke dashboard web — tanpa instalasi.' },
  { step: '2', icon: '✍️', title: 'Catat Pakai Bahasa Sehari-hari', desc: 'Ketik "kopi 25k", foto struk, atau isi form web — Pocky yang merapikan.' },
  { step: '3', icon: '📈', title: 'Pantau & Cetak Laporan', desc: 'Lihat tren, jaga streak harian, dan ekspor laporan kapan pun dibutuhkan.' },
];

const botCommands = [
  { cmd: '/catat', example: 'nasi padang 32000', reply: '✅ Pengeluaran Rp 32.000 (Makanan) tercatat.\nSaldo diperbarui otomatis.' },
  { cmd: '/saldo', example: '', reply: '💰 Saldo: Rp 3.250.000\n📥 Masuk: Rp 5.000.000 | 📤 Keluar: Rp 1.750.000' },
  { cmd: '/budget', example: '', reply: '🍽️ Makan: Rp 850rb / Rp 1,5jt (56%)\nStatus: Aman ✅' },
  { cmd: '/streak', example: '', reply: '🔥 Streak: 7 hari berturut-turut\nRekor terbaik: 14 hari ✨' },
  { cmd: '/goal', example: '', reply: '🎯 "Dana Darurat": Rp 5jt / Rp 10jt (50%)\nSemangat, setengah jalan!' },
];

const faqs = [
  { q: 'Apakah Pocketplan gratis?', a: 'Ya, semua fitur — bot Telegram dan dashboard web — gratis tanpa biaya.' },
  { q: 'Wajib buat akun web?', a: 'Tidak. Cukup pakai Telegram untuk mencatat. Akun web opsional untuk melihat grafik dan cetak laporan.' },
  { q: 'Data keuangan aman?', a: 'Data privat, hanya bisa diakses akun Anda. Penautan Telegram–web pakai kode sekali pakai.' },
  { q: 'Bisa tanpa Telegram?', a: 'Bisa. Daftar langsung di web dan kelola transaksi, anggaran, serta target tabungan dari dashboard.' },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [openFaq, setOpenFaq] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCmd, setActiveCmd] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const observerRef = useRef(null);

  const toggleFaq = (i) => setOpenFaq((p) => (p === i ? null : i));

  useEffect(() => {
    document.title = 'Pocketplan — Catat Pengeluaran Tanpa Ribet, Cukup Chat Pocky';
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute('content', 'Pocketplan: catat keuangan lewat chat Telegram Pocky, kelola saldo, capai target tabungan, dan ekspor laporan PDF.');
  }, []);

  useEffect(() => {
    const onScroll = () => { if (window.scrollY > 120) setShowScrollHint(false); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const secs = document.querySelectorAll('.landing-section');
    if ('IntersectionObserver' in window) {
      observerRef.current = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('is-visible'); });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      secs.forEach((s) => observerRef.current?.observe(s));
    } else secs.forEach((s) => s.classList.add('is-visible'));
    return () => observerRef.current?.disconnect();
  }, []);

  useEffect(() => {
    const path = location.pathname.replace(/^\//, '');
    if (['features', 'how-it-works', 'commands', 'faq'].includes(path)) {
      const el = document.getElementById(path);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [location.pathname]);

  const handleNavClick = (id, e) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    navigate(`/${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const activeBot = botCommands[activeCmd];

  return (
    <div className="landing-wrap">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <img src={pocketLogo} alt="Pocketplan logo" className="brand-logo" />
            <span className="brand-title">Pocketplan</span>
          </div>
          <nav className="landing-nav-links" aria-label="Public Navigation">
            <a href="/features" onClick={(e) => handleNavClick('features', e)} className="landing-nav-link">Features</a>
            <a href="/how-it-works" onClick={(e) => handleNavClick('how-it-works', e)} className="landing-nav-link">How It Works</a>
            <a href="/commands" onClick={(e) => handleNavClick('commands', e)} className="landing-nav-link">Commands</a>
            <a href="/faq" onClick={(e) => handleNavClick('faq', e)} className="landing-nav-link">FAQ</a>
          </nav>
          <div className="landing-nav-actions">
            <button type="button" className="theme-btn-topbar" onClick={toggleTheme} aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`} title={`Switch to ${isDark ? 'light' : 'dark'} mode`}>
              {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            </button>
            <Link to="/login" className="btn-landing-login">Login</Link>
            <Link to="/registration" className="btn-landing-register">Register</Link>
            <button type="button" className="landing-hamburger-btn" onClick={() => setMobileMenuOpen((p) => !p)} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {mobileMenuOpen ? (<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>) : (<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>)}
              </svg>
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="landing-mobile-drawer">
            <a href="/features" onClick={(e) => handleNavClick('features', e)} className="mobile-drawer-link">Features</a>
            <a href="/how-it-works" onClick={(e) => handleNavClick('how-it-works', e)} className="mobile-drawer-link">How It Works</a>
            <a href="/commands" onClick={(e) => handleNavClick('commands', e)} className="mobile-drawer-link">Commands</a>
            <a href="/faq" onClick={(e) => handleNavClick('faq', e)} className="mobile-drawer-link">FAQ</a>
            <div className="mobile-drawer-actions">
              <Link to="/login" className="btn-landing-login" onClick={() => setMobileMenuOpen(false)}>Login</Link>
              <Link to="/registration" className="btn-landing-register" onClick={() => setMobileMenuOpen(false)}>Register</Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-hero-eyebrow">✨ Gratis & Siap Pakai di Telegram</div>
          <h1 className="landing-hero-title">
            Catat Pengeluaran<br />Tanpa Ribet, Cukup<br /><span className="brand-highlight">Chat Pocky</span>
          </h1>
          <p className="landing-hero-desc">
            Kelola arus kas, capai target tabungan, dan cetak laporan keuangan — langsung dari Telegram atau dashboard web.
          </p>
          <div className="landing-hero-cta">
            <a href={telegramUrl} target="_blank" rel="noreferrer" className="cta-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.04 2 10.64c0 3.1 1.64 5.62 4.06 7.02l-.82 2.98 3.34-1.82A9.68 9.68 0 0012 19.28c4.97 0 9-4.04 9-9.64S16.97 2 12 2z" /></svg>
              Mulai di Telegram
            </a>
            <Link to="/demo" className="cta-ghost">Lihat Demo →</Link>
          </div>
          <div className="hero-trust-strip">
            <div className="trust-item"><span className="trust-icon-svg"><CloudSyncIcon /></span> Real-time Sync</div>
            <div className="trust-item"><span className="trust-icon-svg"><ShieldIcon /></span> Terenkripsi</div>
            <div className="trust-item"><span className="trust-icon-svg"><SparkIcon /></span> Gratis Selamanya</div>
          </div>
        </div>

        <div className="landing-hero-preview">
          <div className="preview-window-bar">
            <div className="window-dots"><span className="window-dot dot-red" /><span className="window-dot dot-yellow" /><span className="window-dot dot-green" /></div>
            <span className="window-badge">Telegram Cloud Sync</span>
            <span style={{ width: '38px' }} />
          </div>
          <div className="telegram-card-header">
            <div className="telegram-avatar"><img src={pocketLogo} alt="Pocky bot" /></div>
            <div className="telegram-info"><h4>Pocky — Pocketplan Bot</h4><p>● Online • Your Financial Companion</p></div>
          </div>
          <div className="telegram-chat-body">
            <div className="chat-bubble user">nasi padang 32000<div className="chat-bubble-footer">12:30 PM <span className="bubble-check">✓✓</span></div></div>
            <div className="chat-bubble bot"><b>✅ Pengeluaran Berhasil Dicatat</b><br />📁 Kategori: <b>Makanan</b><br />💸 Nominal: <b>Rp 32.000</b><br />💳 Saldo diperbarui otomatis<div className="chat-bubble-footer">12:30 PM</div></div>
            <div className="chat-bubble user">/streak<div className="chat-bubble-footer">12:31 PM <span className="bubble-check">✓✓</span></div></div>
            <div className="chat-bubble bot"><b>🔥 Status Streak: 7 Hari Aktif</b><br />✨ Konsistensi pencatatan Anda berjalan lancar!<div className="chat-bubble-footer">12:31 PM</div></div>
          </div>
          <div className="preview-hint">↑ Coba ketik di Telegram — Pocky balas instan</div>
        </div>

        {showScrollHint && (
          <button type="button" className="hero-scroll-hint" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} aria-label="Scroll to features">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
        )}
      </section>

      {/* Social proof strip */}
      <div className="landing-proof-strip">
        <span className="proof-label">Dipercaya untuk kelola keuangan harian</span>
        <span className="proof-divider" />
        <span className="proof-stat"><strong>100%</strong> Gratis</span>
        <span className="proof-stat"><strong>∞</strong> Transaksi</span>
        <span className="proof-stat"><strong>24/7</strong> Bot Online</span>
      </div>

      {/* Features — 6 cards */}
      <section id="features" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">Features</div>
          <h2 className="section-h2">Semua yang Dibutuhkan untuk Keuangan Rapi</h2>
          <p className="section-sub">Satu aplikasi untuk mencatat, memantau, dan mencapai target — di Telegram maupun web.</p>
        </div>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className={`feature-card ${f.featured ? 'is-featured' : ''}`}>
              {f.badge && <span className="feature-badge-spotlight">{f.badge}</span>}
              <div className="feature-emoji">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works — with connector */}
      <section id="how-it-works" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">How It Works</div>
          <h2 className="section-h2">Tiga Langkah, Langsung Jalan</h2>
          <p className="section-sub">Tanpa instalasi rumit — langsung pakai dari chat.</p>
        </div>
        <div className="steps-container">
          <div className="steps-connector" aria-hidden="true" />
          <div className="steps-grid">
            {steps.map((s) => (
              <div key={s.step} className="step-card">
                <div className="step-icon-emoji">{s.icon}</div>
                <div className="step-number">{s.step}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commands — tabbed interactive */}
      <section id="commands" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">Commands</div>
          <h2 className="section-h2">Perintah Cepat Pocky</h2>
          <p className="section-sub">Klik perintah untuk melihat balasan bot — semua dalam bahasa Indonesia.</p>
        </div>
        <div className="bot-tabs">
          <div className="bot-tab-list" role="tablist">
            {botCommands.map((b, i) => (
              <button key={b.cmd} role="tab" aria-selected={activeCmd === i} className={`bot-tab ${activeCmd === i ? 'is-active' : ''}`} onClick={() => setActiveCmd(i)}>
                {b.cmd}
              </button>
            ))}
          </div>
          <div className="bot-tab-panel" role="tabpanel">
            <div className="bot-tab-cmd">
              <span className="bot-cmd-tag">{activeBot.cmd} {activeBot.example}</span>
              <span className="bot-cmd-badge">Instant</span>
            </div>
            <div className="bot-tab-reply" style={{ whiteSpace: 'pre-line' }}>{activeBot.reply}</div>
            <a href={telegramUrl} target="_blank" rel="noreferrer" className="bot-tab-try">Coba di Telegram →</a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">FAQ</div>
          <h2 className="section-h2">Pertanyaan yang Sering Diajukan</h2>
          <p className="section-sub">Jawaban ringkas seputar Pocketplan dan Pocky.</p>
        </div>
        <div className="faq-list">
          {faqs.map((f, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={i} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
                <button type="button" className="faq-trigger" onClick={() => toggleFaq(i)} aria-expanded={isOpen}>
                  <span>{f.q}</span>
                  <svg className="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                {isOpen && <div className="faq-content">{f.a}</div>}
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA band */}
      <section className="landing-cta-band">
        <h2>Siap Kelola Keuangan Lebih Rapi?</h2>
        <p>Gratis, tanpa kartu kredit. Mulai dari Telegram dalam 10 detik.</p>
        <div className="landing-cta-band-actions">
          <a href={telegramUrl} target="_blank" rel="noreferrer" className="cta-primary">Mulai di Telegram</a>
          <Link to="/registration" className="cta-ghost cta-ghost--light">Buat Akun Web</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-grid">
            <div className="landing-footer-col brand-col">
              <div className="brand landing-footer-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                <img src={pocketLogo} alt="Pocketplan logo" className="brand-logo" />
                <span className="brand-title">Pocketplan</span>
              </div>
              <p className="landing-footer-tagline">Catat keuangan lewat Telegram, pantau di web. Simpel, sinkron, gratis.</p>
            </div>
            <div className="landing-footer-col">
              <div className="footer-col-title">Navigation</div>
              <ul className="footer-links-list">
                <li><a href="/features" onClick={(e) => handleNavClick('features', e)}>Features</a></li>
                <li><a href="/how-it-works" onClick={(e) => handleNavClick('how-it-works', e)}>How It Works</a></li>
                <li><a href="/commands" onClick={(e) => handleNavClick('commands', e)}>Commands</a></li>
                <li><a href="/faq" onClick={(e) => handleNavClick('faq', e)}>FAQ</a></li>
              </ul>
            </div>
            <div className="landing-footer-col">
              <div className="footer-col-title">Quick Access</div>
              <ul className="footer-links-list">
                <li><Link to="/login">Masuk</Link></li>
                <li><Link to="/registration">Daftar</Link></li>
                <li><Link to="/demo">Coba Demo</Link></li>
                <li><a href={telegramUrl} target="_blank" rel="noreferrer">Bot Telegram</a></li>
              </ul>
            </div>
          </div>
          <div className="landing-footer-bottom">
            <p className="landing-footer-copy">&copy; {new Date().getFullYear()} Pocketplan. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <FloatingMascot />
    </div>
  );
};

export default LandingPage;
