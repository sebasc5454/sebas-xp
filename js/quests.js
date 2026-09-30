/* quests.js: 3 daily quests + 1 weekly boss.
   Quests are picked once per day from your favorites and most-logged activities, then saved,
   so they don't change if you edit favorites mid-day. Rewards are in config.js (QUEST_XP). */
import { TREES, TREE, QUEST_XP, STACKABLE, BOSSES, STREAK_MIN } from './config.js';
import { addDays, weekDates } from './dates.js';
import { isAuto, qty, dayBase } from './leveling.js';

/* seeded random numbers: the same seed always gives the same quests */
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) {
  let a = hash(seed);
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function shuffle(arr, r) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
const round5 = n => Math.round(n / 5) * 5;

/* ctx = { acts, favorites, perfect, days, target } */
function activityPool(date, ctx) {
  const usable = id => ctx.acts[id] && !ctx.acts[id].once && !ctx.acts[id].hidden;
  const recent = {};
  for (let i = 1; i <= 28; i++) for (const e of ctx.days[addDays(date, -i)] || []) if (!isAuto(e) && e.a) recent[e.a] = (recent[e.a] || 0) + qty(e);
  const top = Object.keys(recent).sort((a, b) => recent[b] - recent[a]).slice(0, 10);
  let pool = [...new Set([...ctx.favorites, ...top])].filter(usable);
  if (pool.length < 2) pool = Object.keys(ctx.acts).filter(usable);
  const notHabits = pool.filter(id => !ctx.perfect.includes(id));   // Perfect Day already rewards habits
  return notHabits.length >= 2 ? notHabits : pool;
}

function actQuest(id, a) { return { kind: 'act', a, n: STACKABLE.includes(a) ? 2 : 1, x: QUEST_XP.act, id }; }

/* the tree you've fed the least over the past week, relative to its yearly plan */
export function neglectedTree(days, date) {
  const xp = {}; TREES.forEach(t => xp[t.id] = 0);
  for (let i = 0; i < 7; i++) for (const e of days[addDays(date, -i)] || []) if (!isAuto(e) && xp[e.t] !== undefined) xp[e.t] += e.x;
  return TREES.slice().sort((a, b) => xp[a.id] / a.T - xp[b.id] / b.T)[0];
}

const CHALLENGES = ['xp', 'trees', 'tree'];
function challengeQuest(kind, date, ctx) {
  if (kind === 'xp') return { id: 'q3', kind, n: ctx.target, x: QUEST_XP.challenge };
  if (kind === 'trees') return { id: 'q3', kind, n: 4, x: QUEST_XP.challenge };
  const t = neglectedTree(ctx.days, addDays(date, -1));
  return { id: 'q3', kind: 'tree', t: t.id, n: Math.max(30, round5(t.T / 365 * 2)), x: QUEST_XP.challenge };
}

export function makeDailyQuests(date, ctx) {
  const r = rng('daily:' + date);
  const pool = shuffle(activityPool(date, ctx), r);
  const picks = [];
  for (const id of pool) if (picks.length < 2 && !picks.some(p => ctx.acts[p].tree === ctx.acts[id].tree)) picks.push(id);  // two different trees if possible
  for (const id of pool) if (picks.length < 2 && !picks.includes(id)) picks.push(id);
  const challenge = challengeQuest(CHALLENGES[Math.floor(r() * CHALLENGES.length)], date, ctx);
  return { list: [...picks.map((a, i) => actQuest('q' + (i + 1), a)), challenge], rerolled: false };
}

/* swap one unfinished quest for a new one (once per day) */
export function rerollQuest(day, qid, date, ctx) {
  const r = rng('reroll:' + date + qid);
  const old = day.list.find(q => q.id === qid);
  let next;
  if (old.kind === 'act') {
    const taken = day.list.filter(q => q.kind === 'act').map(q => q.a);
    const pool = shuffle(activityPool(date, ctx).filter(id => !taken.includes(id)), r);
    next = pool.length ? actQuest(qid, pool[0]) : old;
  } else {
    const kinds = CHALLENGES.filter(k => k !== old.kind);
    next = challengeQuest(kinds[Math.floor(r() * kinds.length)], date, ctx);
  }
  return { list: day.list.map(q => q.id === qid ? next : q), rerolled: true };
}

export function makeBoss(ws, ctx, prevId) {
  const r = rng('boss:' + ws);
  const ok = BOSSES.filter(b => b.id !== prevId && (b.kind !== 'act' || (ctx.acts[b.a] && !ctx.acts[b.a].hidden)));
  const b = ok.length ? ok[Math.floor(r() * ok.length)] : BOSSES.find(x => x.kind === 'days');
  return Object.assign({}, b, { x: QUEST_XP.boss });
}

/* ---------- progress ---------- */
export function questProgress(q, entries) {
  const real = entries.filter(e => !isAuto(e));
  if (q.kind === 'act') return real.filter(e => e.a === q.a).reduce((s, e) => s + qty(e), 0);
  if (q.kind === 'xp') return real.reduce((s, e) => s + e.x, 0);
  if (q.kind === 'trees') return new Set(real.map(e => e.t)).size;
  if (q.kind === 'tree') return real.filter(e => e.t === q.t).reduce((s, e) => s + e.x, 0);
  return 0;
}
function bossDayProgress(b, days, date) {
  if (b.kind === 'days') return dayBase(days, date) >= STREAK_MIN ? 1 : 0;
  return questProgress(b, days[date] || []);
}
/* total progress this week, and the day the boss fell (the day progress first reached the goal) */
export function bossStatus(b, days, ws) {
  let p = 0, doneDate = null;
  for (const d of weekDates(ws)) { p += bossDayProgress(b, days, d); if (!doneDate && p >= b.n) doneDate = d; }
  return { progress: p, doneDate };
}

/* ---------- labels ---------- */
export function questTree(q, acts) {
  if (q.kind === 'act') return acts[q.a] ? acts[q.a].tree : 'dis';
  if (q.kind === 'tree') return q.t;
  return 'dis';
}
export function questText(q, acts) {
  if (q.kind === 'act') { const nm = acts[q.a] ? acts[q.a].name : q.a; return q.n > 1 ? `${q.n}× ${nm}` : nm; }
  if (q.kind === 'xp') return `Earn ${q.n} XP (bonuses don't count)`;
  if (q.kind === 'trees') return `Log in ${q.n} different trees`;
  if (q.kind === 'tree') return `Earn ${q.n} ${TREE[q.t] ? TREE[q.t].name : q.t} XP`;
  if (q.kind === 'days') return `Hit ${STREAK_MIN}+ XP on ${q.n} days`;
  return '';
}
