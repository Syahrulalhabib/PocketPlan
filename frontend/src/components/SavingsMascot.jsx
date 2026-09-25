import { useState, useEffect, useRef, memo } from 'react';

const SAVINGS_TIPS = [
  'Saving Rp 20,000 a day = Rp 7,300,000 a year! 🚀',
  'Step by step, small savings create giant leaps! 💰',
  'Cut down on takeout coffee, secure your future savings! ☕✨',
  'Safe wallet, peaceful mind, goals achieved! 🏖️',
  'Every coin you save is an investment in your future! 🌟',
  'The key to financial freedom is consistency, not size! 🎯',
  "You don't need to be rich to save; save first to grow rich! 🐷"
];

export const CoinIcon = ({ size = 32, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`svg-coin ${className}`}
  >
    <circle cx="20" cy="20" r="18" fill="url(#coinGrad)" stroke="#b45309" strokeWidth="2" />
    <circle cx="20" cy="20" r="14" fill="none" stroke="#fde047" strokeWidth="1.5" strokeDasharray="3 2" />
    <circle cx="16" cy="14" r="2.5" fill="#ffffff" opacity="0.6" />
    <text
      x="20"
      y="24.5"
      textAnchor="middle"
      fill="#78350f"
      fontSize="13"
      fontWeight="900"
      fontFamily="system-ui, -apple-system, sans-serif"
    >
      Rp
    </text>
    <defs>
      <linearGradient id="coinGrad" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fde047" />
        <stop offset="0.45" stopColor="#f59e0b" />
        <stop offset="1" stopColor="#d97706" />
      </linearGradient>
    </defs>
  </svg>
);

const SavingsMascot = ({ mode = 'hero', className = '' }) => {
  const [coinsSaved, setCoinsSaved] = useState(() => {
    const saved = localStorage.getItem('pocketplan_mascot_coins');
    return saved ? Math.max(5, parseInt(saved, 10)) : 7;
  });
  const [tossedCoins, setTossedCoins] = useState([]);
  const [isSquishing, setIsSquishing] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [tipIndex, setTipIndex] = useState(0);
  const nextIdRef = useRef(1);

  useEffect(() => {
    localStorage.setItem('pocketplan_mascot_coins', String(coinsSaved));
  }, [coinsSaved]);

  useEffect(() => {
    if (mode !== 'widget' && mode !== 'hero') return;
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % SAVINGS_TIPS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [mode]);

  const handleTossCoin = () => {
    const coinId = nextIdRef.current++;
    const randomOffset = (Math.random() - 0.5) * 40;
    const randomAmount = [10000, 20000, 50000, 100000][Math.floor(Math.random() * 4)];
    const textId = nextIdRef.current++;

    setTossedCoins((prev) => [...prev, { id: coinId, offset: randomOffset }]);
    setIsSquishing(true);
    setTimeout(() => setIsSquishing(false), 450);
    setCoinsSaved((prev) => prev + 1);

    setFloatingTexts((prev) => [
      ...prev,
      {
        id: textId,
        text: `+Rp ${randomAmount.toLocaleString('id-ID')} ✨`,
        offset: randomOffset
      }
    ]);

    if (coinsSaved % 3 === 0) {
      setTipIndex((prev) => (prev + 1) % SAVINGS_TIPS.length);
    }

    setTimeout(() => {
      setTossedCoins((prev) => prev.filter((c) => c.id !== coinId));
    }, 900);

    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((t) => t.id !== textId));
    }, 1200);
  };
  if (mode === 'balance') {
    return (
      <div
        className={`balance-mascot-widget ${className} ${isSquishing ? 'squish' : ''}`}
        onClick={handleTossCoin}
        role="button"
        tabIndex={0}
        title="Click the piggy bank to save a coin!"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleTossCoin();
          }
        }}
      >
        <div className="stream-coin stream-coin-1">
          <CoinIcon size={20} />
        </div>
        <div className="stream-coin stream-coin-2">
          <CoinIcon size={18} />
        </div>

        {tossedCoins.map((coin) => (
          <div
            key={coin.id}
            className="tossed-coin"
            style={{ '--coin-offset': `${coin.offset}px` }}
          >
            <CoinIcon size={24} />
          </div>
        ))}

        {floatingTexts.map((ft) => (
          <div
            key={ft.id}
            className="floating-reward-text"
            style={{ '--text-offset': `${ft.offset}px` }}
          >
            {ft.text}
          </div>
        ))}

        <div className="mascot-sparkles">
          <span className="sparkle s1">✨</span>
          <span className="sparkle s2">⭐</span>
          <span className="sparkle s3">💫</span>
        </div>

        <div className="mascot-character-wrapper">
          <img
            src="/pocket-logo.svg"
            alt="PocketPlan Piggy Bank"
            className="mascot-pocket-img"
          />
          <div className="mascot-shadow" />
        </div>

        <span className="balance-mascot-counter-pill" title={`${coinsSaved} coins saved`}>
          <CoinIcon size={14} />
          <span>{coinsSaved} coins</span>
        </span>
      </div>
    );
  }

  if (mode === 'widget') {
    return (
      <div className={`savings-mascot-card card ${className}`}>
        <div className="mascot-widget-header">
          <div className="mascot-widget-title-group">
            <span className="mascot-sparkle-badge">🪙 Smart Piggy Bank</span>
            <h3 className="mascot-card-title">Save Up Today!</h3>
          </div>
          <span className="mascot-coin-badge">
            <CoinIcon size={18} />
            <strong>{coinsSaved}</strong> coins
          </span>
        </div>

        <div className="mascot-widget-body">
          <div
            className={`mascot-interactive-area ${isSquishing ? 'squish' : ''}`}
            onClick={handleTossCoin}
            role="button"
            tabIndex={0}
            title="Click to save coins!"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleTossCoin();
              }
            }}
          >
            <div className="stream-coin stream-coin-1">
              <CoinIcon size={22} />
            </div>
            <div className="stream-coin stream-coin-2">
              <CoinIcon size={20} />
            </div>

            {tossedCoins.map((coin) => (
              <div
                key={coin.id}
                className="tossed-coin"
                style={{ '--coin-offset': `${coin.offset}px` }}
              >
                <CoinIcon size={26} />
              </div>
            ))}

            {floatingTexts.map((ft) => (
              <div
                key={ft.id}
                className="floating-reward-text"
                style={{ '--text-offset': `${ft.offset}px` }}
              >
                {ft.text}
              </div>
            ))}

            <div className="mascot-sparkles">
              <span className="sparkle s1">✨</span>
              <span className="sparkle s2">⭐</span>
              <span className="sparkle s3">💫</span>
            </div>

            <div className="mascot-character-wrapper">
              <img
                src="/pocket-logo.svg"
                alt="PocketPlan Piggy Bank"
                className="mascot-pocket-img"
              />
              <div className="mascot-shadow" />
            </div>
          </div>

          <div className="mascot-widget-info">
            <div className="mascot-tip-box">
              <span className="mascot-tip-icon">💡</span>
              <p className="mascot-tip-text">{SAVINGS_TIPS[tipIndex]}</p>
            </div>
            <button
              type="button"
              className="pill btn-primary mascot-toss-btn"
              onClick={handleTossCoin}
            >
              <CoinIcon size={18} />
              <span>Drop Coin 🪙</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`savings-hero-stage ${className}`}>
      <div className="savings-hero-glow" />

      <div className="hero-floating-badge badge-left">
        <span className="badge-icon">💰</span>
        <div>
          <div className="badge-title">Daily Savings</div>
          <div className="badge-sub">+Rp 50,000</div>
        </div>
      </div>

      <div className="hero-floating-badge badge-right">
        <span className="badge-icon">🎯</span>
        <div>
          <div className="badge-title">Goal Achieved</div>
          <div className="badge-sub">100% Completed!</div>
        </div>
      </div>

      <div
        className={`hero-mascot-center ${isSquishing ? 'squish' : ''}`}
        onClick={handleTossCoin}
        role="button"
        tabIndex={0}
        title="Click PocketPlan to toss golden coins!"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleTossCoin();
          }
        }}
      >
        <div className="loop-coin loop-coin-1">
          <CoinIcon size={34} />
        </div>
        <div className="loop-coin loop-coin-2">
          <CoinIcon size={28} />
        </div>
        <div className="loop-coin loop-coin-3">
          <CoinIcon size={30} />
        </div>

        {tossedCoins.map((coin) => (
          <div
            key={coin.id}
            className="tossed-coin"
            style={{ '--coin-offset': `${coin.offset}px` }}
          >
            <CoinIcon size={36} />
          </div>
        ))}

        {floatingTexts.map((ft) => (
          <div
            key={ft.id}
            className="floating-reward-text"
            style={{ '--text-offset': `${ft.offset}px` }}
          >
            {ft.text}
          </div>
        ))}

        <div className="hero-sparkles">
          <span className="sparkle s1">✨</span>
          <span className="sparkle s2">⭐</span>
          <span className="sparkle s3">💖</span>
          <span className="sparkle s4">✨</span>
        </div>

        <div className="hero-mascot-body">
          <img
            src="/pocket-logo.svg"
            alt="PocketPlan Savings Mascot"
            className="hero-mascot-img"
          />
          <div className="hero-mascot-shadow" />
        </div>

        <div className="hero-mascot-hint">
          <span>👆 Click me to drop coins!</span>
        </div>
      </div>

      <div className="hero-mascot-footer">
        <div className="hero-counter-pill">
          <CoinIcon size={20} />
          <span>
            <strong>{coinsSaved}</strong> coins safely saved in your piggy bank!
          </span>
        </div>

        <div className="hero-quote-card">
          <span className="quote-star">💡</span>
          <span className="quote-text">{SAVINGS_TIPS[tipIndex]}</span>
        </div>
      </div>
    </div>
  );
};

export default memo(SavingsMascot);

