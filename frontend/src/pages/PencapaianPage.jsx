import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useData } from '../providers/DataProvider.jsx';
import { getAuthToken } from '../services/firebase.js';

const KNOWN_STREAKS = [3, 7, 14, 30, 60, 100];
const GOAL_MILESTONES = [25, 50, 75, 100];

const DEMO_ACHIEVEMENTS = [
  {
    key: 'streak_3',
    type: 'streak',
    title: '🔥 3-Day Streak!',
    subtitle: '3 consecutive days of financial tracking',
    icon: '🔥',
    streakDays: 3,
    unlockedAt: '2026-10-01T10:00:00.000Z'
  },
  {
    key: 'streak_7',
    type: 'streak',
    title: '🔥 7-Day Streak!',
    subtitle: '7 consecutive days of financial tracking',
    icon: '🔥',
    streakDays: 7,
    unlockedAt: '2026-10-07T10:00:00.000Z'
  },
  {
    key: 'goal_g-demo-1_50',
    type: 'goal',
    title: '🎯 New Bike — 50%',
    subtitle: 'Savings milestone achieved!',
    icon: '🎯',
    percent: 50,
    unlockedAt: '2026-10-12T14:30:00.000Z'
  }
];

function formatDate(isoStr) {
  if (!isoStr) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(isoStr));
  } catch {
    return null;
  }
}

const PencapaianPage = () => {
  const { user, isDemo } = useAuth();
  const { goals, showToast } = useData();
  const [unlockedBadges, setUnlockedBadges] = useState(isDemo ? DEMO_ACHIEVEMENTS : []);
  const [loading, setLoading] = useState(!isDemo);
  const [downloadingKey, setDownloadingKey] = useState(null);

  useEffect(() => {
    document.title = 'Achievements & Milestones — Pocketplan';
  }, []);

  useEffect(() => {
    if (isDemo) {
      setUnlockedBadges(DEMO_ACHIEVEMENTS);
      setLoading(false);
      return;
    }

    let active = true;
    async function fetchAchievements() {
      setLoading(true);
      try {
        const token = await getAuthToken();
        if (!token) {
          if (active) setUnlockedBadges([]);
          return;
        }
        const res = await fetch('/api/achievements', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('API achievements error');
        const data = await res.json();
        if (active) setUnlockedBadges(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Fetch achievements error:', err);
        if (active) setUnlockedBadges([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchAchievements();
    return () => { active = false; };
  }, [isDemo]);

  // Compute locked badges
  const lockedBadges = useMemo(() => {
    const list = [];
    for (const s of KNOWN_STREAKS) {
      const key = `streak_${s}`;
      if (!unlockedBadges.some((b) => b.key === key)) {
        list.push({
          key,
          type: 'streak',
          title: `${s}-Day Streak`,
          subtitle: `Log transactions ${s} days in a row`,
          icon: '🔒'
        });
      }
    }
    for (const g of (goals || [])) {
      for (const m of GOAL_MILESTONES) {
        const key = `goal_${g.id}_${m}`;
        if (!unlockedBadges.some((b) => b.key === key)) {
          list.push({
            key,
            type: 'goal',
            title: `${g.name || 'Goal'} — ${m}%`,
            subtitle: `Save up to reach ${m}% of your target`,
            icon: '🎯'
          });
        }
      }
    }
    return list;
  }, [unlockedBadges, goals]);

  const handleDownload = async (badge) => {
    setDownloadingKey(badge.key);
    try {
      const token = await getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/achievements/${badge.key}/card.png`, { headers });
      if (!res.ok) throw new Error('Failed to download card');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `achievement-${badge.key}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Achievement card downloaded! 🎉');
    } catch (err) {
      console.error('Download card error:', err);
      showToast('Failed to download achievement card.', 'error');
    } finally {
      setDownloadingKey(null);
    }
  };
  return (
    <div className="pencapaian-container">
      <div className="pencapaian-header">
        <h1 className="pencapaian-title">Achievements Gallery</h1>
        <p className="pencapaian-subtitle">
          Your collection of financial consistency badges and savings milestones earned with Pocky.
        </p>
      </div>

      <div className="pencapaian-stats-bar">
        <div className="pencapaian-stat-item">
          <div className="pencapaian-stat-icon">🏅</div>
          <div>
            <div className="pencapaian-stat-val">{unlockedBadges.length}</div>
            <div className="pencapaian-stat-lbl">Unlocked Badges</div>
          </div>
        </div>
        <div className="pencapaian-stat-item">
          <div className="pencapaian-stat-icon">🔒</div>
          <div>
            <div className="pencapaian-stat-val">{lockedBadges.length}</div>
            <div className="pencapaian-stat-lbl">Locked Milestones</div>
          </div>
        </div>
      </div>

      {!loading && unlockedBadges.length === 0 && (
        <div className="pencapaian-empty">
          <div className="pencapaian-empty-icon">🌱</div>
          <h3>No Unlocked Badges Yet</h3>
          <p>
            Log your finances for 3 consecutive days to unlock your first badge! 🔥
          </p>
        </div>
      )}

      {unlockedBadges.length > 0 && (
        <>
          <h2 className="pencapaian-sec-title">
            <span>✨</span> Unlocked Badges ({unlockedBadges.length})
          </h2>
          <div className="pencapaian-grid">
            {unlockedBadges.map((b) => {
              const formattedDate = formatDate(b.unlockedAt);
              const isDownloading = downloadingKey === b.key;
              return (
                <div key={b.key} className="badge-card">
                  <div className="badge-card-top">
                    <div className="badge-icon-box">{b.icon || '🏅'}</div>
                    <span className="badge-status-pill unlocked">Unlocked</span>
                  </div>
                  <h3 className="badge-title">{b.title}</h3>
                  <p className="badge-subtitle">{b.subtitle}</p>
                  {formattedDate && (
                    <div className="badge-date">Unlocked on {formattedDate}</div>
                  )}
                  <div className="badge-actions">
                    <button
                      type="button"
                      className="btn-download-card"
                      onClick={() => handleDownload(b)}
                      disabled={isDownloading}
                    >
                      {isDownloading ? 'Downloading...' : '📥 Download Card'}
                    </button>
                    <div className="badge-share-hint">
                      Save or share anywhere 🎉
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {lockedBadges.length > 0 && (
        <>
          <h2 className="pencapaian-sec-title">
            <span>🔒</span> Upcoming Milestones ({lockedBadges.length})
          </h2>
          <div className="pencapaian-grid">
            {lockedBadges.map((b) => (
              <div key={b.key} className="badge-card locked">
                <div className="badge-card-top">
                  <div className="badge-icon-box">{b.icon}</div>
                  <span className="badge-status-pill locked">Locked</span>
                </div>
                <h3 className="badge-title">{b.title}</h3>
                <p className="badge-subtitle">{b.subtitle}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PencapaianPage;

