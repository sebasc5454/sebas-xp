/* harness.js: a tiny test runner that works in the browser (tests/index.html),
   in the macOS terminal (tests/run.sh), and in Node if you ever install it (node tests/run.js). */
const tests = [];
export function test(name, fn) { tests.push({ name, fn }); }
export function eq(actual, expected, msg) {
  const A = JSON.stringify(actual), E = JSON.stringify(expected);
  if (A !== E) throw new Error(`${msg ? msg + ': ' : ''}expected ${E}, got ${A}`);
}
export function ok(value, msg) { if (!value) throw new Error(msg || 'expected something truthy'); }

export async function runAll(log) {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); pass++; log(`  ok    ${t.name}`); }
    catch (e) { fail++; log(`  FAIL  ${t.name}\n        ${e.message}`); }
  }
  log(`\n${pass} passed, ${fail} failed`);
  return { pass, fail };
}

/* build a fake day log quickly: E('2026-10-01', 'study', 20) */
let n = 0;
export function E(date, a, x, extra) {
  const [y, m, d] = date.split('-').map(Number);
  return Object.assign({ id: 'e' + (++n), ts: new Date(y, m - 1, d, 9, 0, n % 60).getTime(), a, n: a || 'custom', t: 'aca', x, k: 'log' }, extra || {});
}
export function daysOf(...entries) {
  const days = {};
  for (const [date, e] of entries) (days[date] = days[date] || []).push(e);
  return days;
}
