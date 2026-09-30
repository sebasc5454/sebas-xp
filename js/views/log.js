/* views/log.js: every activity, grouped by tree, plus the "log to which day / how many" bar. */
import { state, ACT } from '../state.js';
import { TREES, TREE } from '../config.js';
import { addDays, dayLabel, shortLabel } from '../dates.js';
import { pix } from '../pixel.js';
import { esc, cv } from '../ui.js';
import { countsOn, claimed } from './home.js';

export const MAX_QTY = 10;

function logbarHTML(T) {
  const d = state.logDate || T, past = d !== T, y = addDays(T, -1), q = state.logQty;
  return `<div class="px logbar ${past ? 'past' : ''}">
    <div class="lb-row">
      <span class="lbl">Log to</span>
      <div class="seg">
        <button data-logdate="${T}" aria-pressed="${d === T}">TODAY</button>
        <button data-logdate="${y}" aria-pressed="${d === y}">YESTERDAY</button>
        <label class="datebtn ${past && d !== y ? 'on' : ''}"><span class="sr">Pick a date</span><input type="date" id="logdate" max="${T}" value="${d}"></label>
      </div>
    </div>
    <div class="lb-row">
      <span class="lbl">Quantity</span>
      <div class="stepper" role="group" aria-label="Quantity">
        <button data-qty="-1" aria-label="Less" ${q <= 1 ? 'disabled' : ''}>−</button>
        <b aria-live="polite">×${q}</b>
        <button data-qty="1" aria-label="More" ${q >= MAX_QTY ? 'disabled' : ''}>+</button>
      </div>
    </div>
    ${past ? `<div class="lb-note">Logging to <b>${dayLabel(d)}</b>. Streaks, bonuses, and quests for that day update automatically.</div>` : ''}
  </div>`;
}

export function viewLog(V) {
  const T = V.T, d = state.logDate || T, q = state.q.trim().toLowerCase();
  const c = countsOn(d), cl = claimed(), fav = new Set(state.settings.favorites), pd = new Set(state.settings.perfect);
  const dayTag = d === T ? 'TODAY' : shortLabel(d);
  const show = Object.values(ACT).filter(a => (state.settings.showHidden || !a.hidden) && (state.filter === 'all' || a.tree === state.filter || (state.filter === 'fav' && fav.has(a.id))) && (!q || a.name.toLowerCase().includes(q)));
  const filters = [['all', 'All'], ['fav', 'Favorites']].concat(TREES.map(t => [t.id, t.name]));
  let groups = '';
  TREES.forEach(t => {
    const rows = show.filter(a => a.tree === t.id); if (!rows.length) return;
    groups += `<div class="px group"><div class="ghead">${pix(t.icon, cv(t.color))}<h3 style="color:${cv(t.color)}">${esc(t.name.toUpperCase())}</h3><span>${rows.length}</span></div>
    ${rows.map(a => {
      const lock = a.once && cl.has(a.id), n = a.once ? 1 : state.logQty;
      return `<div class="row">
      <button class="iconbtn star" data-fav="${a.id}" aria-pressed="${fav.has(a.id)}" aria-label="Favorite ${esc(a.name)}">★</button>
      <div class="rname">${esc(a.name)}${a.once ? '<span class="tag">ONE-TIME</span>' : ''}${pd.has(a.id) ? '<span class="tag pdh">DAILY</span>' : ''}${a.custom ? '<span class="tag">CUSTOM</span>' : ''}${a.hidden ? '<span class="tag">HIDDEN</span>' : ''}${c[a.id] ? `<span class="tag today">×${c[a.id]} ${dayTag}</span>` : ''}</div>
      <button class="iconbtn" data-edit="${a.id}" aria-label="Edit ${esc(a.name)}">⋯</button>
      <button class="logbtn" data-log="${a.id}" ${lock || !state.ready ? 'disabled' : ''}>${lock ? 'DONE' : '+' + a.xp * n}${!lock && n > 1 ? `<small>×${n}</small>` : ''}</button>
    </div>`;
    }).join('')}</div>`;
  });
  if (!groups) groups = `<div class="px empty">Nothing matches that search.</div>`;
  const treeOpts = TREES.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  return `<div class="sechead"><h2>QUEST LOG</h2><span>${Object.keys(ACT).length} activities</span></div>
  ${logbarHTML(T)}
  <div class="tools">
    <input class="search" id="q" type="search" placeholder="Search activities" value="${esc(state.q)}" autocomplete="off">
    <div class="filters">${filters.map(([id, l]) => `<button class="fbtn" data-filter="${id}" aria-pressed="${state.filter === id}">${id !== 'all' && id !== 'fav' ? pix(TREE[id].icon, cv(TREE[id].color)) : ''}${esc(l)}</button>`).join('')}</div>
  </div>
  <details class="px custom" id="customBox"><summary>+ CUSTOM XP</summary>
    <div class="fgrid">
      <label class="field span"><span class="lbl">What you did</span><input id="cu-name" maxlength="80" placeholder="e.g. Fixed roommate's bike brakes"></label>
      <label class="field"><span class="lbl">Tree</span><select id="cu-tree">${treeOpts}</select></label>
      <label class="field"><span class="lbl">XP</span><input id="cu-xp" type="number" min="1" max="5000" inputmode="numeric" value="30"></label>
    </div>
    <label class="check"><input type="checkbox" id="cu-once"> One-time achievement (only when saving as an activity)</label>
    <div class="btnrow"><button class="btn gold" data-act="custom-log">LOG IT ONCE</button><button class="btn" data-act="custom-save">SAVE AS ACTIVITY</button></div>
  </details>
  ${groups}`;
}
