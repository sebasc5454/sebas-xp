/* dates.js: calendar helpers. Dates are 'YYYY-MM-DD' strings in local time.
   A "game day" starts at the reset hour (4 AM by default), so a 1 AM log counts for the night before. */
import { RESET_HOUR } from './config.js';

export const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* the game day a timestamp belongs to */
export const gameDate = (ts, resetHour = RESET_HOUR) => ymd(new Date(ts - resetHour * 3600e3));

/* noon avoids daylight-saving edge cases when doing date math */
export function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); }
export function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
export function diffDays(a, b) {
  const A = parseYmd(a), B = parseYmd(b);
  return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 864e5);
}
export const isYmd = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parseYmd(s)) === s;

/* weeks run Monday to Sunday */
export function weekStart(s) { const dow = parseYmd(s).getDay(); return addDays(s, -((dow + 6) % 7)); }
export const weekDates = ws => Array.from({ length: 7 }, (_, i) => addDays(ws, i));

/* A timestamp that lands on an earlier game day, at the same clock time as now.
   Used when logging to a past day, so the entry sorts and displays naturally. */
export function backdateTs(target, now, resetHour = RESET_HOUR) {
  const n = diffDays(target, gameDate(now, resetHour));
  const d = new Date(now); d.setDate(d.getDate() - n);
  return d.getTime();
}

export const MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
export const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
export function dayLabel(s) { const d = parseYmd(s); return `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`; }
export function shortLabel(s) { const d = parseYmd(s); return `${MON[d.getMonth()]} ${d.getDate()}`; }
export function fmtEta(s) { const d = parseYmd(s); return `${MON[d.getMonth()]} ${d.getDate()} '${String(d.getFullYear()).slice(2)}`; }
export function hourLabel(h) { return `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`; }
export function timeLabel(ts) { const t = new Date(ts), h = t.getHours(); return `${((h + 11) % 12) + 1}:${pad(t.getMinutes())}${h < 12 ? 'a' : 'p'}`; }
