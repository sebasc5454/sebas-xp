/* syncmerge.js: rules for combining this device's data with the cloud copy. Pure functions (tested).

   - Log entries: each one has a unique id and never changes after it's made, so merging is
     "union of everything, minus anything deleted". Deletes leave a permanent marker (a tombstone).
   - Bonus and quest XP are NOT synced. Each device recalculates them from the logs, so they always agree.
   - Settings: the most recently changed copy wins.
   - Badges: keep every badge, with the earliest unlock date.
   - Quests: the first device to pick a day's quests wins (a later swap on that same pick wins over the original). */
import { isAuto } from './leveling.js';
import { isYmd, weekDates } from './dates.js';
import { applyDay } from './rules.js';

export function indexEntries(days) {
  const m = new Map();
  for (const d in days) for (const e of days[d]) m.set(e.id, { date: d, e });
  return m;
}
const validEntry = e => e && typeof e.id === 'string' && typeof e.x === 'number' && isFinite(e.x) && typeof e.ts === 'number' && !isAuto(e);

/* Apply entry rows from the cloud. outboxEnt = this device's not-yet-uploaded changes ({id: 'put'|'del'}).
   Returns { dates: [changed dates], added: n } */
export function mergeEntryRows(days, rows, outboxEnt) {
  const idx = indexEntries(days), add = {}, rm = {};
  let added = 0;
  for (const r of rows) {
    const local = idx.get(r.id), pending = outboxEnt[r.id];
    if (r.deleted) {
      if (local) { (rm[local.date] = rm[local.date] || []).push(r.id); idx.delete(r.id); }
      if (pending === 'put') delete outboxEnt[r.id];   // deleted on another device: don't bring it back
    } else if (!local && pending !== 'del' && isYmd(r.date) && validEntry(r.data) && r.data.id === r.id) {
      (add[r.date] = add[r.date] || []).push(r.data); idx.set(r.id, { date: r.date, e: r.data }); added++;
    }
  }
  const dates = [...new Set([...Object.keys(add), ...Object.keys(rm)])].sort();
  dates.forEach(d => applyDay(days, d, add[d] || [], rm[d] || []));
  return { dates, added };
}

/* settings: newest `_at` wins */
export function mergeSettingsDoc(local, remote) {
  const la = (local && local._at) || 0, ra = (remote && remote._at) || 0;
  if (!remote) return { adopt: false, push: true };
  if (ra > la) return { adopt: true, push: false };
  return { adopt: false, push: la > ra };
}

/* badges: union, earliest unlock date */
export function mergeBadgesDoc(local, remote) {
  const out = Object.assign({}, local); let changedLocal = false, push = false;
  for (const id in remote || {}) if (!out[id] || remote[id] < out[id]) { out[id] = remote[id]; changedLocal = true; }
  for (const id in out) if (!remote || !remote[id] || out[id] < remote[id]) push = true;
  return { badges: out, changedLocal, push };
}

/* quests: one cloud doc per week */
export const questKey = ws => 'quests:' + ws;
export function packQuestWeek(quests, ws) {
  const daily = {}; weekDates(ws).forEach(d => { if (quests.daily[d]) daily[d] = quests.daily[d]; });
  return { daily, boss: quests.weekly[ws] || null };
}
/* is quest set `a` preferred over `b`? Same answer on every device. */
export function preferQuest(a, b) {
  if (!a) return false; if (!b) return true;
  const ga = a.genAt || 0, gb = b.genAt || 0;
  if (ga !== gb) return ga < gb;                       // picked first wins
  const ma = a.modAt || 0, mb = b.modAt || 0;
  if (ma !== mb) return ma > mb;                       // same pick: latest swap wins
  return JSON.stringify(a) < JSON.stringify(b);        // tie-breaker so both devices choose the same one
}
export function mergeQuestWeek(quests, ws, remote) {
  const changedDates = []; let push = false;
  for (const d of weekDates(ws)) {
    const l = quests.daily[d], r = remote && remote.daily ? remote.daily[d] : null;
    if (preferQuest(r, l)) { quests.daily[d] = r; changedDates.push(d); }
    else if (preferQuest(l, r)) push = true;
  }
  const lb = quests.weekly[ws], rb = remote ? remote.boss : null;
  if (preferQuest(rb, lb)) { quests.weekly[ws] = rb; changedDates.push(ws); }
  else if (preferQuest(lb, rb)) push = true;
  return { changedDates, push };
}
