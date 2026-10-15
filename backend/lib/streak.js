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
  const baseDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const yesterdayObj = new Date(baseDate);
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterday = `${yesterdayObj.getFullYear()}-${String(yesterdayObj.getMonth() + 1).padStart(2, '0')}-${String(yesterdayObj.getDate()).padStart(2, '0')}`;

  // Compute streak: consecutive days ending today or yesterday
  let streak = 0;
  if (dateSet.has(today)) {
    streak = 1;
    for (let i = 1; i < 400; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dateSet.has(ds)) {
        streak++;
      } else {
        break;
      }
    }
  } else if (dateSet.has(yesterday)) {
    streak = 1;
    for (let i = 2; i < 400; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dateSet.has(ds)) {
        streak++;
      } else {
        break;
      }
    }
  }

  const prevStreak = userData.currentStreak || 0;
  const prevLastDate = userData.lastStreakDate || null;
  const longestStreak = Math.max(streak, userData.longestStreak || 0);

  // Detect broken streak: had active streak and now reset to 0 or restarted at 1 after gap
  let broken = false;
  if (prevStreak > 0 && streak === 0) {
    broken = true;
  } else if (prevLastDate && prevStreak > 0 && streak === 1 && !dateSet.has(yesterday)) {
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
