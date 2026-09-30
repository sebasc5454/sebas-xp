/* feel.js: 8-bit sound, haptics, and screen shake. */

let actx = null;
function ctx() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
/* one note: frequency (Hz), start offset (s), duration (s), volume, waveform */
function tone(freq, start, dur, vol, type) {
  const a = ctx(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'square'; o.frequency.value = freq;
  const t = a.currentTime + start;
  g.gain.setValueAtTime(vol || .05, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
}
/* iPhone only allows audio that starts during a tap, so wake the audio engine on the first touch */
export function unlockAudio() { const a = ctx(); if (a) { const b = a.createBuffer(1, 1, 22050), s = a.createBufferSource(); s.buffer = b; s.connect(a.destination); s.start(0); } }
const N = { C3:131, F3:175, G3:196, A3:220, C4:262, E4:330, G4:392, A4:440, C5:523, D5:587, E5:659, F5:698, G5:784, A5:880, B5:988, C6:1047, E6:1319 };

/* tier rank-up fanfare: square-wave lead over a triangle bass, about 3.3 seconds */
function fanfare() {
  const lead = [['G4',0,.12],['C5',.12,.12],['E5',.24,.12],['G5',.36,.24],['E5',.6,.12],['G5',.72,.4],
    ['A5',1.16,.12],['G5',1.28,.12],['F5',1.4,.12],['A5',1.52,.4],
    ['G5',1.96,.12],['E5',2.08,.12],['D5',2.2,.12],['E5',2.32,.12],['C6',2.44,.9]];
  lead.forEach(([n, s, d]) => tone(N[n], s, d, .045));
  [['C3',0,.66],['F3',1.16,.7],['G3',1.96,.46],['C3',2.44,.95]].forEach(([n, s, d]) => tone(N[n], s, d, .12, 'triangle'));
  [['E5',2.44,.9],['G5',2.44,.9]].forEach(([n, s, d]) => tone(N[n], s, d, .025));   // final chord
  [2.44, 2.62, 2.8].forEach((s, i) => tone(N.E6 * (1 + i * .12), s, .08, .02));    // sparkle
}

export function sfx(kind, enabled) {
  if (!enabled) return;
  if (kind === 'blip') { tone(660, 0, .07); tone(990, .06, .09); }
  else if (kind === 'small') { [587, 784, 988].forEach((f, i) => tone(f, i * .07, .1)); }
  else if (kind === 'level') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .09, .14)); tone(1047, .4, .35, .04); tone(N.C3 * 2, 0, .5, .08, 'triangle'); }
  else if (kind === 'rank') fanfare();
  else if (kind === 'badge') { [N.E5, N.G5, N.B5, N.E6].forEach((f, i) => tone(f, i * .06, .12, .035)); }
  else if (kind === 'quest') { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, i * .05, .09, .04)); }
}

/* vibration: works on Android + some desktops. iPhone Safari has no vibration API, so this quietly does nothing there. */
const PATTERNS = { tap: 12, level: [30, 40, 30], rank: [60, 50, 60, 50, 140], badge: [20, 30, 20], quest: [15, 25, 15] };
export function buzz(kind, enabled) {
  if (!enabled || !navigator.vibrate) return;
  try { navigator.vibrate(PATTERNS[kind] || 10); } catch (e) { /* ignore */ }
}
export const canVibrate = () => typeof navigator !== 'undefined' && !!navigator.vibrate;

export function shake(strong) {
  const el = document.getElementById('app');
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.classList.remove('shake', 'shake-big'); void el.offsetWidth;
  el.classList.add(strong ? 'shake-big' : 'shake');
  setTimeout(() => el.classList.remove('shake', 'shake-big'), strong ? 700 : 450);
}
