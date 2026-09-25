import { useState, useMemo, memo } from 'react';

const MOTIVATIONAL_QUOTES = [
  'Every coin you save brings you closer to your dream! 🎯',
  'Great job! Keep up the consistent savings habit! 🌟',
  "It's never too late to start saving! 🚀",
  'Big goals are achieved one small step at a time! ✨',
  'Keep going! Your dreams will surely become reality! 🏖️',
  'Awesome job! A bright financial future awaits! 💰',
  'Step by step, small savings create giant leaps! ⛰️'
];

/**
 * Pure SVG Mascot "Koiny" - The Lucky Golden Coin Character
 * 100% GPU CSS compositor animations: float, eye blink, hand wave, star twinkle, click spin.
 */
export const KoinySvg = ({ size = 90, isSpinning = false, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`koiny-svg ${isSpinning ? 'koiny-spinning' : ''} ${className}`}
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="koinyGoldGrad" cx="42%" cy="38%" r="62%">
        <stop offset="0%" stopColor="#fffbeb" />
        <stop offset="28%" stopColor="#fde047" />
        <stop offset="68%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#d97706" />
      </radialGradient>
      <linearGradient id="koinyRimGrad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fef08a" />
        <stop offset="50%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>
      <linearGradient id="koinyStarGrad" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ffffff" />
        <stop offset="100%" stopColor="#fde047" />
      </linearGradient>
      <filter id="koinyCheekGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" />
      </filter>
    </defs>

    {/* Sparkle Stars */}
    <g className="koiny-sparkle koiny-sparkle-1">
      <path d="M20 18 Q23 18 24 14 Q25 18 28 19 Q25 20 24 24 Q23 20 20 19 Z" fill="url(#koinyStarGrad)" />
    </g>
    <g className="koiny-sparkle koiny-sparkle-2">
      <path d="M96 22 Q98 22 99 19 Q100 22 103 23 Q100 24 99 27 Q98 24 96 23 Z" fill="url(#koinyStarGrad)" />
    </g>

    {/* Hands */}
    <g className="koiny-hand koiny-hand-left">
      <ellipse cx="16" cy="62" rx="7" ry="5" fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" />
      <circle cx="13" cy="60" r="2.5" fill="#fde047" />
    </g>
    <g className="koiny-hand koiny-hand-right">
      <ellipse cx="104" cy="62" rx="7" ry="5" fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" />
      <circle cx="107" cy="60" r="2.5" fill="#fde047" />
    </g>

    {/* Coin Outer Shadow & Rim */}
    <circle cx="60" cy="62" r="43" fill="#78350f" opacity="0.25" />
    <circle cx="60" cy="60" r="42" fill="url(#koinyRimGrad)" stroke="#92400e" strokeWidth="2.2" />
    <circle cx="60" cy="60" r="37.5" fill="url(#koinyGoldGrad)" />
    <circle cx="60" cy="60" r="33" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeDasharray="4 3" opacity="0.65" />

    {/* Crown Tiara */}
    <g className="koiny-crown">
      <path d="M60 21 L63.5 28 L71 29 L65.5 34.5 L67 42 L60 38 L53 42 L54.5 34.5 L49 29 L56.5 28 Z" fill="url(#koinyStarGrad)" stroke="#d97706" strokeWidth="1" />
      <circle cx="60" cy="31" r="2" fill="#ffffff" />
    </g>

    {/* Cheeks Blush */}
    <ellipse cx="40" cy="68" rx="6" ry="3.5" fill="#fb7185" opacity="0.65" filter="url(#koinyCheekGlow)" />
    <ellipse cx="80" cy="68" rx="6" ry="3.5" fill="#fb7185" opacity="0.65" filter="url(#koinyCheekGlow)" />

    {/* Eyes */}
    <g className="koiny-eyes">
      <g className="koiny-eye-left">
        <ellipse cx="44" cy="55" rx="5.5" ry="7.5" fill="#311105" />
        <ellipse cx="42.5" cy="52.5" rx="2.4" ry="3.2" fill="#ffffff" />
        <circle cx="46.5" cy="58" r="1.3" fill="#ffffff" />
      </g>
      <g className="koiny-eye-right">
        <ellipse cx="76" cy="55" rx="5.5" ry="7.5" fill="#311105" />
        <ellipse cx="74.5" cy="52.5" rx="2.4" ry="3.2" fill="#ffffff" />
        <circle cx="78.5" cy="58" r="1.3" fill="#ffffff" />
      </g>
    </g>

    {/* Mouth */}
    <path d="M52 65 Q60 76 68 65 Q60 69 52 65 Z" fill="#451a03" stroke="#451a03" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M55 67 Q60 75 65 67 Q60 70 55 67 Z" fill="#f43f5e" />

    {/* Specular Highlight */}
    <path d="M34 40 A 30 30 0 0 1 70 31" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
  </svg>
);

const LuckyCoinMascot = ({
  mode = 'character',
  goals = [],
  balance = 0,
  message = '',
  className = ''
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [cheerCount, setCheerCount] = useState(0);
  const [floatingHeart, setFloatingHeart] = useState(false);

  const goalStats = useMemo(() => {
    if (!goals || goals.length === 0) return { total: 0, completed: 0, pct: 0 };
    const numBalance = Number(balance) || 0;
    const completed = goals.filter((g) => {
      const cur =
        g.current !== undefined && g.current !== null && g.current !== ''
          ? Number(g.current)
          : numBalance;
      const tgt = Number(g.target) || 1;
      return cur >= tgt;
    }).length;
    return {
      total: goals.length,
      completed,
      pct: Math.round((completed / goals.length) * 100)
    };
  }, [goals, balance]);

  const handleInteraction = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setFloatingHeart(true);
    setCheerCount((prev) => prev + 1);
    setQuoteIndex((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length);

    setTimeout(() => {
      setIsSpinning(false);
    }, 700);

    setTimeout(() => {
      setFloatingHeart(false);
    }, 1100);
  };

  // 1. Standalone Character
  if (mode === 'character') {
    return (
      <div
        className={`koiny-mascot-wrapper ${className}`}
        onClick={handleInteraction}
        role="button"
        tabIndex={0}
        title="Click Koiny for savings motivation!"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleInteraction();
          }
        }}
      >
        <div className="koiny-floating-container">
          <KoinySvg size={85} isSpinning={isSpinning} />
          {floatingHeart && <span className="koiny-heart-pop">💖 +1 Cheer!</span>}
        </div>
        <div className="koiny-ground-shadow" />
      </div>
    );
  }

  // 2. Empty State Mode (for Goals & Transactions tables)
  if (mode === 'empty') {
    return (
      <div className={`koiny-empty-state ${className}`}>
        <div
          className="koiny-empty-mascot-wrap"
          onClick={handleInteraction}
          role="button"
          tabIndex={0}
          title="Click Koiny for good vibes!"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleInteraction();
            }
          }}
        >
          <KoinySvg size={84} isSpinning={isSpinning} />
          {floatingHeart && <span className="koiny-heart-pop">✨ Keep Going!</span>}
          <div className="koiny-ground-shadow" />
        </div>
        <p className="empty-text">{message || 'No data recorded yet.'}</p>
        <p className="empty-sub">{MOTIVATIONAL_QUOTES[quoteIndex]}</p>
      </div>
    );
  }

  // 3. Goal Companion Hero Banner Mode
  const headline =
    goalStats.total === 0
      ? 'Make Your Dreams Happen!'
      : goalStats.completed === goalStats.total
      ? 'All Goals Achieved! 🏆'
      : `${goalStats.completed} of ${goalStats.total} Goals Achieved! 🎯`;

  const description =
    goalStats.total === 0
      ? 'Koiny is here to cheer you on toward your goals. Start today!'
      : MOTIVATIONAL_QUOTES[quoteIndex];

  return (
    <div className={`koiny-goals-banner card ${className}`}>
      <div
        className="koiny-banner-character-stage"
        onClick={handleInteraction}
        role="button"
        tabIndex={0}
        title="Click Koiny for extra motivation!"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleInteraction();
          }
        }}
      >
        <div className="koiny-floating-container">
          <KoinySvg size={92} isSpinning={isSpinning} />
          {floatingHeart && <span className="koiny-heart-pop">🌟 Keep It Up!</span>}
        </div>
        <div className="koiny-ground-shadow" />
        <span className="koiny-click-tag" aria-hidden="true">
          {cheerCount > 0 ? `✨ ${cheerCount}x Cheers` : 'Click Me! 🪙'}
        </span>
      </div>

      <div className="koiny-banner-content">
        <div className="koiny-banner-badge">
          <span className="badge-sparkle">⭐</span>
          <span>PocketPlan Goal Companion</span>
        </div>
        <h2 className="koiny-banner-title">{headline}</h2>
        <p className="koiny-banner-desc">{description}</p>

        <div className="koiny-banner-actions">
          <button
            type="button"
            className={`pill btn-secondary koiny-cheer-btn ${floatingHeart ? 'koiny-cheer-active' : ''}`}
            onClick={handleInteraction}
          >
            <span>{floatingHeart ? '🎉 High Five! ✨' : 'High Five Koiny ✋'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(LuckyCoinMascot);
