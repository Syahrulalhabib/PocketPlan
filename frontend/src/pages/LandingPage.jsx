import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'yourpocketplan_bot';
const telegramUrl = `https://t.me/${botUsername}`;

const features = [
  {
    iconImg: '/feature-balance.svg',
    title: 'Pantau Saldo & Arus Kas',
    desc: 'Catat pemasukan dan pengeluaran harian dengan cepat. Dapatkan ringkasan saldo aktual kapan saja secara real-time.'
  },
  {
    iconImg: '/feature-goals.svg',
    title: 'Target Tabungan (Goals)',
    desc: 'Tentukan impian finansialmu, dari dana darurat hingga gadget impian. Pantau progres pencapaian dengan persentase visual.'
  },
  {
    iconImg: '/feature-insights.svg',
    title: 'Laporan & Analisis Pengeluaran',
    desc: 'Pahami pos pengeluaran terbesarmu melalui grafik donut, tren mingguan, dan cetak laporan bulanan PDF siap arsip.'
  },
  {
    emoji: '🤖',
    title: 'Bot Telegram Pocky',
    desc: 'Catat transaksi semudah kirim pesan chat. Dilengkapi fitur scan foto struk belanja otomatis memakai kecerdasan buatan.'
  },
  {
    emoji: '🔥',
    title: 'Streak & Achievement',
    desc: 'Bangun kebiasaan finansial yang konsisten. Kumpulkan streak harian, raih milestone tabungan, dan unduh kartu pencapaianmu.'
  }
];

const steps = [
  {
    step: '1',
    title: 'Mulai Chat atau Daftar Web',
    desc: 'Buka bot Telegram @yourpocketplan_bot atau daftar langsung di web Pocketplan dalam hitungan detik tanpa ribet.'
  },
  {
    step: '2',
    title: 'Catat Pemasukan & Pengeluaran',
    desc: 'Cukup ketik "makan siang 35rb" di chat atau input via dashboard web saat kamu melakukan transaksi.'
  },
  {
    step: '3',
    title: 'Pantau Progres & Laporan',
    desc: 'Pantau budget bulanan, raih streak konsistensi, dan cetak laporan keuangan bulanan lengkap berformat PDF.'
  }
];

const botCommands = [
  {
    cmd: '/catat',
    example: 'makan siang 35000',
    reply: '✅ Pengeluaran Rp 35.000 (Makanan) berhasil dicatat! Saldo kamu terupdate.'
  },
  {
    cmd: '/saldo',
    example: '',
    reply: '💰 Saldo Saat Ini: Rp 3.250.000\n📈 Pemasukan: Rp 5.000.000 | 📉 Pengeluaran: Rp 1.750.000'
  },
  {
    cmd: '/budget',
    example: '',
    reply: '🎯 Budget Makanan: Rp 850.000 / Rp 1.500.000 (56% terpakai) • Status: Aman 🟢'
  },
  {
    cmd: '/streak',
    example: '',
    reply: '🔥 Streak Aktif: 7 Hari berturut-turut! Rekor terpanjangmu: 14 hari.'
  },
  {
    cmd: '/tantangan',
    example: '',
    reply: '🏆 Tantangan: "Hemat Kopi 7 Hari" — Hari ke-4 dari 7. Kamu di posisi teratas!'
  }
];

const faqs = [
  {
    q: 'Apakah Pocketplan gratis digunakan?',
    a: 'Ya, Pocketplan 100% gratis digunakan baik melalui bot Telegram Pocky maupun web dashboard.'
  },
  {
    q: 'Apakah saya wajib mendaftar akun di web?',
    a: 'Tidak wajib. Kamu bisa langsung mencatat keuangan secara mandiri lewat bot Telegram. Pendaftaran web memudahkan melihat grafik visual dan cetak laporan PDF.'
  },
  {
    q: 'Apakah data keuangan saya aman?',
    a: 'Data keuanganmu tersimpan privat sesuai akun masing-masing. Tautan antara Telegram dan Web dilindungi dengan kode keamanan satu kali pakai.'
  },
  {
    q: 'Apakah Pocketplan bisa dipakai tanpa Telegram?',
    a: 'Bisa! Kamu bisa langsung mendaftar di web dan menggunakan seluruh fitur pencatatan, grafik, dan target tabungan langsung dari browser.'
  }
];

const LandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Pocketplan — Catat Keuangan Cerdas dengan Bot Telegram & Web';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Pocketplan: Aplikasi pencatat keuangan cerdas terintegrasi bot Telegram Pocky. Kelola arus kas, target tabungan, dan cetak laporan PDF.'
      );
    }
  }, []);

  return (
    <div className="landing-wrap">
      {/* Navbar */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="brand" onClick={() => navigate('/')}>
            <img src="/pocket-logo.svg" alt="Pocketplan logo" className="brand-logo" />
            <span className="brand-title">Pocketplan</span>
          </div>

          <nav className="landing-nav-links" aria-label="Navigasi Publik">
            <a href="#fitur" className="landing-nav-link">Fitur</a>
            <a href="#cara-kerja" className="landing-nav-link">Cara Kerja</a>
            <a href="#faq" className="landing-nav-link">FAQ</a>
          </nav>

          <div className="landing-nav-actions">
            <Link to="/login" className="btn-landing-login">Masuk</Link>
            <Link to="/register" className="btn-landing-register">Daftar</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            <span>🪙</span> Bot Telegram Finansial & Web Terintegrasi
          </div>
          <h1 className="landing-hero-title">
            Catat Keuangan Cerdas Tanpa Ribet bareng <span>Pocky</span>
          </h1>
          <p className="landing-hero-desc">
            Kelola pemasukan, pengeluaran harian, target tabungan, dan pantau kesehatan finansialmu lewat chat bot Telegram atau dashboard web modern.
          </p>
          <div className="landing-hero-cta">
            <a href={telegramUrl} target="_blank" rel="noreferrer" className="cta-primary">
              <span>🚀</span> Mulai via Telegram
            </a>
            <Link to="/demo" className="cta-secondary">
              <span>✨</span> Coba Demo
            </Link>
          </div>
        </div>

        {/* Hero Preview Chat Bubble */}
        <div className="landing-hero-preview">
          <div className="telegram-card-header">
            <div className="telegram-avatar">🪙</div>
            <div className="telegram-info">
              <h4>Pocky — Pocketplan Bot</h4>
              <p>Online • Asisten Finansialmu</p>
            </div>
          </div>
          <div className="telegram-chat-body">
            <div className="chat-bubble user">makan siang padang 32000</div>
            <div className="chat-bubble bot">
              ✅ <b>Pengeluaran Berhasil Dicatat!</b><br />
              🍔 Kategori: <b>Makanan</b><br />
              💸 Nominal: <b>Rp 32.000</b>
            </div>
            <div className="chat-bubble user">/streak</div>
            <div className="chat-bubble bot">
              🔥 <b>Streak 7 Hari Aktif!</b><br />
              Disiplin mencatat 7 hari berturut-turut!
            </div>
          </div>
        </div>
      </section>

      {/* Fitur */}
      <section id="fitur" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">Fitur Unggulan</div>
          <h2 className="section-h2">Dirancang untuk Mengendalikan Finansialmu</h2>
          <p className="section-sub">Semua alat yang kamu butuhkan untuk mencapai target keuangan pribadi.</p>
        </div>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
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

      {/* Cara Kerja */}
      <section id="cara-kerja" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">Alur Praktis</div>
          <h2 className="section-h2">3 Langkah Mudah Memulai</h2>
          <p className="section-sub">Mulai rapikan arus kas pribadimu dengan mudah.</p>
        </div>
        <div className="steps-grid">
          {steps.map((s, i) => (
            <div key={i} className="step-card">
              <div className="step-number">{s.step}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Showcase Bot Commands */}
      <section className="landing-section">
        <div className="section-head">
          <div className="section-kicker">Perintah Cepat</div>
          <h2 className="section-h2">Interaksi Mudah dengan Bot Telegram</h2>
          <p className="section-sub">Kirim teks singkat, Pocky langsung memproses data keuanganmu.</p>
        </div>
        <div className="bot-showcase-grid">
          {botCommands.map((b, i) => (
            <div key={i} className="bot-command-box">
              <div className="bot-cmd-head">
                <span className="bot-cmd-tag">{b.cmd} {b.example}</span>
              </div>
              <div className="bot-cmd-reply" style={{ whiteSpace: 'pre-line' }}>
                {b.reply}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">Pertanyaan Umum</div>
          <h2 className="section-h2">Kerap Ditanyakan</h2>
          <p className="section-sub">Pertanyaan seputar penggunaan Pocketplan dan bot Pocky.</p>
        </div>
        <div className="faq-list">
          {faqs.map((f, i) => (
            <div key={i} className="faq-item">
              <h4 className="faq-question">❓ {f.q}</h4>
              <p className="faq-answer">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="brand" onClick={() => navigate('/')}>
            <img src="/pocket-logo.svg" alt="Pocketplan logo" className="brand-logo" />
            <span className="brand-title">Pocketplan</span>
          </div>
          <div className="landing-footer-links">
            <Link to="/login" className="landing-footer-link">Masuk</Link>
            <Link to="/register" className="landing-footer-link">Daftar Akun</Link>
            <Link to="/demo" className="landing-footer-link">Mode Demo</Link>
            <Link to="/about" className="landing-footer-link">Tentang Kami</Link>
            <a href={telegramUrl} target="_blank" rel="noreferrer" className="landing-footer-link">Bot Telegram</a>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Pocketplan. Hak cipta dilindungi.</span>
          <span>Dibuat untuk pengelolaan keuangan yang lebih mudah.</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

