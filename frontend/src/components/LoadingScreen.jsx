const LoadingScreen = ({ message = 'Preparing your financial data...' }) => (
  <div className="loading-screen" role="status" aria-live="polite">
    <div className="loading-card card">
      <div className="loading-mascot-box">
        <span className="loading-mascot-coin" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="url(#loadingCoinGrad)" stroke="#b45309" strokeWidth="1.6" />
            <circle cx="12" cy="12" r="7.5" fill="#fde047" stroke="#fef08a" strokeWidth="1" strokeDasharray="3 2" />
            <path
              d="M12 7.5v9M9.5 9.5h5a1.5 1.5 0 0 1 0 3h-5a1.5 1.5 0 0 0 0 3h5"
              stroke="#78350f"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="loadingCoinGrad" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="#fef08a" />
                <stop offset="0.45" stopColor="#facc15" />
                <stop offset="1" stopColor="#d97706" />
              </linearGradient>
            </defs>
          </svg>
        </span>
        <img
          src="/pocket-logo.svg"
          alt="PocketPlan Logo"
          className="loading-mascot-logo"
        />
        <div className="loading-mascot-shadow" />
      </div>
      <div className="loading-progress-bar">
        <div className="loading-progress-fill" />
      </div>
      <span className="loading-text">{message}</span>
      <span className="loading-subtext">Smart Saving, Brighter Future ✨</span>
    </div>
  </div>
);

export default LoadingScreen;
