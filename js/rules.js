/* rules.js: keeps the game's automatic XP (bonuses + quest rewards) in sync with what you logged.
   After any log, undo, or delete on a date, `settle` re-checks that date and every later date,
   because streaks and the weekly boss depend on earlier days. Undo a log and its bonus goes away too. */
import { BONUS } from './config.js';
import { isAuto, wantedBonuses } from './leveling.js';
import { questProgress, bossStatus, questTree, questText } from './quests.js';
import { weekStart } from './dates.js';

/* ctx = { perfect: [activity ids], quests: {daily:{}, weekly:{}}, acts } */
export function wantedAuto(days, date, ctx) {
  const out = [];
  wantedBonuses(days, date, ctx.perfect).forEach(b => out.push({ k: 'bonus', b, n: BONUS[b].n, t: 'dis', x: BONUS[b].x }));
  const dq = ctx.quests.daily[date];
  if (dq) dq.list.forEach(q => {
    if (questProgress(q, days[date] || []) >= q.n) out.push({ k: 'quest', b: q.id, n: 'Quest: ' + questText(q, ctx.acts), t: questTree(q, ctx.acts), x: q.x });
  });
  const ws = weekStart(date), boss = ctx.quests.weekly[ws];
  if (boss && bossStatus(boss, days, ws).doneDate === date) out.push({ k: 'quest', b: 'boss', n: 'Boss defeated: ' + boss.name, t: questTree(boss, ctx.acts), x: boss.x });
  return out;
}

export function reconcileDay(days, date, ctx, mkId) {
  const entries = days[date] || [];
  const want = new Map(wantedAuto(days, date, ctx).map(w => [w.b, w]));
  const remove = [], seen = new Set();
  for (const e of entries) if (isAuto(e)) { if (!want.has(e.b) || seen.has(e.b)) remove.push(e.id); else seen.add(e.b); }
  const lastTs = entries.filter(e => !isAuto(e)).reduce((m, e) => Math.max(m, e.ts), 0);
  const add = [];
  want.forEach((w, b) => { if (!seen.has(b)) add.push(Object.assign({ id: mkId(), ts: lastTs + 1 + add.length, a: null }, w)); });
  return { add, remove };
}

export function applyDay(days, date, add, remove) {
  const rm = new Set(remove);
  const next = (days[date] || []).filter(e => !rm.has(e.id)).concat(add).sort((a, b) => a.ts - b.ts);
  if (next.length) days[date] = next; else delete days[date];
}

/* re-check fromDate and every later day; returns the list of dates that changed */
export function settle(days, fromDate, ctx, mkId) {
  const changed = [];
  for (const date of Object.keys(days).filter(d => d >= fromDate).sort()) {
    const r = reconcileDay(days, date, ctx, mkId);
    if (r.add.length || r.remove.length) { applyDay(days, date, r.add, r.remove); changed.push({ date, add: r.add, remove: r.remove }); }
  }
  return changed;
}
