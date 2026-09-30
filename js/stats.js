/* stats.js: numbers for the character sheet, badges, weekly recap, and yearly heatmap. Pure functions. */
import { TREES, STREAK_MIN } from './config.js';
import { addDays, weekDates, parseYmd, diffDays, weekStart } from './dates.js';
import { isAuto, qty, dayBase, dayTotal, bestStreak } from './leveling.js';

export function lifetimeStats(days, target) {
  const counts = {}, treeLogs = {};
  let logs = 0, perfectDays = 0, questsDone = 0, fullBoards = 0, bosses = 0, maxTrees = 0;
  let daysActive = 0, targetDays = 0, centuryDays = 0, maxDay = { date: null, xp: 0 };
  for (const date in days) {
    let base = 0, total = 0, dq = 0; const trees = new Set();
    for (const e of days[date]) {
      total += e.x;
      if (isAuto(e)) {
        if (e.b === 'perfect') perfectDays++;
        else if (e.b === 'boss') bosses++;
        else if (e.k === 'quest') { questsDone++; dq++; }
        continue;
      }
      logs += qty(e); base += e.x; trees.add(e.t);
      treeLogs[e.t] = (treeLogs[e.t] || 0) + qty(e);
      if (e.a) counts[e.a] = (counts[e.a] || 0) + qty(e);
    }
    if (dq >= 3) fullBoards++;
    if (base > 0) daysActive++;
    if (base >= STREAK_MIN) centuryDays++;
    if (base >= target) targetDays++;
    if (total > maxDay.xp) maxDay = { date, xp: total };
    maxTrees = Math.max(maxTrees, trees.size);
  }
  const favId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || null;
  return { counts, treeLogs, logs, perfectDays, questsDone, fullBoards, bosses, maxTrees, daysActive, targetDays, centuryDays, maxDay, favId, bestStreak: bestStreak(days) };
}

/* ---------- weekly recap ---------- */
function weekTotals(days, ws) {
  const byTree = {}; TREES.forEach(t => byTree[t.id] = 0);
  const byDay = weekDates(ws).map(d => ({ date: d, xp: dayTotal(days, d), base: dayBase(days, d) }));
  for (const d of weekDates(ws)) for (const e of days[d] || []) if (!isAuto(e) && byTree[e.t] !== undefined) byTree[e.t] += e.x;
  const total = byDay.reduce((s, d) => s + d.xp, 0);
  return { byDay, byTree, total };
}
export function weekRecap(days, ws, target) {
  const cur = weekTotals(days, ws), prev = weekTotals(days, addDays(ws, -7));
  const best = cur.byDay.reduce((m, d) => d.xp > m.xp ? d : m, { date: null, xp: 0 });
  /* neglected = lowest share of its expected weekly XP (T / 52) */
  const ratios = TREES.map(t => ({ t, xp: cur.byTree[t.id], expected: Math.round(t.T / 52), ratio: cur.byTree[t.id] / (t.T / 52) }));
  const neglected = ratios.slice().sort((a, b) => a.ratio - b.ratio)[0];
  const strongest = ratios.slice().sort((a, b) => b.ratio - a.ratio)[0];
  return {
    ws, cur, prev, best, neglected, strongest,
    targetDays: cur.byDay.filter(d => d.base >= target).length,
    streakDays: cur.byDay.filter(d => d.base >= STREAK_MIN).length,
    delta: cur.total - prev.total
  };
}

/* ---------- yearly heatmap: 53 Monday-first week columns from the start date ---------- */
export function heatLevel(xp, target) {
  if (xp <= 0) return 0;
  if (xp < 50) return 1;
  if (xp < STREAK_MIN) return 2;
  if (xp < target) return 3;
  return 4;
}
export function yearGrid(days, start, today, target) {
  const first = weekStart(start), last = addDays(start, 364), weeks = [];
  for (let ws = first; ws <= last; ws = addDays(ws, 7)) {
    weeks.push(weekDates(ws).map(d => {
      const out = d < start || d > last;
      const xp = out ? 0 : dayTotal(days, d);
      return { date: d, xp, lvl: heatLevel(xp, target), out, future: d > today, today: d === today };
    }));
  }
  return weeks;
}
export function yearSummary(days, start, today, target) {
  const last = addDays(start, 364); let xp = 0, active = 0, hit = 0;
  for (const d in days) if (d >= start && d <= last) { const b = dayBase(days, d); xp += dayTotal(days, d); if (b > 0) active++; if (b >= target) hit++; }
  const elapsed = Math.max(1, Math.min(365, diffDays(start, today) + 1));
  return { xp, active, hit, elapsed };
}
export const monthOf = d => parseYmd(d).getMonth();
