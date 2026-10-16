// Achievement Formatter Helper — Strictly protects financial privacy (NO NOMINALS)

export function formatAchievementItem(key, seenAtMap = {}, goalsMap = new Map()) {
  const unlockedAt = seenAtMap[key] || null;

  if (key.startsWith('streak_')) {
    const days = parseInt(key.replace('streak_', ''), 10) || 0;
    return {
      key,
      type: 'streak',
      title: `Streak ${days} Hari!`,
      subtitle: `${days} hari berturut-turut catat keuangan`,
      icon: '🔥',
      streakDays: days,
      unlockedAt
    };
  }

  if (key.startsWith('goal_')) {
    const parts = key.split('_');
    const pct = parseInt(parts[parts.length - 1], 10) || 0;
    const gId = parts.slice(1, -1).join('_');
    const goalName = goalsMap.get(gId) || 'Target';
    return {
      key,
      type: 'goal',
      title: `${goalName} — ${pct}%`,
      subtitle: 'Progres target tabunganmu!',
      icon: '🎯',
      percent: pct,
      unlockedAt
    };
  }

  return {
    key,
    type: 'badge',
    title: 'Pencapaian',
    subtitle: 'Lencana pencapaian finansial',
    icon: '🏅',
    unlockedAt
  };
}
