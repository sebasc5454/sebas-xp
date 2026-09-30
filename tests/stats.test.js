/* Badges, character-sheet stats, weekly recap, and backups. */
import { test, eq, ok, E, daysOf } from './harness.js';
import { snapshot } from '../js/leveling.js';
import { lifetimeStats, weekRecap, yearGrid } from '../js/stats.js';
import { BADGES, evaluateBadges } from '../js/achievements.js';
import { DEFAULT_SETTINGS } from '../js/config.js';

const badgeCtx = days => ({ s: lifetimeStats(days, 154), snap: snapshot(days), settings: DEFAULT_SETTINGS });
const got = days => evaluateBadges(badgeCtx(days)).filter(b => b.got).map(b => b.id);

test('there are 30+ badges and every id is unique', () => {
  ok(BADGES.length >= 30, `${BADGES.length} badges`);
  eq(new Set(BADGES.map(b => b.id)).size, BADGES.length);
});

test('first log unlocks Press Start; 10 internship apps unlock Applicant', () => {
  eq(got({}), []);
  const d = '2026-10-01';
  eq(got(daysOf([d, E(d, 'intApp', 30)])), ['first']);
  const ten = daysOf([d, E(d, 'intApp', 270, { q: 9, t: 'car' })], [d, E(d, 'intApp', 30, { t: 'car' })]);
  ok(got(ten).includes('apps10'), 'quantity counts toward badges');
});

test('lifetime stats', () => {
  const days = daysOf(['2026-10-01', E('2026-10-01', 'study', 120)], ['2026-10-02', E('2026-10-02', 'study', 200)], ['2026-10-02', E('2026-10-02', 'lift', 30, { t: 'fit' })], ['2026-10-02', E('2026-10-02', null, 25, { k: 'bonus', b: 'perfect' })]);
  const s = lifetimeStats(days, 154);
  eq([s.daysActive, s.bestStreak, s.maxDay, s.favId, s.logs, s.perfectDays, s.targetDays], [2, 2, { date: '2026-10-02', xp: 255 }, 'study', 3, 1, 1]);
});

test('weekly recap compares weeks and flags the neglected tree', () => {
  const days = daysOf(['2026-10-06', E('2026-10-06', 'study', 300)], ['2026-10-07', E('2026-10-07', 'lift', 200, { t: 'fit' })], ['2026-09-29', E('2026-09-29', 'study', 100)]);
  const R = weekRecap(days, '2026-10-05', 154);
  eq([R.cur.total, R.prev.total, R.delta, R.best.date, R.targetDays], [500, 100, 400, '2026-10-06', 2]);
  eq(R.neglected.xp, 0);
  ok(['eng', 'skl', 'car', 'soc', 'dis'].includes(R.neglected.t.id));
});

test('year heatmap covers the 365-day campaign in Monday-first weeks', () => {
  const weeks = yearGrid({}, '2026-09-29', '2026-09-29', 154);
  eq(weeks[0][0].date, '2026-09-28'); eq(weeks[0][0].out, true); eq(weeks[0][1].out, false);
  const inYear = weeks.flat().filter(c => !c.out).length;
  eq(inYear, 365);
});
