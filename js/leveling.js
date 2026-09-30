/* leveling.js: XP → levels, streaks, and bonuses. Pure functions (no screen or storage code),
   which is what lets tests/ check them. `days` is always { 'YYYY-MM-DD': [entries] }.

   An entry looks like:
   { id, ts, a:activityId|null, n:name, t:treeId, x:xp, k:'log'|'custom'|'bonus'|'quest', b?:bonusKey, q?:quantity, bf?:1 }  */
import { W, TREES, STREAK_MIN } from './config.js';
import { addDays } from './dates.js';

/* ---------- levels ---------- */
export const overallCost = L => W[Math.min(4, Math.floor((L - 1) / 20))];
export function levelOf(xp, costFn, max) {
  let L = 1, rem = xp;
  while (L < max) { const c = costFn(L); if (rem >= c) { rem -= c; L++; } else return { L, into: rem, need: c, maxed: false }; }
  return { L: max, into: 0, need: 0, maxed: true };
}
export const tierIdx = L => Math.min(4, Math.floor((L - 1) / 20));   // 0-4 → Tier I-V
export const rankIdx = L => Math.min(4, Math.floor((L - 1) / 10));   // 0-4 → tree rank
export const treeCostFn = t => L => t.costs[rankIdx(L)];
export const pctOf = s => s.maxed ? 100 : s.into / s.need * 100;

/* ---------- entries ---------- */
export const isAuto = e => e.k === 'bonus' || e.k === 'quest';   // XP the game adds on its own
export const qty = e => e.q || 1;
export function allEntries(days) { const out = []; for (const d in days) for (const e of days[d]) out.push(e); return out; }

export function snapshot(days) {
  let total = 0; const tx = {}; TREES.forEach(t => tx[t.id] = 0);
  for (const d in days) for (const e of days[d]) { total += e.x; if (tx[e.t] !== undefined) tx[e.t] += e.x; }
  const o = levelOf(total, overallCost, 100), trees = {};
  TREES.forEach(t => { trees[t.id] = Object.assign(levelOf(tx[t.id], treeCostFn(t), 50), { xp: tx[t.id] }); });
  return { total, o, trees };
}

/* ---------- daily totals and streaks ---------- */
export const dayBase = (days, date) => (days[date] || []).reduce((s, e) => s + (isAuto(e) ? 0 : e.x), 0);  // bonuses don't count toward streaks
export const dayTotal = (days, date) => (days[date] || []).reduce((s, e) => s + e.x, 0);
export function streakEnding(days, date) { let n = 0, d = date; while (dayBase(days, d) >= STREAK_MIN) { n++; d = addDays(d, -1); if (n > 4000) break; } return n; }
export function currentStreak(days, today) { return dayBase(days, today) >= STREAK_MIN ? streakEnding(days, today) : streakEnding(days, addDays(today, -1)); }
export function bestStreak(days) {
  let best = 0, run = 0, prev = null;
  for (const d of Object.keys(days).sort()) {
    if (dayBase(days, d) < STREAK_MIN) { run = 0; prev = null; continue; }
    run = prev && addDays(prev, 1) === d ? run + 1 : 1; prev = d; best = Math.max(best, run);
  }
  return best;
}

/* which streak / Perfect Day bonuses a day has earned (same rules as the original app) */
export function wantedBonuses(days, date, perfectIds) {
  const entries = days[date] || [];
  const logged = new Set(entries.filter(e => !isAuto(e) && e.a).map(e => e.a));
  const want = [];
  if (perfectIds.length && perfectIds.every(id => logged.has(id))) want.push('perfect');
  if (dayBase(days, date) >= STREAK_MIN) { const s = streakEnding(days, date); if (s % 7 === 0) want.push('streak7'); if (s % 30 === 0) want.push('streak30'); }
  return want;
}
