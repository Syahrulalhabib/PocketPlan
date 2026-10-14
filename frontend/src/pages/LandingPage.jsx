import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'yourpocketplan_bot';
const telegramUrl = `https://t.me/${botUsername}`;

const features = [
  {
    iconImg: '/feature-balance.svg',
    title: 'Track Balance & Cashflow',
    desc: 'Log daily income and expenses in seconds. Check your actual balance anytime in real time across all accounts.'
  },
  {
    iconImg: '/feature-goals.svg',
    title: 'Smart Savings Goals',
    desc: 'Define your financial dreams from emergency funds to travel or gadgets. Monitor your milestone progress visually.'
  },
  {
    iconImg: '/feature-insights.svg',
    title: 'Monthly Reports & Analytics',
    desc: 'Understand your spending habits with breakdown donut charts, weekly trends, and clean printable PDF reports.'
  },
  {
    emoji: '🤖',
    title: 'Pocky Telegram Bot',
    desc: 'Record transactions as quickly as texting a friend. Features AI-powered instant receipt and payment screenshot scanning.'
  },
  {
    emoji: '🔥',
    title: 'Streaks & Milestones',
    desc: 'Build lasting financial consistency. Maintain daily logging streaks, unlock savings badges, and share your achievements.'
  }
];

const steps = [
  {
    step: '1',
    title: 'Start on Telegram or Web',
    desc: 'Open Telegram bot @yourpocketplan_bot or create your Pocketplan web account in seconds without friction.'
  },
  {
    step: '2',
    title: 'Log Spending in Plain English',
    desc: 'Type "lunch 35k" in chat, snap a photo of your receipt, or log transactions directly from the web dashboard.'
  },
  {
    step: '3',
    title: 'Track Habits & Export Reports',
    desc: 'Stay within budget limits, keep your logging streak alive, and export comprehensive monthly PDF reports.'
  }
];

const botCommands = [
  {
    cmd: '/catat',
    example: 'lunch padang 32000',
    reply: '✅ Expense Rp 32.000 (Food & Dining) recorded! Your balance has been updated.'
  },
  {
    cmd: '/saldo',
    example: '',
    reply: '💰 Current Balance: Rp 3.250.000\n📈 Income: Rp 5.000.000 | 📉 Expenses: Rp 1.750.000'
  },
  {
    cmd: '/budget',
    example: '',
    reply: '🎯 Food Budget: Rp 850.000 / Rp 1.500.000 (56% used) • Status: On Track 🟢'
  },
  {
    cmd: '/streak',
    example: '',
    reply: '🔥 Active Streak: 7 Days in a row! Longest record: 14 days.'
  },
  {
    cmd: '/challenge',
    example: '',
    reply: '🏆 Challenge: "7-Day Coffee Saver" — Day 4 of 7. You are on track!'
  }
];

const faqs = [
  {
    q: 'Is Pocketplan free to use?',
    a: 'Yes, Pocketplan is 100% free to use via both the Pocky Telegram bot and the web dashboard.'
  },
  {
    q: 'Do I need to create a web account?',
    a: 'No. You can manage everything solely via the Telegram bot. Signing up on the web unlocks interactive visual charts, deep analytics, and printable PDF reports.'
  },
  {
    q: 'Is my financial data secure?',
    a: 'Your financial records remain private to your account. Linking between Telegram and the web is secured by an encrypted one-time verification passcode.'
  },
  {
    q: 'Can I use Pocketplan without Telegram?',
    a: 'Absolutely! You can register directly on the web and enjoy full tracking, budgeting, and savings features right inside your browser.'
  }
];

const LandingPage = () => {
  const navigate = useNavigate();

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
          <div className="brand" onClick={() => navigate('/')}>
            <img src="/pocket-logo.svg" alt="Pocketplan logo" className="brand-logo" />
            <span className="brand-title">Pocketplan</span>
          </div>

          <nav className="landing-nav-links" aria-label="Public Navigation">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#how-it-works" className="landing-nav-link">How It Works</a>
            <a href="#commands" className="landing-nav-link">Commands</a>
            <a href="#faq" className="landing-nav-link">FAQ</a>
          </nav>

          <div className="landing-nav-actions">
            <a href={telegramUrl} target="_blank" rel="noreferrer" className="landing-nav-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span>🚀</span> Telegram Bot
            </a>
            <Link to="/login" className="btn-landing-login">Login</Link>
            <Link to="/register" className="btn-landing-register">Register</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            <span>✨</span> Instant Telegram Bot &amp; Web Sync
          </div>
          <h1 className="landing-hero-title">
            Smart Expense Tracking Without the Hassle with <span>Pocky</span>
          </h1>
          <p className="landing-hero-desc">
            Take charge of daily cashflow, hit savings goals, and track financial health effortlessly via Telegram chat or our modern web dashboard.
          </p>
          <div className="landing-hero-cta">
            <a href={telegramUrl} target="_blank" rel="noreferrer" className="cta-primary">
              <span>🚀</span> Start via Telegram
            </a>
            <Link to="/demo" className="cta-secondary">
              <span>✨</span> Try Interactive Demo
            </Link>
          </div>
        </div>

        {/* Hero Preview Chat Bubble */}
        <div className="landing-hero-preview">
          <div className="telegram-card-header">
            <div className="telegram-avatar">✨</div>
            <div className="telegram-info">
              <h4>Pocky — Pocketplan Bot</h4>
              <p>Online • Your Financial Companion</p>
            </div>
          </div>
          <div className="telegram-chat-body">
            <div className="chat-bubble user">lunch padang 32000</div>
            <div className="chat-bubble bot">
              ✅ <b>Expense Recorded!</b><br />
              🍔 Category: <b>Food &amp; Dining</b><br />
              💸 Amount: <b>Rp 32.000</b>
            </div>
            <div className="chat-bubble user">/streak</div>
            <div className="chat-bubble bot">
              🔥 <b>7-Day Active Streak!</b><br />
              Discipline pays off — 7 consecutive days recorded!
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">Features</div>
          <h2 className="section-h2">Designed to Keep You in Complete Control</h2>
          <p className="section-sub">All the essentials you need to master your money and hit your personal savings goals.</p>
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

      {/* How It Works */}
      <section id="how-it-works" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">Workflow</div>
          <h2 className="section-h2">3 Simple Steps to Get Started</h2>
          <p className="section-sub">Organize your personal cashflow effortlessly without friction.</p>
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
      <section id="commands" className="landing-section">
        <div className="section-head">
          <div className="section-kicker">Quick Commands</div>
          <h2 className="section-h2">Fast &amp; Natural Bot Interaction</h2>
          <p className="section-sub">Send simple commands or receipt snapshots — Pocky parses and categorizes everything instantly.</p>
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
          <div className="section-kicker">FAQ</div>
          <h2 className="section-h2">Frequently Asked Questions</h2>
          <p className="section-sub">Common questions about using Pocketplan and the Pocky assistant.</p>
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
        <div className="landing-footer-inner" style={{ justifyContent: 'center', paddingBottom: '16px' }}>
          <div className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <img src="/pocket-logo.svg" alt="Pocketplan logo" className="brand-logo" />
            <span className="brand-title">Pocketplan</span>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Pocketplan. All rights reserved.</span>
          <span>Smart, effortless financial tracking for everyday life.</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

