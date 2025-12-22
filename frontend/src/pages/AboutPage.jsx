import { useNavigate } from 'react-router-dom';

const features = [
  {
    key: 'balance',
    title: 'Track Balance',
    text: 'Monitor your income and expenses in real time through a clear and simple view. Stay in control of your daily financial flow with ease.'
  },
  {
    key: 'goals',
    title: 'Set Your Goals',
    text: 'Define your financial goals, from saving plans to long-term objectives. PocketPlan helps you stay focused and consistent in achieving them.'
  },
  {
    key: 'insights',
    title: 'Gain Insights',
    text: 'Get meaningful insights through easy-to-read charts and summaries. These insights support smarter and more confident financial decisions.'
  }
];

const featureIcons = {
  balance: '/feature-balance.svg',
  goals: '/feature-goals.svg',
  insights: '/feature-insights.svg'
};

const AboutPage = () => {
  const navigate = useNavigate();

  return (
    <div className="page about full">
      <header className="topbar card about-topbar">
        <div className="brand" onClick={() => navigate('/login')}>
          <img src="/pocket-logo.svg" alt="PocketPlan logo" className="brand-logo" />
          <span className="brand-title">PocketPlan</span>
        </div>
      </header>

      <div className="card about-card">
        <div className="about-header">
          <div className="about-title-block">
            <h2 className="section-title">ABOUT US</h2>
            <p className="subtitle about-subtitle">Learn more about PocketPlan and the team behind it</p>
          </div>
        </div>

        <div className="about-intro">
          <div className="intro-text">
            <h3 className="about-question">WHAT IS POCKETPLAN?</h3>
            <p className="about-text">
              PocketPlan membantu anda memantau pemasukan, pengeluaran, dan goals tabungan dengan tampilan sederhana.
              Catat transaksi, tetapkan tujuan, dan dapatkan insight dari grafik interaktif untuk pengambilan keputusan yang cepat.
            </p>
            <p className="about-text">
              Kami menjaga pengalaman tetap ringan, intuitif, dan fokus pada kebutuhan anda untuk merencanakan keuangan harian.
            </p>
          </div>
          <div className="intro-logo">
            <img src="/pocket-logo-text.svg" alt="PocketPlan" className="about-logo" />
          </div>
        </div>

        <div className="about-body">
          <h3 className="about-subtitle strong">Why Choose PocketPlan?</h3>
          <div className="features-grid">
            {features.map((f) => (
              <div className="card feature" key={f.key}>
                <div className="feature-icon">
                  <img src={featureIcons[f.key]} alt={f.title} className="feature-logo" />
                </div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-text">{f.text}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="devs">
          <h3 className="about-question">Developers</h3>
          <div className="dev-grid">
            <div className="card dev-card">
              <div className="dev-avatar red">M</div>
              <div className="dev-name">Mohammad Gendry Afriansyah</div>
              <div className="dev-role">UI/UX Designer</div>
            </div>
            <div className="card dev-card">
              <div className="dev-avatar yellow">S</div>
              <div className="dev-name">Syahrul Al Habib</div>
              <div className="dev-role">Backend Engineer</div>
            </div>
            <div className="card dev-card">
              <div className="dev-avatar gray">T</div>
              <div className="dev-name">Teddy</div>
              <div className="dev-role">Frontend Engineer</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
