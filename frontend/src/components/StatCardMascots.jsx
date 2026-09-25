import React, { memo } from 'react';

/**
 * Income Mascot: "Pundi" (The Joyful Lucky Sprout / Tunas Cuan)
 * Pure lightweight SVG character with waving leaf, floating gold coin, and smiling face.
 * 60 FPS GPU-accelerated CSS compositor animation.
 */
export const IncomeMascot = memo(({ size = 80, className = '' }) => (
  <div className={`stat-mascot income-mascot-wrap ${className}`} title="Pundi: Your savings are growing strong! 🌱">
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="stat-mascot-svg pundi-svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="pundiPotGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
        <linearGradient id="pundiLeafGrad" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#86efac" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
        <linearGradient id="pundiCoinGrad" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffffff" />
          <stop offset="35%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <filter id="pundiCheekGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1" />
        </filter>
      </defs>

      {/* Ground Soft Shadow */}
      <ellipse cx="32" cy="58" rx="18" ry="3.5" fill="rgba(0,0,0,0.12)" className="pundi-shadow" />

      {/* Floating Sparkle Coin */}
      <g className="pundi-floating-coin">
        <circle cx="32" cy="11" r="7" fill="url(#pundiCoinGrad)" stroke="#b45309" strokeWidth="1" />
        <circle cx="32" cy="11" r="5.2" fill="none" stroke="#fef08a" strokeWidth="0.8" strokeDasharray="2 1.2" />
        <path d="M32 7.5v7M30 9.2h4a1 1 0 0 1 0 2h-4a1 1 0 0 0 0 2h4" stroke="#78350f" strokeWidth="1" strokeLinecap="round" />
        <path d="M42 9 Q44 9 44.5 7 Q45 9 47 9.5 Q45 10 44.5 12 Q44 10 42 9.5 Z" fill="#facc15" className="pundi-sparkle" />
      </g>

      {/* Sprout Stem */}
      <path d="M32 38 Q32 26 32 20" stroke="#15803d" strokeWidth="3" strokeLinecap="round" />

      {/* Left Leaf */}
      <path
        d="M32 26 C24 23 20 28 21 34 C25 35 30 32 32 26 Z"
        fill="url(#pundiLeafGrad)"
        stroke="#15803d"
        strokeWidth="1.2"
        className="pundi-leaf pundi-leaf-left"
      />

      {/* Right Leaf */}
      <path
        d="M32 22 C40 19 44 24 43 30 C39 31 34 28 32 22 Z"
        fill="url(#pundiLeafGrad)"
        stroke="#15803d"
        strokeWidth="1.2"
        className="pundi-leaf pundi-leaf-right"
      />

      {/* Golden Pot / Piggy Planter */}
      <path
        d="M20 37 H44 L41 53 C40.5 55.5 38.5 56.5 32 56.5 C25.5 56.5 23.5 55.5 23 53 Z"
        fill="url(#pundiPotGrad)"
        stroke="#92400e"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect x="18" y="34.5" width="28" height="5" rx="2.5" fill="#fef08a" stroke="#92400e" strokeWidth="1.5" />

      {/* Cute Anime Face on Pot */}
      <circle cx="25" cy="46" r="2.2" fill="#fb7185" opacity="0.75" filter="url(#pundiCheekGlow)" />
      <circle cx="39" cy="46" r="2.2" fill="#fb7185" opacity="0.75" filter="url(#pundiCheekGlow)" />
      <g className="pundi-eyes">
        <path d="M26 43 Q28 40.5 30 43" stroke="#451a03" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M34 43 Q36 40.5 38 43" stroke="#451a03" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </g>
      <path d="M30 47 Q32 50 34 47" stroke="#451a03" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  </div>
));

/**
 * Expense Mascot: "Hematy" (The Savvy Budget Guardian Owl)
 * Pure lightweight SVG character with round glasses, tiny receipt ledger, and calm gentle breathing animation.
 * 60 FPS GPU-accelerated CSS compositor animation.
 */
export const ExpenseMascot = memo(({ size = 80, className = '' }) => (
  <div className={`stat-mascot expense-mascot-wrap ${className}`} title="Hematy: Expenses tracked and budget under control! 🦉">
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="stat-mascot-svg hematy-svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="hematyBodyGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fed7aa" />
          <stop offset="50%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#c2410c" />
        </radialGradient>
        <radialGradient id="hematyBellyGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#ffedd5" />
        </radialGradient>
        <filter id="hematyCheekGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1" />
        </filter>
      </defs>

      {/* Ground Soft Shadow */}
      <ellipse cx="32" cy="58" rx="16" ry="3.5" fill="rgba(0,0,0,0.12)" className="hematy-shadow" />

      {/* Body & Ears */}
      <g className="hematy-body-group">
        <path d="M22 23 L18 15 L26 19 Z" fill="#c2410c" stroke="#7c2d12" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M42 23 L46 15 L38 19 Z" fill="#c2410c" stroke="#7c2d12" strokeWidth="1.2" strokeLinejoin="round" />
        <ellipse cx="32" cy="38" rx="18" ry="19" fill="url(#hematyBodyGrad)" stroke="#7c2d12" strokeWidth="1.6" />
        <ellipse cx="32" cy="42" rx="12" ry="12.5" fill="url(#hematyBellyGrad)" />

        {/* Cheeks */}
        <circle cx="21" cy="38" r="2.2" fill="#fb7185" opacity="0.75" filter="url(#hematyCheekGlow)" />
        <circle cx="43" cy="38" r="2.2" fill="#fb7185" opacity="0.75" filter="url(#hematyCheekGlow)" />

        {/* Smart Round Glasses */}
        <g className="hematy-glasses">
          <path d="M29 32 H35" stroke="#0369a1" strokeWidth="1.6" />
          <circle cx="25" cy="32" r="6" fill="rgba(224, 242, 254, 0.45)" stroke="#0284c7" strokeWidth="1.8" />
          <path d="M22 30 Q24 28 26 29" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
          <circle cx="39" cy="32" r="6" fill="rgba(224, 242, 254, 0.45)" stroke="#0284c7" strokeWidth="1.8" />
          <path d="M36 30 Q38 28 40 29" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
          <circle cx="25" cy="32" r="2.2" fill="#1e293b" className="hematy-pupil" />
          <circle cx="24.2" cy="31.2" r="0.8" fill="#ffffff" />
          <circle cx="39" cy="32" r="2.2" fill="#1e293b" className="hematy-pupil" />
          <circle cx="38.2" cy="31.2" r="0.8" fill="#ffffff" />
        </g>

        {/* Tiny Beak */}
        <polygon points="32,34 30,37 34,37" fill="#fbbf24" stroke="#d97706" strokeWidth="0.8" />
        {/* Feet */}
        <ellipse cx="27" cy="56" rx="3" ry="1.8" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
        <ellipse cx="37" cy="56" rx="3" ry="1.8" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />

        {/* Left Wing */}
        <path d="M15 36 Q11 42 16 48 Q17 41 15 36 Z" fill="#ea580c" stroke="#7c2d12" strokeWidth="1.2" />

        {/* Right Wing with Receipt */}
        <g className="hematy-receipt-arm">
          <g className="hematy-receipt">
            <rect x="41" y="36" width="12" height="15" rx="1.5" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.8" />
            <line x1="43" y1="39" x2="49" y2="39" stroke="#cbd5e1" strokeWidth="1" strokeLinecap="round" />
            <line x1="43" y1="42" x2="47" y2="42" stroke="#cbd5e1" strokeWidth="1" strokeLinecap="round" />
            <path d="M47 47 C47 45.5 45 45.5 45 47 C45 48.2 47 49.5 47 49.5 C47 49.5 49 48.2 49 47 C49 45.5 47 45.5 47 47 Z" fill="#ef4444" />
          </g>
          <path d="M46 41 Q50 44 45 49 Q43 45 46 41 Z" fill="#ea580c" stroke="#7c2d12" strokeWidth="1.2" />
        </g>
      </g>
    </svg>
  </div>
));
