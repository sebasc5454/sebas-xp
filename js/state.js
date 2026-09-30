/* state.js: everything the app knows right now, in one object. Views read from here; app.js changes it. */
import { DEFAULT_SETTINGS, DEFAULT_ACTS, TREE } from './config.js';
import { gameDate, isYmd } from './dates.js';

export const clone = o => JSON.parse(JSON.stringify(o));

export const state = {
  settings: clone(DEFAULT_SETTINGS),
  days: {},                          // { 'YYYY-MM-DD': [entries] }: your whole log
  quests: { daily: {}, weekly: {} }, // quests picked for each day / week
  badges: {},                        // { badgeId: date first unlocked }
  ready: false,
  /* screen state (not saved) */
  tab: 'home', sub: { hero: 'sheet', history: 'recap' },
  filter: 'all', q: '', histShown: 14,
  logDate: null, logQty: 1,          // Log tab: which day + how many
  recapWeek: null, heatSel: null,
  save: { pending: 0, error: false, at: 0 },
  outbox: { ent: {}, docs: {} },    // changes waiting to upload to cloud sync (saved with your data)
  sync: { status: 'off', error: null, at: 0, busy: false },
  storage: { persisted: null, usage: null, quota: null }
};

/* ACT = every activity (defaults + your custom ones), with your XP overrides applied */
export let ACT = {};
export function buildActs() {
  const s = state.settings, A = {};
  DEFAULT_ACTS.forEach(([tree, id, name, xp, once]) => { A[id] = { id, tree, name, xp, once: !!once, custom: false }; });
  (s.custom || []).forEach(c => { if (TREE[c.tree]) A[c.id] = { id: c.id, tree: c.tree, name: c.name, xp: c.xp, once: !!c.once, custom: true }; });
  Object.entries(s.overrides || {}).forEach(([id, xp]) => { if (A[id]) A[id].xp = xp; });
  Object.entries(s.onceOverrides || {}).forEach(([id, v]) => { if (A[id] && !A[id].custom) A[id].once = !!v; });
  const hid = new Set(s.hidden || []); Object.values(A).forEach(a => a.hidden = hid.has(a.id));
  ACT = A;
}
export const defaultXP = id => { const d = DEFAULT_ACTS.find(r => r[1] === id); return d ? d[3] : 0; };
export const defaultOnce = id => { const d = DEFAULT_ACTS.find(r => r[1] === id); return !!(d && d[4]); };

/* fill in anything missing or invalid in saved settings */
export function mergeSettings(s) {
  const out = Object.assign(clone(DEFAULT_SETTINGS), s || {});
  ['favorites', 'perfect', 'hidden', 'custom'].forEach(k => { if (!Array.isArray(out[k])) out[k] = clone(DEFAULT_SETTINGS[k]); });
  ['overrides', 'onceOverrides'].forEach(k => { if (typeof out[k] !== 'object' || !out[k] || Array.isArray(out[k])) out[k] = {}; });
  if (!isYmd(out.startDate)) out.startDate = DEFAULT_SETTINGS.startDate;
  const tgt = Math.round(Number(out.dailyTarget)); out.dailyTarget = tgt >= 1 && tgt <= 5000 ? tgt : DEFAULT_SETTINGS.dailyTarget;
  const rh = Math.round(Number(out.resetHour)); out.resetHour = rh >= 0 && rh <= 11 ? rh : DEFAULT_SETTINGS.resetHour;
  out.v = DEFAULT_SETTINGS.v;
  return out;
}

export const today = () => gameDate(Date.now(), state.settings.resetHour);
export const target = () => state.settings.dailyTarget;
export const startDate = () => state.settings.startDate;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
