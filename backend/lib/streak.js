// Streak helper — tracks consecutive days with ≥1 transaction (Asia/Jakarta timezone)

function todayWib() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

/**
 * updateStreak(uid, db) — recompute streak from transaction dates, save to user doc.
 * Returns { currentStreak, longestStreak, lastStreakDate, broken, milestone }.
 * `broken` = true if gap detected (streak was >0 and now resets).
 * `milestone` = number if a new milestone was hit (3,7,14,30,60,100), else null.
 */
export async function updateStreak(uid, db) {
  if (!uid || !db) return { currentStreak: 0, longestStreak: 0, lastStreakDate: null, broken: false, milestone: null };

  const userRef = db.collection('users').doc(uid);
  const [userDoc, txSnap] = await Promise.all([
    userRef.get(),
    userRef.collection('transactions').get()
  ]);
  const userData = userDoc.data() || {};

  // Collect unique transaction dates
  const dateSet = new Set();
  txSnap.forEach(d => {
    const date = d.data()?.date;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) dateSet.add(date);
  });

  const today = todayWib();
  const dates = [...dateSet].sort().reverse(); // newest first

  // Compute streak from today backwards
  let streak = 0;
  if (dates.includes(today)) {
    streak = 1;
    // Use WIB-safe date arithmetic
    const baseDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    for (let i = 1; i < 400; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dates.includes(ds)) {
        streak++;
      } else {
        break;
      }
    }
  }

  const prevStreak = userData.currentStreak || 0;
  const prevLastDate = userData.lastStreakDate || null;
  const longestStreak = Math.max(streak, userData.longestStreak || 0);

  // Detect broken streak: had active streak, gap > 1 day, now starting fresh
  let broken = false;
  if (prevLastDate && prevStreak > 0 && streak <= 1) {
    const prevDate = new Date(prevLastDate + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    const diffDays = Math.round((todayDate - prevDate) / (24 * 60 * 60 * 1000));
    if (diffDays > 1) broken = true;
  }

  // Detect milestone
  const milestones = [3, 7, 14, 30, 60, 100];
  const seen = userData.streakMilestonesSeen || [];
  let milestone = null;
  if (milestones.includes(streak) && !seen.includes(streak)) {
    milestone = streak;
    seen.push(streak);
  }

  // Reset milestones seen if streak broke (so they can re-earn)
  const finalSeen = broken ? [] : seen;

  await userRef.set({
    currentStreak: streak,
    longestStreak,
    lastStreakDate: today,
    streakMilestonesSeen: milestone ? [...finalSeen] : finalSeen
  }, { merge: true });

  return { currentStreak: streak, longestStreak, lastStreakDate: today, broken, milestone };
}
