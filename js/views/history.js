/* views/history.js: weekly recap, yearly heatmap, and the day-by-day log. */
import { state, ACT, target, startDate } from '../state.js';
import { TREES, TREE, STREAK_MIN } from '../config.js';
import { dayTotal, allEntries, isAuto, qty } from '../leveling.js';
import { addDays, weekStart, dayLabel, shortLabel, parseYmd, DOW, MON, fmtEta, timeLabel } from '../dates.js';
import { weekRecap, yearGrid, yearSummary } from '../stats.js';
import { bossStatus } from '../quests.js';
import { pix } from '../pixel.js';
import { esc, fmt, cv } from '../ui.js';
import { subTabs } from './hero.js';

/* ---------- weekly recap ---------- */
function suggestFor(treeId) {
  const favs = state.settings.favorites.filter(id => ACT[id] && ACT[id].tree === treeId && !ACT[id].once && !ACT[id].hidden);
  const pool = favs.length ? favs : Object.values(ACT).filter(a => a.tree === treeId && !a.once && !a.hidden).map(a => a.id);
  return pool.length ? ACT[pool[0]] : null;
}

function recapHTML(V) {
  const T = V.T, tgt = target();
  const cur = weekStart(T), ws = state.recapWeek || cur;
  const R = weekRecap(state.days, ws, tgt);
  const firstWs = weekStart(Object.keys(state.days).sort()[0] || startDate());
  const maxDay = Math.max(tgt, ...R.cur.byDay.map(d => d.xp));
  const bars = R.cur.byDay.map(d => `<div class="rb ${d.xp >= tgt ? 'hit' : d.xp > 0 ? 'part' : ''} ${d.date === T ? 'today' : ''} ${d.date > T ? 'future' : ''}" style="height:${(d.xp / maxDay * 100).toFixed(1)}%" title="${dayLabel(d.date)}: ${d.xp} XP"></div>`).join('');
  const pct = R.prev.total ? Math.round(R.delta / R.prev.total * 100) : null;
  const deltaTxt = R.prev.total === 0 && R.cur.total === 0 ? 'No XP logged last week either.'
    : R.prev.total === 0 ? `Up from 0 last week.`
    : `${R.delta >= 0 ? '▲' : '▼'} ${R.delta >= 0 ? '+' : ''}${fmt(R.delta)} XP (${pct >= 0 ? '+' : ''}${pct}%) vs last week's ${fmt(R.prev.total)}`;
  const boss = state.quests.weekly[ws];
  const bossTxt = !boss ? '—' : (st => st.doneDate ? 'DEFEATED' : ws === cur ? `${Math.min(st.progress, boss.n)}/${boss.n}` : 'ESCAPED')(bossStatus(boss, state.days, ws));
  const maxTree = Math.max(1, ...TREES.map(t => Math.max(R.cur.byTree[t.id], R.prev.byTree[t.id])));
  const treeRows = TREES.map(t => {
    const a = R.cur.byTree[t.id], b = R.prev.byTree[t.id];
    return `<div class="trow">${pix(t.icon, cv(t.color))}<span class="tn">${esc(t.name)}</span><span class="tv">${fmt(a)} <small>/ ${fmt(b)}</small></span>
      <div class="tbars"><div class="bar thin"><i style="width:${a / maxTree * 100}%;background:${cv(t.color)}"></i></div><div class="ghost" style="width:${b / maxTree * 100}%"></div></div></div>`;
  }).join('');
  const N = R.neglected, sug = suggestFor(N.t.id), isCur = ws === cur;
  let callout;
  if (R.cur.total === 0) callout = `<b>NOTHING LOGGED ${isCur ? 'YET' : 'THIS WEEK'}.</b> ${isCur ? 'The week is still open. One log starts the board.' : 'Zero XP. That week got away from you.'}`;
  else if (N.ratio < .5) callout = `<b>NEGLECTED: ${esc(N.t.name.toUpperCase())}.</b> ${fmt(N.xp)} XP ${isCur ? 'so far' : 'all week'}. The plan is about ${fmt(N.expected)} a week, so that's ${Math.round(N.ratio * 100)}% of it.${sug ? ` Quick fix: <i>${esc(sug.name)}</i> (+${sug.xp}).` : ''}`;
  else callout = `<b>EVERY TREE GOT ATTENTION.</b> Weakest was ${esc(N.t.name)} at ${Math.round(N.ratio * 100)}% of its weekly plan. Nothing neglected.`;
  const S = R.strongest;
  return `<div class="px weeknav"><button class="iconbtn" data-week="-7" ${ws <= firstWs ? 'disabled' : ''} aria-label="Previous week">◀</button><b>${isCur ? 'THIS WEEK' : 'WEEK OF ' + shortLabel(ws)}</b><button class="iconbtn" data-week="7" ${isCur ? 'disabled' : ''} aria-label="Next week">▶</button></div>
  <div class="px recap">
    <div class="recap-top"><div><span class="lbl">${shortLabel(ws)} – ${shortLabel(addDays(ws, 6))}</span><div class="big">${fmt(R.cur.total)} <small>XP</small></div></div></div>
    <div class="delta ${R.delta >= 0 ? 'good' : 'bad'}">${deltaTxt}</div>
    <div class="rbars">${bars}<div class="pace" style="bottom:${(tgt / maxDay * 100).toFixed(1)}%"><span>${tgt}</span></div></div>
    <div class="cdays7">${R.cur.byDay.map(d => `<span>${DOW[parseYmd(d.date).getDay()][0]}</span>`).join('')}</div>
  </div>
  <div class="stats">
    <div class="px stat"><span class="lbl">Best day</span><span class="v">${R.best.date ? DOW[parseYmd(R.best.date).getDay()] : '—'}</span><span class="s">${R.best.date ? fmt(R.best.xp) + ' XP' : 'no logs'}</span></div>
    <div class="px stat"><span class="lbl">Target days</span><span class="v ${R.targetDays >= 5 ? 'good' : ''}">${R.targetDays}/7</span><span class="s">${fmt(tgt)}+ XP</span></div>
    <div class="px stat"><span class="lbl">Streak days</span><span class="v">${R.streakDays}/7</span><span class="s">${STREAK_MIN}+ XP</span></div>
    <div class="px stat"><span class="lbl">Boss</span><span class="v ${bossTxt === 'DEFEATED' ? 'good' : bossTxt === 'ESCAPED' ? 'bad' : ''}">${bossTxt}</span><span class="s">${boss ? esc(boss.name.replace(/^The /, '')) : 'no boss'}</span></div>
  </div>
  <div class="px callout ${R.cur.total && N.ratio < .5 ? 'bad' : ''}">${pix(R.cur.total && N.ratio < .5 ? N.t.icon : 'check', R.cur.total && N.ratio < .5 ? cv(N.t.color) : null)}<p>${callout}</p></div>
  ${R.cur.total ? `<div class="px callout">${pix(S.t.icon, cv(S.t.color))}<p><b>STRONGEST: ${esc(S.t.name.toUpperCase())}.</b> ${fmt(S.xp)} XP, ${Math.round(S.ratio * 100)}% of its weekly plan.</p></div>` : ''}
  <div class="sechead"><h2>TREE BREAKDOWN</h2><span>this week / last</span></div>
  <div class="px tbreak">${treeRows}</div>`;
}

/* ---------- yearly heatmap ---------- */
function yearHTML(V) {
  const T = V.T, tgt = target(), start = startDate();
  const weeks = yearGrid(state.days, start, T, tgt);
  const Y = yearSummary(state.days, start, T, tgt);
  /* label a week column where a month starts (skipping labels that would overlap the previous one) */
  let lastAt = -9;
  const months = weeks.map((w, i) => {
    const start = w.find(c => !c.out && (i === 0 || parseYmd(c.date).getDate() === 1));
    if (!start || i - lastAt < 3) return '<span></span>';
    lastAt = i; return `<span>${MON[parseYmd(start.date).getMonth()]}</span>`;
  }).join('');
  const cells = weeks.map(w => w.map(c => c.out ? '<i class="hc out"></i>'
    : `<i class="hc l${c.lvl} ${c.future ? 'fut' : ''} ${c.today ? 'now' : ''} ${state.heatSel === c.date ? 'sel' : ''}" data-heat="${c.date}" title="${dayLabel(c.date)}: ${c.xp} XP"></i>`).join('')).join('');
  const sel = state.heatSel;
  let selTxt = 'Tap a square to see that day.';
  if (sel) {
    const list = (state.days[sel] || []).filter(e => !isAuto(e));
    selTxt = `<b>${dayLabel(sel)}</b> · ${fmt(dayTotal(state.days, sel))} XP · ${list.reduce((s, e) => s + qty(e), 0)} logs`;
  }
  return `<div class="px heat">
    <div class="heat-head"><span class="lbl">Year one</span><span>${fmtEta(start)} – ${fmtEta(addDays(start, 364))}</span></div>
    <div class="heat-scroll" id="heatScroll">
      <div class="heat-months" style="--w:${weeks.length}">${months}</div>
      <div class="heat-body"><div class="heat-dow"><span>M</span><span></span><span>W</span><span></span><span>F</span><span></span><span>S</span></div>
      <div class="heat-grid" style="--w:${weeks.length}">${cells}</div></div>
    </div>
    <div class="heat-legend"><span>0</span><i class="hc l0"></i><i class="hc l1"></i><i class="hc l2"></i><i class="hc l3"></i><i class="hc l4"></i><span>${fmt(tgt)}+</span></div>
    <div class="heat-sel">${selTxt}</div>
  </div>
  <div class="stats">
    <div class="px stat"><span class="lbl">Year XP</span><span class="v">${fmt(Y.xp)}</span><span class="s">of 56,175 to LV 100</span></div>
    <div class="px stat"><span class="lbl">Active days</span><span class="v">${Y.active}</span><span class="s">of ${Y.elapsed} so far</span></div>
    <div class="px stat"><span class="lbl">Target days</span><span class="v">${Y.hit}</span><span class="s">${fmt(tgt)}+ XP</span></div>
    <div class="px stat"><span class="lbl">Year done</span><span class="v">${Math.round(Y.elapsed / 365 * 100)}%</span><span class="s">day ${Y.elapsed} of 365</span></div>
  </div>`;
}

/* ---------- day-by-day log ---------- */
function daysHTML(V) {
  const T = V.T, tgt = target();
  const days14 = Array.from({ length: 14 }, (_, i) => addDays(T, i - 13));
  const vals = days14.map(d => dayTotal(state.days, d)); const maxY = Math.max(250, tgt, ...vals);
  const chart = `<div class="px chart"><div class="sechead"><h2>LAST 14 DAYS</h2><span>Gold = ${tgt}+ XP</span></div>
    <div class="cwrap">${days14.map((d, i) => { const v = vals[i]; return `<div class="cbar ${v >= tgt ? 'hit' : v > 0 ? 'part' : ''} ${d === T ? 'today' : ''}" style="height:${(v / maxY * 100).toFixed(1)}%" title="${dayLabel(d)}: ${v} XP"></div>`; }).join('')}
    <div class="pace" style="bottom:${(tgt / maxY * 100).toFixed(1)}%"><span>${tgt}</span></div></div>
    <div class="cdays">${days14.map(d => `<span>${DOW[parseYmd(d).getDay()][0]}</span>`).join('')}</div></div>`;
  const dates = Object.keys(state.days).sort().reverse();
  const shown = dates.slice(0, state.histShown);
  let list = shown.map(d => `<div class="px day"><div class="dhead"><b>${dayLabel(d)}${d === T ? ' · TODAY' : ''}</b><span>${fmt(dayTotal(state.days, d))} XP</span></div>
    ${state.days[d].slice().reverse().map(e => {
      const t = TREE[e.t] || TREE.dis;
      return `<div class="hrow ${isAuto(e) ? 'auto' : ''}"><time>${e.bf ? 'added' : timeLabel(e.ts)}</time><span class="dot" style="background:${cv(t.color)}"></span><span class="hn">${esc(e.n)}${qty(e) > 1 ? ` <b class="qn">×${qty(e)}</b>` : ''}</span><span class="hx">+${e.x}</span>${isAuto(e) ? '<span class="autotag" title="Added automatically">AUTO</span>' : `<button class="del" data-del="${d}|${e.id}" aria-label="Delete entry">✕</button>`}</div>`;
    }).join('')}</div>`).join('');
  if (!dates.length) list = `<div class="px empty">Your log is empty. Everything you log shows up here by day, starting ${dayLabel(startDate())}.</div>`;
  const more = dates.length > state.histShown ? `<button class="btn" data-act="more">SHOW OLDER DAYS</button>` : '';
  return `${chart}<div class="sechead"><h2>XP LOG</h2><span>${fmt(allEntries(state.days).length)} entries</span></div>${list}${more}
  <div class="btnrow"><button class="btn" data-act="export-csv">EXPORT CSV</button><button class="btn" data-act="export-json">BACKUP (JSON)</button></div>`;
}

export function viewHistory(V) {
  const sub = state.sub.history;
  const body = sub === 'year' ? yearHTML(V) : sub === 'days' ? daysHTML(V) : recapHTML(V);
  return `<div class="sechead"><h2>${sub === 'year' ? 'YEAR MAP' : sub === 'days' ? 'HISTORY' : 'WEEKLY RECAP'}</h2><span></span></div>
  ${subTabs('history', [['recap', 'RECAP'], ['year', 'YEAR'], ['days', 'DAYS']])}${body}`;
}
