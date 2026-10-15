import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../providers/ThemeProvider.jsx';
import { SunIcon, MoonIcon } from '../components/Icons.jsx';
import pocketLogo from '../assets/pocket-logo.svg';

const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'yourpocketplan_bot';
const telegramUrl = `https://t.me/${botUsername}`;

const features = [
  {
    iconImg: '/feature-balance.svg',
    title: 'Pocky Telegram Bot',
    desc: 'Catat pengeluaran semudah mengirim pesan teks. Didukung pembacaan struk belanja otomatis via Gemini AI serta pengelompokan kategori langsung di Telegram.',
    featured: true,
    badge: 'Core Feature'
  },
  {
    iconImg: '/feature-goals.svg',
    title: 'Smart Savings Goals',
    desc: 'Tetapkan target tabungan impian, mulai dari dana darurat hingga pembelian aset. Progres tabungan terhubung langsung dengan saldo aktif secara transparan.',
    featured: true,
    badge: 'Popular'
  },
  {
    iconImg: '/feature-insights.svg',
    title: 'Track Balance & Cashflow',
    desc: 'Pantau arus kas masuk dan keluar harian tanpa hitung manual. Ketahui posisi saldo bersih secara seketika di seluruh perangkat Anda.'
  },
  {
    iconImg: '/feature-insights.svg',
    title: 'Monthly Reports & Analytics',
    desc: 'Pahami pola pengeluaran melalui visualisasi diagram alir, perbandingan antarkategori belanja, serta opsi cetak laporan rapi format dokumen cetak.'
  },
  {
    iconImg: '/feature-goals.svg',
    title: 'Streaks & Milestones',
    desc: 'Bangun kedisiplinan finansial harian melalui rekor streak pencatatan dan koleksi lencana pencapaian target tabungan.'
  }
];

const steps = [
  {
    step: '1',
    title: 'Start on Telegram or Web',
    desc: 'Buka bot Telegram @yourpocketplan_bot atau akses aplikasi web Pocketplan langsung dari peramban tanpa instalasi rumit.'
  },
  {
    step: '2',
    title: 'Log Spending in Natural Text',
    desc: 'Ketik pesan singkat seperti "kopi 25k" di obrolan Telegram, kirimkan foto struk fisik, atau gunakan formulir cepat di dashboard web.'
  },
  {
    step: '3',
    title: 'Track Habits & Export Reports',
    desc: 'Pantau batas anggaran bulanan, jaga konsistensi pencatatan harian, dan unduh ringkasan laporan keuangan kapan pun dibutuhkan.'
  }
];

const botCommands = [
  {
    cmd: '/catat',
    example: 'nasi padang 32000',
    reply: 'Pengeluaran Rp 32.000 (Makanan) berhasil dicatat. Saldo Anda telah diperbarui.'
  },
  {
    cmd: '/saldo',
    example: '',
    reply: 'Saldo Saat Ini: Rp 3.250.000\nPemasukan: Rp 5.000.000 | Pengeluaran: Rp 1.750.000'
  },
  {
    cmd: '/budget',
    example: '',
    reply: 'Anggaran Makanan: Rp 850.000 / Rp 1.500.000 (56% terpakai) • Status: Aman'
  },
  {
    cmd: '/streak',
    example: '',
    reply: 'Streak Aktif: 7 hari berturut-turut. Rekor terpanjang: 14 hari.'
  },
  {
    cmd: '/tantangan',
    example: '',
    reply: 'Tantangan: "Hemat Kopi 7 Hari" — Hari ke-4 dari 7. Tetap disiplin!'
  }
];

const faqs = [
  {
    q: 'Apakah Pocketplan gratis digunakan?',
    a: 'Ya, seluruh fitur pencatatan melalui bot Telegram Pocky dan dashboard web dapat digunakan tanpa pungutan biaya.'
  },
  {
    q: 'Apakah saya wajib membuat akun di website?',
    a: 'Tidak wajib. Anda dapat mencatat keuangan seutuhnya melalui bot Telegram. Akun web bersifat opsional apabila Anda ingin melihat grafik analitik interaktif dan mencetak laporan.'
  },
  {
    q: 'Bagaimana keamanan data keuangan saya?',
    a: 'Data keuangan Anda bersifat privat dan hanya dapat diakses oleh akun Anda. Penautan antara Telegram dan web diamankan dengan kode verifikasi sekali pakai.'
  },
  {
    q: 'Bisakah saya menggunakan Pocketplan tanpa Telegram?',
    a: 'Tentu. Anda dapat langsung mendaftar dan menggunakan dashboard web untuk mencatat transaksi, mengatur anggaran, dan memantau target tabungan.'
  }
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [openFaq, setOpenFaq] = useState(0);

  const toggleFaq = (index) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  };

  useEffect(() => {
    document.title = 'Pocketplan — Smart Financial Tracking with Telegram Bot & Web';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Pocketplan: Smart personal finance tracking integrated with Pocky Telegram bot. Manage cashflow, hit savings goals, and export clean PDF reports.'
      );
    }
  }, []);

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
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#how-it-works" className="landing-nav-link">How It Works</a>
            <a href="#commands" className="landing-nav-link">Commands</a>
            <a href="#faq" className="landing-nav-link">FAQ</a>
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
            <a href={telegramUrl} target="_blank" rel="noreferrer" className="landing-nav-link landing-nav-tg">
              Telegram Bot
            </a>
            <Link to="/login" className="btn-landing-login">Login</Link>
            <Link to="/register" className="btn-landing-register">Register</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            Smart Expense Tracking Without the Hassle with <span className="brand-highlight">Pocky</span>
          </h1>
          <p className="landing-hero-desc">
            Kelola arus kas harian, wujudkan target tabungan, dan pantau kesehatan finansial tanpa repot melalui obrolan Telegram atau dashboard web modern.
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
            <span className="trust-item">Real-time Cloud Sync</span>
            <span className="trust-item">Encrypted Verification</span>
            <span className="trust-item">100% Free to Use</span>
          </div>
        </div>

        {/* Hero Preview Device Frame */}
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
              <img src={pocketLogo} alt="Pocky Mascot" style={{ width: '22px', height: '22px' }} />
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
              <b>Pengeluaran Dicatat</b><br />
              Kategori: <b>Makanan</b><br />
              Nominal: <b>Rp 32.000</b>
              <div className="chat-bubble-footer">12:30 PM</div>
            </div>
            <div className="chat-bubble user">
              /streak
              <div className="chat-bubble-footer">12:31 PM <span className="bubble-check">✓✓</span></div>
            </div>
            <div className="chat-bubble bot">
              <b>Status Streak: 7 Hari Aktif</b><br />
              Konsistensi pencatatan Anda berjalan lancar!
              <div className="chat-bubble-footer">12:31 PM</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">Features</div>
          <h2 className="section-h2">Kemudahan Penuh dalam Mengelola Keuangan</h2>
          <p className="section-sub">Seluruh perangkat pencatatan yang Anda perlukan untuk mencapai kestabilan finansial dan target tabungan.</p>
        </div>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className={`feature-card ${f.featured ? 'is-featured' : ''}`}>
              {f.badge && <span className="feature-badge-spotlight">{f.badge}</span>}
              <div className="feature-icon-wrap">
                {f.iconImg ? (
                  <img src={f.iconImg} alt={f.title} className="feature-icon-img" />
                ) : (
                  <span className="feature-icon-emoji">{f.emoji}</span>
                )}
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">How It Works</div>
          <h2 className="section-h2">Tiga Langkah Sederhana untuk Memulai</h2>
          <p className="section-sub">Tata kelola keuangan harian yang praktis tanpa mengganggu rutinitas harian Anda.</p>
        </div>
        <div className="steps-container">
          <div className="steps-grid">
            {steps.map((s, i) => (
              <div key={i} className="step-card">
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

      {/* Showcase Bot Commands */}
      <section id="commands" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">Commands</div>
          <h2 className="section-h2">Perintah Cepat Bot Telegram</h2>
          <p className="section-sub">Kirim pesan singkat atau foto struk belanja — Pocky merapikan dan mengelompokkan catatan secara instan.</p>
        </div>
        <div className="bot-showcase-grid">
          {botCommands.map((b, i) => (
            <div key={i} className="bot-command-box">
              <div className="bot-cmd-head">
                <span className="bot-cmd-tag">{b.cmd} {b.example}</span>
                <span className="bot-cmd-badge">Instant</span>
              </div>
              <div className="bot-cmd-reply" style={{ whiteSpace: 'pre-line' }}>
                {b.reply}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Accordion */}
      <section id="faq" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">FAQ</div>
          <h2 className="section-h2">Pertanyaan yang Sering Diajukan</h2>
          <p className="section-sub">Jawaban ringkas dan jelas seputar cara kerja Pocketplan dan asisten Pocky.</p>
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

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="brand landing-footer-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <img src={pocketLogo} alt="Pocketplan logo" className="brand-logo" />
            <span className="brand-title">Pocketplan</span>
          </div>
          <p className="landing-footer-copy">
            &copy; {new Date().getFullYear()} Pocketplan. Kelola keuangan harian lebih tertata langsung dari Telegram dan web.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

