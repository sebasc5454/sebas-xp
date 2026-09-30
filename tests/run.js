/* Runs every test file. Terminal: sh tests/run.sh   Browser: http://localhost:8000/tests/ */
import './leveling.test.js';
import './dates.test.js';
import './rules.test.js';
import './stats.test.js';
import './sync.test.js';
import { runAll } from './harness.js';

const log = typeof console !== 'undefined' && console.log ? s => console.log(s) : s => print(s);   // macOS jsc has print(), not console
export const done = runAll(log).then(r => {
  if (r.fail && typeof process !== 'undefined') process.exitCode = 1;
  return r;
});
