import assert from 'assert';
import { formatAchievementItem } from './achievementHelper.js';

console.log('Running Achievement unit tests...');

// 1. Streak item
const s = formatAchievementItem('streak_7', { streak_7: '2026-10-10T12:00:00.000Z' });
assert.strictEqual(s.title, 'Streak 7 Hari!');
assert.strictEqual(s.icon, '🔥');
assert.strictEqual(s.unlockedAt, '2026-10-10T12:00:00.000Z');

// 2. Goal item
const goalsMap = new Map([['g1', 'Dana Darurat']]);
const g = formatAchievementItem('goal_g1_50', {}, goalsMap);
assert.strictEqual(g.title, 'Dana Darurat — 50%');
assert.strictEqual(g.percent, 50);
assert.strictEqual(g.unlockedAt, null);

// 3. Challenge items
const cw = formatAchievementItem('challenge_win_123');
assert.strictEqual(cw.title, 'Pemenang Tantangan');
assert.strictEqual(cw.icon, '🏆');

// 4. Unknown item
const unk = formatAchievementItem('custom_badge_xyz');
assert.strictEqual(unk.title, 'Pencapaian');

// 5. PRIVACY TEST: Ensure absolutely NO rupiah, currency symbols, or balances exist in output
const allItems = [s, g, cw, unk];
const rawString = JSON.stringify(allItems);
assert.ok(!rawString.includes('Rp'), 'Must not contain Rp');
assert.ok(!rawString.includes('balance'), 'Must not contain balance');
assert.ok(!rawString.includes('nominal'), 'Must not contain nominal');
assert.ok(!rawString.includes('amount'), 'Must not contain amount');

console.log('All Achievement unit tests passed! ✅');
