/* Cloud sync merge rules: two devices must always end up with the same data. */
import { test, eq, ok, E, daysOf } from './harness.js';
import { mergeEntryRows, mergeSettingsDoc, mergeBadgesDoc, mergeQuestWeek, packQuestWeek, preferQuest } from '../js/syncmerge.js';

const row = (e, date, deleted) => ({ id: e.id, date, data: deleted ? {} : e, deleted: !!deleted, updated_at: '2026-10-01T00:00:00Z' });

test('entries from another device are added to the right day', () => {
  const d = '2026-10-01', mine = E(d, 'study', 20), theirs = E(d, 'lift', 30);
  const days = daysOf([d, mine]);
  const r = mergeEntryRows(days, [row(theirs, d)], {});
  eq(r.added, 1); eq(r.dates, [d]); eq(days[d].map(e => e.id).sort(), [mine.id, theirs.id].sort());
});

test('pulling the same rows twice changes nothing', () => {
  const d = '2026-10-01', theirs = E(d, 'lift', 30), days = {};
  mergeEntryRows(days, [row(theirs, d)], {});
  const again = mergeEntryRows(days, [row(theirs, d), row(theirs, d)], {});
  eq(again.added, 0); eq(days[d].length, 1);
});

test('a delete on another device removes the entry here', () => {
  const d = '2026-10-01', e = E(d, 'study', 20);
  const days = daysOf([d, e]);
  mergeEntryRows(days, [row(e, d, true)], {});
  eq(days[d], undefined);
});

test('a delete elsewhere wins over an unsent upload here, and cancels that upload', () => {
  const d = '2026-10-01', e = E(d, 'study', 20), outbox = { [e.id]: 'put' };
  const days = daysOf([d, e]);
  mergeEntryRows(days, [row(e, d, true)], outbox);
  eq(days[d], undefined); eq(outbox, {});
});

test('an entry deleted here (not yet uploaded) is not brought back by an old copy', () => {
  const d = '2026-10-01', e = E(d, 'study', 20), days = {};
  mergeEntryRows(days, [row(e, d)], { [e.id]: 'del' });
  eq(days, {});
});

test('bonus/quest rows and junk are ignored', () => {
  const d = '2026-10-01', days = {};
  const bonus = E(d, null, 25, { k: 'bonus', b: 'perfect' });
  const r = mergeEntryRows(days, [row(bonus, d), { id: 'x', date: 'nope', data: { id: 'x' }, deleted: false }], {});
  eq(r.added, 0); eq(days, {});
});

test('settings: the most recent change wins', () => {
  eq(mergeSettingsDoc({ _at: 5 }, { _at: 9 }), { adopt: true, push: false });
  eq(mergeSettingsDoc({ _at: 9 }, { _at: 5 }), { adopt: false, push: true });
  eq(mergeSettingsDoc({ _at: 5 }, { _at: 5 }), { adopt: false, push: false });
  eq(mergeSettingsDoc({ _at: 5 }, null), { adopt: false, push: true });
});

test('badges: keep all of them with the earliest unlock date', () => {
  const m = mergeBadgesDoc({ first: '2026-10-02', century: '2026-10-03' }, { first: '2026-10-01', ace: '2026-10-05' });
  eq(m.badges, { first: '2026-10-01', century: '2026-10-03', ace: '2026-10-05' });
  eq(m.push, true, 'cloud is missing "century"');
  eq(mergeBadgesDoc({ first: '2026-10-01' }, { first: '2026-10-01' }).push, false);
});

test('quests: the first device to pick a day\'s quests wins, on both devices', () => {
  const ws = '2026-09-28';
  const early = { list: [{ id: 'q1' }], genAt: 100, modAt: 100 }, late = { list: [{ id: 'q9' }], genAt: 200, modAt: 200 };
  const phone = { daily: { '2026-09-29': early }, weekly: {} }, laptop = { daily: { '2026-09-29': late }, weekly: {} };
  const onLaptop = mergeQuestWeek(laptop, ws, packQuestWeek(phone, ws));
  eq(laptop.daily['2026-09-29'], early); eq(onLaptop.changedDates, ['2026-09-29']);
  const onPhone = mergeQuestWeek(phone, ws, packQuestWeek({ daily: { '2026-09-29': late }, weekly: {} }, ws));
  eq(phone.daily['2026-09-29'], early); eq(onPhone.push, true, 'phone re-uploads the winner');
});

test('quests: a swap (reroll) beats the original pick; exact ties still agree', () => {
  const orig = { list: [1], genAt: 100, modAt: 100 }, swapped = { list: [2], genAt: 100, modAt: 150 };
  ok(preferQuest(swapped, orig)); ok(!preferQuest(orig, swapped));
  const a = { list: [1] }, b = { list: [2] };   // quests made before sync existed (no timestamps)
  ok(preferQuest(a, b) !== preferQuest(b, a), 'exactly one wins');
  ok(!preferQuest(a, a), 'identical copies: no change');
});
