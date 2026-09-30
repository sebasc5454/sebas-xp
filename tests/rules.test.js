/* Streaks, bonuses, and quests, including logging to past days and undo. */
import { test, eq, ok, E, daysOf } from './harness.js';
import { addDays } from '../js/dates.js';
import { dayBase, streakEnding, currentStreak, bestStreak, wantedBonuses, isAuto } from '../js/leveling.js';
import { settle, applyDay } from '../js/rules.js';
import { makeDailyQuests, makeBoss, questProgress, bossStatus } from '../js/quests.js';
import { state, buildActs, ACT } from '../js/state.js';

let idn = 0; const mkId = () => 'auto' + (++idn);
const noQuests = { perfect: [], quests: { daily: {}, weekly: {} }, acts: {} };
const autos = (days, date) => (days[date] || []).filter(isAuto).map(e => e.b).sort();
/* a run of consecutive days, each with `xp` real XP */
function run(start, n, xp) { const days = {}; for (let i = 0; i < n; i++) { const d = addDays(start, i); days[d] = [E(d, 'study', xp)]; } return days; }

test('bonus and quest XP never count toward the 100 XP streak line', () => {
  const days = daysOf(['2026-10-01', E('2026-10-01', 'study', 90)], ['2026-10-01', E('2026-10-01', null, 25, { k: 'bonus', b: 'perfect' })], ['2026-10-01', E('2026-10-01', null, 20, { k: 'quest', b: 'q3' })]);
  eq(dayBase(days, '2026-10-01'), 90);
  eq(streakEnding(days, '2026-10-01'), 0);
});

test('streaks count consecutive 100+ XP days; 99 breaks it', () => {
  const days = run('2026-10-01', 5, 100);
  eq(streakEnding(days, '2026-10-05'), 5);
  days['2026-10-03'] = [E('2026-10-03', 'study', 99)];
  eq(streakEnding(days, '2026-10-05'), 2);
  eq(bestStreak(days), 2);
});

test('current streak still counts yesterday while today is under 100', () => {
  const days = run('2026-10-01', 4, 120);
  eq(currentStreak(days, '2026-10-05'), 4);
  days['2026-10-05'] = [E('2026-10-05', 'study', 40)];
  eq(currentStreak(days, '2026-10-05'), 4);
  eq(currentStreak(days, '2026-10-06'), 0);
});

test('7-day streak bonus on day 7, 14, 21, 28; 30-day bonus on day 30', () => {
  const days = run('2026-10-01', 30, 100);
  const on = i => wantedBonuses(days, addDays('2026-10-01', i - 1), []);
  eq(on(6), []); eq(on(7), ['streak7']); eq(on(8), []); eq(on(14), ['streak7']); eq(on(28), ['streak7']); eq(on(30), ['streak30']);
});

test('Perfect Day needs every habit logged', () => {
  const d = '2026-10-01';
  const days = daysOf([d, E(d, 'sleep', 15)], [d, E(d, 'alarm', 15)]);
  eq(wantedBonuses(days, d, ['sleep', 'alarm', 'stack']), []);
  days[d].push(E(d, 'stack', 10));
  eq(wantedBonuses(days, d, ['sleep', 'alarm', 'stack']), ['perfect']);
});

test('settle adds a bonus, and undo takes it back', () => {
  const d = '2026-10-01', ctx = { ...noQuests, perfect: ['sleep', 'alarm'] };
  const days = daysOf([d, E(d, 'sleep', 15)]);
  const log = E(d, 'alarm', 15);
  applyDay(days, d, [log], []); settle(days, d, ctx, mkId);
  eq(autos(days, d), ['perfect']);
  eq(days[d].find(e => e.b === 'perfect').x, 25);
  applyDay(days, d, [], [log.id]); settle(days, d, ctx, mkId);
  eq(autos(days, d), []);
});

test('logging to a missed past day repairs the streak and awards the 7-day bonus', () => {
  const days = run('2026-10-01', 7, 110);
  delete days['2026-10-04'];
  settle(days, '2026-10-01', noQuests, mkId);
  eq(autos(days, '2026-10-07'), [], 'gap on day 4 → no bonus');
  applyDay(days, '2026-10-04', [E('2026-10-04', 'study', 110)], []);
  settle(days, '2026-10-04', noQuests, mkId);
  eq(autos(days, '2026-10-07'), ['streak7'], 'backfilled day 4 → bonus on day 7');
});

test('deleting an old entry removes streak bonuses it made possible', () => {
  const days = run('2026-10-01', 7, 110);
  settle(days, '2026-10-01', noQuests, mkId);
  eq(autos(days, '2026-10-07'), ['streak7']);
  applyDay(days, '2026-10-02', [], [days['2026-10-02'][0].id]);
  settle(days, '2026-10-02', noQuests, mkId);
  eq(autos(days, '2026-10-07'), []);
});

test('duplicate bonuses (e.g. from merging two devices) are cleaned up', () => {
  const d = '2026-10-01', ctx = { ...noQuests, perfect: ['sleep'] };
  const days = daysOf([d, E(d, 'sleep', 15)], [d, E(d, null, 25, { k: 'bonus', b: 'perfect' })], [d, E(d, null, 25, { k: 'bonus', b: 'perfect' })]);
  settle(days, d, ctx, mkId);
  eq(autos(days, d), ['perfect']);
});

/* ---------- quests ---------- */
buildActs();
const qctx = days => ({ acts: ACT, favorites: state.settings.favorites, perfect: state.settings.perfect, days, target: 154 });

test('daily quests are stable for a date and use repeatable activities', () => {
  const a = makeDailyQuests('2026-10-01', qctx({})), b = makeDailyQuests('2026-10-01', qctx({}));
  eq(a, b);
  eq(a.list.length, 3);
  const acts = a.list.filter(q => q.kind === 'act');
  eq(acts.length, 2);
  acts.forEach(q => { ok(ACT[q.a] && !ACT[q.a].once, `${q.a} should be repeatable`); ok(!state.settings.perfect.includes(q.a), 'habits are left to Perfect Day'); });
  ok(ACT[acts[0].a].tree !== ACT[acts[1].a].tree, 'two different trees');
  ok(JSON.stringify(makeDailyQuests('2026-10-02', qctx({}))) !== JSON.stringify(a), 'quests rotate daily');
});

test('quest progress counts quantity (3 study blocks = 3)', () => {
  const d = '2026-10-01';
  eq(questProgress({ kind: 'act', a: 'study', n: 2 }, [E(d, 'study', 60, { q: 3 })]), 3);
  eq(questProgress({ kind: 'tree', t: 'aca', n: 80 }, [E(d, 'study', 60, { q: 3 }), E(d, null, 20, { k: 'quest', b: 'q1' })]), 60);
});

test('clearing a quest adds its reward; undo removes it', () => {
  const d = '2026-10-01';
  const quests = { daily: { [d]: { list: [{ id: 'q1', kind: 'act', a: 'study', n: 2, x: 10 }], rerolled: false } }, weekly: {} };
  const ctx = { perfect: [], quests, acts: ACT };
  const days = daysOf([d, E(d, 'study', 20)]);
  settle(days, d, ctx, mkId); eq(autos(days, d), []);
  const second = E(d, 'study', 20);
  applyDay(days, d, [second], []); settle(days, d, ctx, mkId);
  eq(autos(days, d), ['q1']); eq(days[d].find(e => e.b === 'q1').x, 10);
  eq(dayBase(days, d), 40, 'quest XP is not streak XP');
  applyDay(days, d, [], [second.id]); settle(days, d, ctx, mkId);
  eq(autos(days, d), []);
});

test('weekly boss reward lands on the day it was beaten', () => {
  const ws = '2026-10-05';   // a Monday
  const boss = makeBoss(ws, qctx({}), null);
  ok(boss.x === 150);
  const hydra = { id: 'hydra', name: 'The Application Hydra', kind: 'act', a: 'intApp', n: 5, x: 150 };
  const ctx = { perfect: [], quests: { daily: {}, weekly: { [ws]: hydra } }, acts: ACT };
  const days = daysOf(['2026-10-05', E('2026-10-05', 'intApp', 60, { q: 2 })], ['2026-10-07', E('2026-10-07', 'intApp', 60, { q: 2 })], ['2026-10-08', E('2026-10-08', 'intApp', 30)], ['2026-10-09', E('2026-10-09', 'intApp', 30)]);
  settle(days, ws, ctx, mkId);
  eq(bossStatus(hydra, days, ws), { progress: 6, doneDate: '2026-10-08' });
  eq(autos(days, '2026-10-08'), ['boss']); eq(autos(days, '2026-10-09'), []);
});
