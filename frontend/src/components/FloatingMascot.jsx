import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { SMART_TIPS } from '../utils/smartTips.js';

export { SMART_TIPS };

export const PockySvg = memo(({ isWaving = false, isSquishing = false }) => (
  <svg
    width="68"
    height="72"
    viewBox="0 0 68 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`pocky-svg ${isSquishing ? 'squish' : ''}`}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="pockyBodyGrad" x1="14" y1="18" x2="54" y2="66" gradientUnits="userSpaceOnUse">
        <stop stopColor="#34d399" />
        <stop offset="0.45" stopColor="#10b981" />
        <stop offset="1" stopColor="#047857" />
      </linearGradient>

      <linearGradient id="pockyRimGrad" x1="12" y1="20" x2="56" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6ee7b7" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>

      <linearGradient id="pockyCoinGrad" x1="24" y1="6" x2="44" y2="26" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fef08a" />
        <stop offset="0.45" stopColor="#facc15" />
        <stop offset="1" stopColor="#d97706" />
      </linearGradient>

      <filter id="pockyCheekGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.2" />
      </filter>
    </defs>

    {/* Ground Soft Shadow */}
    <ellipse cx="34" cy="68" rx="20" ry="3.5" fill="rgba(0,0,0,0.16)" className="pocky-shadow" />

    {/* Main Floating Character Group */}
    <g className="pocky-float-group">
      {/* Peeking Golden Coin */}
      <g className="pocky-coin-peek">
        <circle cx="34" cy="17" r="11" fill="url(#pockyCoinGrad)" stroke="#b45309" strokeWidth="1.2" />
        <circle cx="34" cy="17" r="8.5" fill="none" stroke="#fef08a" strokeWidth="0.9" strokeDasharray="2 1.5" />
        <path
          d="M34 11 L35.2 15 L39.5 15.5 L36.2 18.2 L37.2 22.5 L34 20.2 L30.8 22.5 L31.8 18.2 L28.5 15.5 L32.8 15 Z"
          fill="#ffffff"
          opacity="0.9"
        />
        <circle cx="31.5" cy="16.5" r="0.9" fill="#78350f" />
        <circle cx="36.5" cy="16.5" r="0.9" fill="#78350f" />
        <path d="M33 18.2 Q34 19.4 35 18.2" stroke="#78350f" strokeWidth="0.8" strokeLinecap="round" />
      </g>

      {/* Left Tiny Arm */}
      <path
        d="M13 37 C10 39, 8 44, 11 47 C14 49, 16 45, 15 41 Z"
        fill="#059669"
        stroke="#047857"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Right Waving Arm */}
      <g className={`pocky-arm-right ${isWaving ? 'is-waving' : ''}`}>
        <path
          d="M53 38 C57 36, 62 31, 60 26 C57 24, 53 29, 51 34 Z"
          fill="#10b981"
          stroke="#047857"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <circle cx="59.5" cy="27.5" r="2.2" fill="#34d399" />
      </g>

      {/* Pocket Body */}
      <path
        d="M15 25 C15 19, 21 16, 28 16 L40 16 C47 16, 53 19, 53 25 L53 46 C53 58, 44 65, 34 65 C24 65, 15 58, 15 46 Z"
        fill="url(#pockyBodyGrad)"
        stroke="#047857"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Decorative Stitching Pattern */}
      <path
        d="M19 28 L19 46 C19 54, 26 60, 34 60 C42 60, 49 54, 49 46 L49 28"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1"
        strokeDasharray="2.5 2"
      />

      {/* Pocket Fold Rim */}
      <path
        d="M13 24 C13 20.5, 18 19, 24 19 L44 19 C50 19, 55 20.5, 55 24 C55 27.5, 50 28, 44 28 L24 28 C18 28, 13 27.5, 13 24 Z"
        fill="url(#pockyRimGrad)"
        stroke="#047857"
        strokeWidth="1.2"
      />

      {/* Zipper Pull */}
      <circle cx="34" cy="28.5" r="2.2" fill="#facc15" stroke="#b45309" strokeWidth="0.8" />

      {/* Cheeks */}
      <circle cx="23" cy="41" r="2.8" fill="#fb7185" opacity="0.85" filter="url(#pockyCheekGlow)" />
      <circle cx="45" cy="41" r="2.8" fill="#fb7185" opacity="0.85" filter="url(#pockyCheekGlow)" />

      {/* Kawaii Eyes */}
      <g className="pocky-eyes">
        <ellipse cx="27" cy="36.5" rx="3.2" ry="4.2" fill="#0f172a" className="pocky-pupil" />
        <circle cx="28.2" cy="35" r="1.4" fill="#ffffff" />
        <circle cx="26" cy="38" r="0.7" fill="#ffffff" />

        <ellipse cx="41" cy="36.5" rx="3.2" ry="4.2" fill="#0f172a" className="pocky-pupil" />
        <circle cx="42.2" cy="35" r="1.4" fill="#ffffff" />
        <circle cx="40" cy="38" r="0.7" fill="#ffffff" />
      </g>

      {/* Happy Smile */}
      <path
        d="M31 43.5 Q34 47.5 37 43.5"
        fill="none"
        stroke="#0f172a"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Floating Sparkles */}
      <g className="pocky-sparkles">
        <text x="6" y="24" fontSize="9" fill="#facc15" className="pocky-sparkle-1">✨</text>
        <text x="52" y="16" fontSize="8" fill="#38bdf8" className="pocky-sparkle-2">⭐</text>
      </g>
    </g>
  </svg>
));

const FloatingMascot = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('pocketplan_pocky_collapsed') === 'true';
  });
  const [tipIndex, setTipIndex] = useState(0);
  const [isWaving, setIsWaving] = useState(false);
  const [isSquishing, setIsSquishing] = useState(false);
  const [particles, setParticles] = useState([]);
  const [bubbleText, setBubbleText] = useState('Need a tip? 💡');
  const [showBubble, setShowBubble] = useState(true);
  const nextParticleId = useRef(1);
  const popoverRef = useRef(null);

  useEffect(() => {
    const waveTimer = setInterval(() => {
      setIsWaving(true);
      setTimeout(() => setIsWaving(false), 1400);
    }, 8000);
    return () => clearInterval(waveTimer);
  }, []);

  useEffect(() => {
    const idleBubbles = [
      'Need a tip? 💡',
      'Save smart! ✨',
      'Pocky is here! 🟢',
      'Every coin counts! 🪙',
      'Bright future ahead! 🚀'
    ];
    let idx = 0;
    const bubbleTimer = setInterval(() => {
      if (!isOpen && !isCollapsed) {
        idx = (idx + 1) % idleBubbles.length;
        setBubbleText(idleBubbles[idx]);
        setShowBubble(true);
      }
    }, 9000);
    return () => clearInterval(bubbleTimer);
  }, [isOpen, isCollapsed]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('pocketplan_pocky_collapsed', String(next));
      if (next) setIsOpen(false);
      return next;
    });
  }, []);

  const triggerCoinBurst = useCallback(() => {
    setIsSquishing(true);
    setTimeout(() => setIsSquishing(false), 400);

    const burstItems = ['🪙', '✨', '⭐', '💫', '💰'];
    const newItems = Array.from({ length: 4 }).map((_, i) => ({
      id: nextParticleId.current++,
      symbol: burstItems[Math.floor(Math.random() * burstItems.length)],
      offsetX: (Math.random() - 0.5) * 60,
      offsetY: -35 - Math.random() * 40,
      delay: i * 0.08
    }));

    setParticles((prev) => [...prev, ...newItems]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newItems.some((n) => n.id === p.id)));
    }, 1200);
  }, []);

  const handleMascotClick = useCallback(() => {
    triggerCoinBurst();
    setIsOpen((prev) => !prev);
    setShowBubble(false);
  }, [triggerCoinBurst]);

  const handleNextTip = useCallback(() => {
    setTipIndex((prev) => (prev + 1) % SMART_TIPS.length);
    triggerCoinBurst();
  }, [triggerCoinBurst]);

  const handleScrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    triggerCoinBurst();
  }, [triggerCoinBurst]);

  const isAuthRoute = ['/login', '/register', '/verification'].includes(location.pathname);
  if (isAuthRoute) return null;
  return (
    <aside
      className={`floating-mascot-container ${isCollapsed ? 'is-collapsed' : ''}`}
      ref={popoverRef}
      aria-label="Pocky financial assistant"
    >
      {isCollapsed ? (
        <button
          type="button"
          className="pocky-collapsed-pill"
          onClick={toggleCollapse}
          title="Open Pocky the Pocket Companion"
          aria-label="Open Pocky the Pocket Companion"
        >
          <span className="pocky-collapsed-icon">🪙</span>
          <span className="pocky-collapsed-label">Pocky</span>
          <span className="pocky-collapsed-sparkle">✨</span>
        </button>
      ) : (
        <>
          {showBubble && !isOpen && (
            <div
              className="pocky-speech-bubble"
              onClick={() => setIsOpen(true)}
              role="status"
            >
              <span>{bubbleText}</span>
              <button
                type="button"
                className="pocky-bubble-close"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBubble(false);
                }}
                aria-label="Dismiss speech bubble"
              >
                ×
              </button>
            </div>
          )}

          {isOpen && (
            <div className="pocky-popover-card card" role="dialog" aria-labelledby="pocky-title">
              <div className="pocky-popover-header">
                <div className="pocky-header-left">
                  <span className="pocky-status-dot" />
                  <div>
                    <h4 id="pocky-title" className="pocky-name">Pocky</h4>
                    <span className="pocky-tag">Pocket Companion</span>
                  </div>
                </div>
                <div className="pocky-header-actions">
                  <button
                    type="button"
                    className="pocky-icon-btn"
                    onClick={toggleCollapse}
                    title="Minimize Pocky"
                    aria-label="Minimize Pocky"
                  >
                    _
                  </button>
                  <button
                    type="button"
                    className="pocky-icon-btn"
                    onClick={() => setIsOpen(false)}
                    title="Close"
                    aria-label="Close dialog"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="pocky-popover-body">
                <div className="pocky-tip-box">
                  <div className="pocky-tip-badge">
                    <span>💡 Smart Savings Tip</span>
                    <span className="pocky-tip-counter">#{tipIndex + 1}/{SMART_TIPS.length}</span>
                  </div>
                  <p className="pocky-tip-text">{SMART_TIPS[tipIndex]}</p>
                </div>

                <div className="pocky-quick-actions">
                  <button
                    type="button"
                    className="pill small btn-primary pocky-action-btn"
                    onClick={handleNextTip}
                  >
                    <span>Next Tip 🎲</span>
                  </button>
                  <button
                    type="button"
                    className="pill small btn-secondary pocky-action-btn"
                    onClick={handleScrollTop}
                    title="Scroll smoothly to the top of the page"
                  >
                    <span>Scroll Top ⬆️</span>
                  </button>
                </div>
              </div>

              <div className="pocky-popover-footer">
                <span>Smart Saving, Brighter Future ✨</span>
              </div>
            </div>
          )}

          {particles.map((p) => (
            <div
              key={p.id}
              className="pocky-burst-particle"
              style={{
                '--burst-x': `${p.offsetX}px`,
                '--burst-y': `${p.offsetY}px`,
                animationDelay: `${p.delay}s`
              }}
            >
              {p.symbol}
            </div>
          ))}

          <button
            type="button"
            className="pocky-trigger-btn"
            onClick={handleMascotClick}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            title="Click Pocky for smart tips and savings power!"
          >
            <PockySvg isWaving={isWaving} isSquishing={isSquishing} />
          </button>
        </>
      )}
    </aside>
  );
};

export default memo(FloatingMascot);

