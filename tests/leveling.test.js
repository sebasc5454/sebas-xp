/* Leveling math: these values must match the original app exactly. */
import { test, eq, ok } from './harness.js';
import { W, TREES, TREE, XP_TO_100 } from '../js/config.js';
import { overallCost, levelOf, tierIdx, rankIdx, treeCostFn, snapshot } from '../js/leveling.js';

test('overall cost per level follows the 5 tiers', () => {
  eq([1, 20, 21, 40, 41, 60, 61, 80, 81, 99].map(overallCost), [300, 300, 450, 450, 575, 575, 700, 700, 825, 825]);
});

test('LV 1 → 100 costs exactly 56,175 XP', () => {
  let sum = 0; for (let L = 1; L < 100; L++) sum += overallCost(L);
  eq(sum, 56175); eq(XP_TO_100, 56175);
});

test('level from XP', () => {
  const lv = xp => { const o = levelOf(xp, overallCost, 100); return [o.L, o.into, o.need, o.maxed]; };
  eq(lv(0), [1, 0, 300, false]);
  eq(lv(299), [1, 299, 300, false]);
  eq(lv(300), [2, 0, 300, false]);
  eq(lv(6000), [21, 0, 450, false], '20 levels of 300 → LV 21 (Tier II)');
  eq(lv(6449), [21, 449, 450, false]);
  eq(lv(56174), [99, 824, 825, false]);
  eq(lv(56175), [100, 0, 0, true]);
  eq(lv(999999), [100, 0, 0, true]);
});

test('tier and tree-rank boundaries', () => {
  eq([1, 20, 21, 40, 41, 61, 81, 100].map(tierIdx), [0, 0, 1, 1, 2, 3, 4, 4]);
  eq([1, 10, 11, 20, 21, 31, 41, 50].map(rankIdx), [0, 0, 1, 1, 2, 3, 4, 4]);
});

test('tree costs per rank (scaled by each tree\'s yearly XP)', () => {
  eq(TREE.aca.costs, [165, 245, 310, 380, 445], 'Academics');
  eq(TREE.eng.costs, [55, 80, 105, 125, 150], 'Engineering');
  eq(TREE.skl.costs, [55, 80, 105, 125, 150], 'Skills');
  eq(TREE.car.costs, [55, 80, 105, 125, 150], 'Career');
  eq(TREE.fit.costs, [130, 195, 250, 305, 360], 'Fitness');
  eq(TREE.soc.costs, [40, 55, 75, 90, 105], 'Social');
  eq(TREE.dis.costs, [125, 185, 240, 290, 345], 'Discipline');
  eq(W, [300, 450, 575, 700, 825]);
});

test('tree levels: max 50, rank every 10 levels', () => {
  const soc = TREE.soc;
  eq(levelOf(39, treeCostFn(soc), 50).L, 1);
  eq(levelOf(40, treeCostFn(soc), 50).L, 2);
  const toRank2 = 10 * 40;   // LV 1-10 each cost 40 in Social
  eq(levelOf(toRank2, treeCostFn(soc), 50).L, 11);
  eq(levelOf(1e7, treeCostFn(soc), 50).maxed, true);
  TREES.forEach(t => { let sum = 0; for (let L = 1; L < 50; L++) sum += treeCostFn(t)(L); ok(Math.abs(sum - t.T) / t.T < 0.03, `${t.name} tree total ${sum} ≈ ${t.T}`); });
});

test('snapshot adds up total and per-tree XP', () => {
  const days = { '2026-10-01': [{ id: 'a', ts: 1, t: 'aca', x: 200, k: 'log' }, { id: 'b', ts: 2, t: 'fit', x: 150, k: 'log' }, { id: 'c', ts: 3, t: 'dis', x: 25, k: 'bonus', b: 'perfect' }] };
  const S = snapshot(days);
  eq(S.total, 375); eq(S.o.L, 2); eq(S.o.into, 75);
  eq(S.trees.aca.xp, 200); eq(S.trees.aca.L, 2); eq(S.trees.fit.xp, 150); eq(S.trees.dis.xp, 25);
});
