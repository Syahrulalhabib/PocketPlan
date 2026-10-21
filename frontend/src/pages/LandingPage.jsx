import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../providers/ThemeProvider.jsx';
import { SunIcon, MoonIcon } from '../components/Icons.jsx';
import FloatingMascot from '../components/FloatingMascot.jsx';
import pocketLogo from '../assets/pocket-logo.svg';

const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'yourpocketplan_bot';
const telegramUrl = `https://t.me/${botUsername}`;

// ——— SVG trust icons ———
const CloudSyncIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
);
const ShieldIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);
const SparkIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.3L12 16.5l-6.2 4.5 2.4-7.3L2 9.2h7.6z" /></svg>
);

// ——— 6 Features (symmetrical 3x2) ———
const features = [
  { icon: '🤖', title: 'Pocky Telegram Bot', desc: 'Log expenses as easily as sending a chat message. Physical receipts are automatically scanned by Gemini AI and categorized instantly.', featured: true, badge: 'Core Feature' },
  { icon: '🎯', title: 'Smart Savings Goals', desc: 'Set dream savings targets — from emergency funds to big purchases. Target progress stays automatically synced with your live balance.', featured: true, badge: 'Popular' },
  { icon: '💰', title: 'Track Balance & Cashflow', desc: 'Monitor daily income and spending without manual calculations. Know your exact net balance in real time across all devices.' },
  { icon: '📊', title: 'Monthly Reports & Analytics', desc: 'Understand spending habits through visual cashflow charts, category breakdowns, and export clean printable PDF reports.' },
  { icon: '🔥', title: 'Streaks & Milestones', desc: 'Build lasting financial discipline with consecutive logging streaks and collect milestone achievement badges along the way.' },
  { icon: '🔗', title: 'Telegram ↔ Web Sync', desc: 'One account seamlessly linked across platforms. Log transactions on Telegram on-the-go, and inspect in-depth analytics on web anytime.', badge: 'Seamless' }
];

const steps = [
  { step: '1', title: 'Start on Telegram or Web', desc: 'Open @yourpocketplan_bot on Telegram or access the Pocketplan web app directly from your browser without complex setup.' },
  { step: '2', title: 'Log Spending in Plain Text', desc: 'Type quick natural messages like "kopi 25k", upload receipt photos, or use the quick form on the web dashboard.' },
  { step: '3', title: 'Track Habits & Export Reports', desc: 'Keep spending within category budgets, maintain your daily logging streak, and download clean reports whenever needed.' }
];

// System bot commands & real bot replies
const botCommands = [
  { cmd: '/catat', example: 'nasi padang 32000', reply: '✅ Pengeluaran Rp 32.000 (Makanan) berhasil dicatat.\nSaldo Anda telah diperbarui secara otomatis.' },
  { cmd: '/saldo', example: '', reply: '💰 Saldo Saat Ini: Rp 3.250.000\n📥 Pemasukan: Rp 5.000.000 | 📤 Pengeluaran: Rp 1.750.000' },
  { cmd: '/budget', example: '', reply: '🍽️ Anggaran Makanan: Rp 850.000 / Rp 1.500.000 (56% terpakai) • Status: Aman ✅' },
  { cmd: '/streak', example: '', reply: '🔥 Status Streak: 7 hari berturut-turut aktif!\nRekor terbaik: 14 hari ✨' },
  { cmd: '/goal', example: '', reply: '🎯 Target "Dana Darurat": Rp 5.000.000 / Rp 10.000.000 (50% tercapai)' }
];

const faqs = [
  { q: 'Is Pocketplan completely free to use?', a: 'Yes, all tracking features across both the Pocky Telegram bot and the web dashboard are 100% free with no charges.' },
  { q: 'Do I need to create a website account?', a: 'Not required. You can manage and log expenses entirely through the Telegram bot. A web account is optional if you want interactive analytics charts and printable reports.' },
  { q: 'How secure is my financial data?', a: 'Your financial data is private and only accessible by your account. Account linking between Telegram and web is secured with one-time verification codes.' },
  { q: 'Can I use Pocketplan without Telegram?', a: 'Absolutely. You can register and use the web dashboard directly to record transactions, manage budgets, and track your savings goals.' }
];

const LandingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [openFaq, setOpenFaq] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCmd, setActiveCmd] = useState(0);
  const observerRef = useRef(null);

  const toggleFaq = (i) => setOpenFaq((prev) => (prev === i ? null : i));

  useEffect(() => {
    document.title = 'Pocketplan – Smart Finance in Your Pocket';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Pocketplan – Smart Finance in Your Pocket. Aplikasi keuangan pribadi gratis. Catat pengeluaran, atur tabungan, dan scan struk otomatis via AI di Web & Telegram Bot.'
      );
    }
  }, []);

  useEffect(() => {
    const sections = document.querySelectorAll('.landing-section');
    if ('IntersectionObserver' in window) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
      );
      sections.forEach((sec) => observerRef.current?.observe(sec));
    } else {
      sections.forEach((sec) => sec.classList.add('is-visible'));
    }

    return () => observerRef.current?.disconnect();
  }, []);

  useEffect(() => {
    const path = location.pathname.replace(/^\//, '');
    if (['features', 'how-it-works', 'commands', 'faq'].includes(path)) {
      const el = document.getElementById(path);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [location.pathname]);

  const handleNavClick = (sectionId, e) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    navigate(`/${sectionId}`);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const activeBot = botCommands[activeCmd];

  return (
    <div className="landing-wrap">
      {/* Navbar */}
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
            <button
              type="button"
              className="theme-btn-topbar"
              onClick={toggleTheme}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
              {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            </button>
            <Link to="/login" className="btn-landing-login">Login</Link>
            <Link to="/registration" className="btn-landing-register">Register</Link>

            <button
              type="button"
              className="landing-hamburger-btn"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {mobileMenuOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
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

      {/* Hero — Spacious, wide layout */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            Smart Expense Tracking Without the Hassle with <span className="brand-highlight">Pocky</span>
          </h1>
          <p className="landing-hero-desc">
            Effortlessly manage daily cashflow, reach your savings goals, and stay on top of your financial health right from Telegram or a modern web dashboard.
          </p>
          <div className="landing-hero-cta">
            <a href={telegramUrl} target="_blank" rel="noreferrer" className="cta-primary">
              Start via Telegram
            </a>
            <Link to="/demo" className="cta-secondary">
              Try Interactive Demo
            </Link>
          </div>
          <div className="hero-trust-strip">
            <div className="trust-item">
              <span className="trust-icon-svg"><CloudSyncIcon /></span>
              <span>Real-time Cloud Sync</span>
            </div>
            <div className="trust-item">
              <span className="trust-icon-svg"><ShieldIcon /></span>
              <span>Encrypted Verification</span>
            </div>
            <div className="trust-item">
              <span className="trust-icon-svg"><SparkIcon /></span>
              <span>100% Free to Use</span>
            </div>
          </div>
        </div>

        {/* Telegram Frame Preview */}
        <div className="landing-hero-preview">
          <div className="preview-window-bar">
            <div className="window-dots">
              <span className="window-dot dot-red" />
              <span className="window-dot dot-yellow" />
              <span className="window-dot dot-green" />
            </div>
            <span className="window-badge">Telegram Cloud Sync</span>
            <span style={{ width: '38px' }} />
          </div>

          <div className="telegram-card-header">
            <div className="telegram-avatar">
              <img src={pocketLogo} alt="Pocketplan Bot" />
            </div>
            <div className="telegram-info">
              <h4>Pocky — Pocketplan Bot</h4>
              <p>● Online • Your Financial Companion</p>
            </div>
          </div>
          <div className="telegram-chat-body">
            <div className="chat-bubble user">
              nasi padang 32000
              <div className="chat-bubble-footer">12:30 PM <span className="bubble-check">✓✓</span></div>
            </div>
            <div className="chat-bubble bot">
              <b>✅ Pengeluaran Berhasil Dicatat</b><br />
              📁 Kategori: <b>Makanan</b><br />
              💸 Nominal: <b>Rp 32.000</b><br />
              💳 Saldo diperbarui otomatis
              <div className="chat-bubble-footer">12:30 PM</div>
            </div>
            <div className="chat-bubble user">
              /streak
              <div className="chat-bubble-footer">12:31 PM <span className="bubble-check">✓✓</span></div>
            </div>
            <div className="chat-bubble bot">
              <b>🔥 Status Streak: 7 Hari Aktif</b><br />
              ✨ Konsistensi pencatatan Anda berjalan lancar!
              <div className="chat-bubble-footer">12:31 PM</div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Strip — Generous horizontal ribbon */}
      <div className="landing-proof-strip">
        <span className="proof-label">Trusted for everyday financial tracking</span>
        <span className="proof-divider" />
        <span className="proof-stat"><strong>100%</strong> Free Forever</span>
        <span className="proof-stat"><strong>&infin;</strong> Unlimited Transactions</span>
        <span className="proof-stat"><strong>24/7</strong> Always-On Bot</span>
      </div>

      {/* Features — 6 Symmetrical Cards */}
      <section id="features" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">Features</div>
          <h2 className="section-h2">Everything You Need for Effortless Finances</h2>
          <p className="section-sub">All the tools to manage cashflow, build financial discipline, and hit your target goals across web and chat.</p>
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

      {/* How It Works — with pipeline connector */}
      <section id="how-it-works" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">How It Works</div>
          <h2 className="section-h2">Three Simple Steps to Get Started</h2>
          <p className="section-sub">No complicated setup or downloads required — start right from your browser or chat.</p>
        </div>
        <div className="steps-container">
          <div className="steps-connector" aria-hidden="true" />
          <div className="steps-grid">
            {steps.map((s) => (
              <div key={s.step} className="step-card">
                <div className="step-number-wrap">
                  <div className="step-number">{s.step}</div>
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commands — Interactive Tabbed Console */}
      <section id="commands" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">Commands</div>
          <h2 className="section-h2">Quick Telegram Bot Commands</h2>
          <p className="section-sub">Tap any command below to preview instant live responses from Pocky assistant.</p>
        </div>
        <div className="bot-tabs">
          <div className="bot-tab-list" role="tablist">
            {botCommands.map((b, i) => (
              <button
                key={b.cmd}
                role="tab"
                aria-selected={activeCmd === i}
                className={`bot-tab ${activeCmd === i ? 'is-active' : ''}`}
                onClick={() => setActiveCmd(i)}
              >
                {b.cmd}
              </button>
            ))}
          </div>
          <div className="bot-tab-panel" role="tabpanel">
            <div className="bot-tab-cmd">
              <span className="bot-cmd-tag">{activeBot.cmd} {activeBot.example}</span>
              <span className="bot-cmd-badge">Instant Reply</span>
            </div>
            <div className="bot-tab-reply" style={{ whiteSpace: 'pre-line' }}>
              {activeBot.reply}
            </div>
            <a href={telegramUrl} target="_blank" rel="noreferrer" className="bot-tab-try">
              Try in Telegram &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section id="faq" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">FAQ</div>
          <h2 className="section-h2">Frequently Asked Questions</h2>
          <p className="section-sub">Clear answers on how Pocketplan and your Pocky assistant work together.</p>
        </div>
        <div className="faq-list">
          {faqs.map((f, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={i} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="faq-trigger"
                  onClick={() => toggleFaq(i)}
                  aria-expanded={isOpen}
                >
                  <span>{f.q}</span>
                  <svg className="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="faq-content">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Band before Footer */}
      <section className="landing-cta-band">
        <h2>Ready to Master Your Finances?</h2>
        <p>100% free, no credit card required. Log your first transaction in under 10 seconds.</p>
        <div className="landing-cta-band-actions">
          <a href={telegramUrl} target="_blank" rel="noreferrer" className="cta-primary">
            Start via Telegram
          </a>
          <Link to="/registration" className="cta-secondary">
            Create Web Account
          </Link>
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
              <p className="landing-footer-tagline">
                Smart personal finance tracking integrated with Telegram bot and modern web dashboard. Master your cashflow effortlessly.
              </p>
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
                <li><Link to="/login">Web App Sign In</Link></li>
                <li><Link to="/registration">Create Account</Link></li>
                <li><Link to="/demo">Interactive Demo</Link></li>
                <li><a href={telegramUrl} target="_blank" rel="noreferrer">Telegram Bot (@yourpocketplan_bot)</a></li>
              </ul>
            </div>
          </div>

          <div className="landing-footer-bottom">
            <p className="landing-footer-copy">
              &copy; {new Date().getFullYear()} Pocketplan. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <FloatingMascot />
    </div>
  );
};

export default LandingPage;
