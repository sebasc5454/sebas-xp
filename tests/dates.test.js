/* The 4 AM day boundary and calendar helpers. */
import { test, eq } from './harness.js';
import { gameDate, addDays, diffDays, weekStart, backdateTs, isYmd } from '../js/dates.js';

const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi || 0).getTime();

test('4 AM boundary: 3:59 AM still counts for the day before', () => {
  eq(gameDate(at(2026, 10, 2, 3, 59)), '2026-10-01');
  eq(gameDate(at(2026, 10, 2, 1, 0)), '2026-10-01');
  eq(gameDate(at(2026, 10, 2, 4, 0)), '2026-10-02');
  eq(gameDate(at(2026, 10, 2, 23, 59)), '2026-10-02');
});

test('4 AM boundary across month and year ends', () => {
  eq(gameDate(at(2026, 11, 1, 2, 0)), '2026-10-31');
  eq(gameDate(at(2027, 1, 1, 3, 30)), '2026-12-31');
  eq(gameDate(at(2027, 1, 1, 4, 0)), '2027-01-01');
});

test('custom reset hours', () => {
  eq(gameDate(at(2026, 10, 2, 0, 30), 0), '2026-10-02', 'midnight reset');
  eq(gameDate(at(2026, 10, 2, 5, 59), 6), '2026-10-01', '6 AM reset');
  eq(gameDate(at(2026, 10, 2, 6, 0), 6), '2026-10-02');
});

test('date math', () => {
  eq(addDays('2026-09-29', 3), '2026-10-02');
  eq(addDays('2026-12-31', 1), '2027-01-01');
  eq(addDays('2027-03-01', -1), '2027-02-28');
  eq(diffDays('2026-09-29', '2027-09-29'), 365);
  eq(diffDays('2026-10-05', '2026-10-01'), -4);
  eq(isYmd('2026-02-30'), false); eq(isYmd('2026-10-01'), true);
});

test('weeks start on Monday', () => {
  eq(weekStart('2026-09-29'), '2026-09-28', 'Tue → Mon');
  eq(weekStart('2026-10-04'), '2026-09-28', 'Sun → previous Mon');
  eq(weekStart('2026-10-05'), '2026-10-05', 'Mon → itself');
});

test('logging to a past day lands on that game day', () => {
  for (const now of [at(2026, 10, 10, 15, 0), at(2026, 10, 10, 2, 30), at(2026, 10, 10, 4, 0)]) {
    for (const back of ['2026-10-08', '2026-10-01', '2026-09-29']) eq(gameDate(backdateTs(back, now)), back, `from ${new Date(now).toString().slice(0, 21)} to ${back}`);
  }
});
