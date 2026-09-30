/* views/home.js: the status screen. HUD, stats, notices, quests, Perfect Day, favorites, skill trees. */
import { state, ACT, target, startDate } from '../state.js';
import { TIERS, TREES, TREE, XP_TO_100, STREAK_MIN } from '../config.js';
import { tierIdx, rankIdx, pctOf, dayTotal, dayBase, currentStreak, isAuto, qty, allEntries } from '../leveling.js';
import { diffDays, addDays, fmtEta, weekStart, weekDates, shortLabel } from '../dates.js';
import { questProgress, questText, questTree, bossStatus } from '../quests.js';
import { pix, crest } from '../pixel.js';
import { esc, fmt, cv } from '../ui.js';

export function countsOn(date) {
  const m = {}; (state.days[date] || []).forEach(e => { if (e.a && !isAuto(e)) m[e.a] = (m[e.a] || 0) + qty(e); }); return m;
}
export function claimed() { const s = new Set(); for (const d in state.days) for (const e of state.days[d]) if (e.a) s.add(e.a); return s; }

export function hudHTML(S) {
  const o = S.o, ti = tierIdx(o.L), pct = pctOf(o);
  return `<div class="px hud" id="hud">
    <div class="crest" id="hud-crest">${crest(ti)}</div>
    <div>
      <div class="hud-top"><span class="hud-name">SEBAS</span><span class="sync" id="sync"></span></div>
      <div class="hud-lv"><small>LV</small><span id="hud-lvnum">${o.L}</span></div>
      <div class="hud-rank">${esc(TIERS[ti][1])} <span>· Tier ${TIERS[ti][0]}</span></div>
    </div>
    <div class="hud-bar">
      <div class="bar" role="progressbar" aria-label="XP to next level" aria-valuemin="0" aria-valuemax="${o.need || 1}" aria-valuenow="${o.into}"><i id="hud-fill" style="width:${pct.toFixed(2)}%"></i></div>
      <div class="barmeta"><span>${o.maxed ? '<b>MAX LEVEL</b>' : `<b>${fmt(o.into)}</b> / ${fmt(o.need)} XP`}</span><span>${fmt(S.total)} total XP</span></div>
    </div>
  </div>`;
}

function statsHTML(S, T) {
  const tx = dayTotal(state.days, T), tgt = target(), start = startDate();
  const elapsed = Math.max(1, diffDays(start, T) + 1);
  const delta = S.total - (elapsed - 1) * tgt;
  let eta;
  if (S.o.maxed) eta = 'DONE';
  else if (elapsed >= 3 && S.total > 0) { const avg = S.total / elapsed; const days = Math.ceil((XP_TO_100 - S.total) / avg); eta = days > 3650 ? '10+ YRS' : fmtEta(addDays(T, days)); }
  else eta = fmtEta(addDays(start, Math.ceil(XP_TO_100 / tgt)));
  const streak = currentStreak(state.days, T);
  return `<div class="stats">
    <div class="px stat"><span class="lbl">Today</span><span class="v ${tx >= tgt ? 'good' : ''}">${fmt(tx)} XP</span><div class="bar thin"><i style="width:${Math.min(100, tx / tgt * 100)}%"></i></div><span class="s">Target ${fmt(tgt)}</span></div>
    <div class="px stat"><span class="lbl">Streak</span><span class="v">${streak} ${streak === 1 ? 'DAY' : 'DAYS'}</span><span class="s">${STREAK_MIN}+ XP days</span></div>
    <div class="px stat"><span class="lbl">Pace</span><span class="v ${delta >= 0 ? 'good' : 'bad'}">${delta >= 0 ? '+' : ''}${fmt(delta)}</span><span class="s">${delta >= 0 ? 'XP ahead of plan' : 'XP behind plan'}</span></div>
    <div class="px stat"><span class="lbl">LV 100 ETA</span><span class="v">${eta}</span><span class="s">${elapsed >= 3 && S.total > 0 ? 'at your current rate' : `on the ${fmt(tgt)}/day plan`}</span></div>
  </div>`;
}

/* banners that only show when they matter */
function noticesHTML(T) {
  const out = [], s = state.settings, now = new Date();
  const note = (cls, icon, body, btn) => `<div class="px notice ${cls}">${pix(icon)}<div class="nb">${body}</div>${btn || ''}</div>`;
  if (state.save.error) out.push(note('bad', 'disk', `<b>SAVE PROBLEM</b><span>Your last change didn't reach the main save. It's in the backup copy; the app will retry. Export a backup to be safe.</span>`, `<button class="btn" data-act="export-json">BACK UP</button>`));
  if (state.env.ios && !state.env.standalone) out.push(note('', 'phone', `<b>INSTALL ON YOUR IPHONE</b><span>Tap Share → Add to Home Screen, then log only from the home screen app. Safari and the installed app keep separate saves.</span>`));
  const entries = allEntries(state.days);
  if (entries.length) {
    const since = s.lastBackup || Math.min(...entries.map(e => e.ts));
    const daysSince = Math.floor((Date.now() - since) / 864e5);
    if (daysSince >= 7) out.push(note('warn', 'disk', `<b>BACKUP REMINDER</b><span>${s.lastBackup ? `Last backup was ${daysSince} days ago.` : `You've never exported a backup.`} It's the only copy outside this ${state.env.standalone ? 'app' : 'browser'}.</span>`, `<button class="btn gold" data-act="export-json">BACK UP</button>`));
  }
  const base = dayBase(state.days, T), h = now.getHours();
  const evening = h >= 19 || h < s.resetHour;
  if (s.nudges && evening && base < STREAK_MIN) {
    const run = currentStreak(state.days, T);
    out.push(note('warn', 'moon', `<b>EVENING CHECK</b><span>${fmt(base)} XP today. ${STREAK_MIN - base} more ${run ? `keeps your ${run}-day streak alive` : 'starts a streak'}. The day resets at ${s.resetHour === 0 ? 'midnight' : s.resetHour + ' AM'}.</span>`));
  }
  const ws = weekStart(T);
  if (ws === T) {
    const last = weekDates(addDays(ws, -7)).reduce((sum, d) => sum + dayTotal(state.days, d), 0);
    if (last > 0) out.push(note('', 'scroll', `<b>WEEKLY RECAP READY</b><span>Last week: ${fmt(last)} XP.</span>`, `<button class="btn" data-act="goto-recap">VIEW</button>`));
  }
  return out.join('');
}

function questsHTML(T) {
  const dq = state.quests.daily[T];
  const ws = weekStart(T), boss = state.quests.weekly[ws];
  if (!dq && !boss) return '';
  const entries = state.days[T] || [];
  const rows = dq ? dq.list.map(q => {
    const p = Math.min(q.n, questProgress(q, entries)), done = p >= q.n, t = TREE[questTree(q, ACT)];
    const canReroll = !dq.rerolled && !done && p === 0;
    const prog = q.kind === 'xp' || q.kind === 'tree' ? `${fmt(p)}/${fmt(q.n)}` : `${p}/${q.n}`;
    return `<div class="qrow ${done ? 'done' : ''}">
      <span class="qbox" style="color:${cv(t.color)}">${done ? pix('check') : pix(q.kind === 'act' ? t.icon : 'quest')}</span>
      <span class="qn">${q.kind === 'act' ? '<span class="qverb">LOG</span> ' : ''}${esc(questText(q, ACT))}</span>
      <span class="qp">${done ? 'CLEARED' : prog}</span>
      <span class="qx">+${q.x}</span>
      ${canReroll ? `<button class="iconbtn reroll" data-reroll="${q.id}" aria-label="Swap this quest (once a day)" title="Swap quest (once a day)">↻</button>` : '<span></span>'}
    </div>`;
  }).join('') : '';
  let bossHTML = '';
  if (boss) {
    const st = bossStatus(boss, state.days, ws), p = Math.min(boss.n, st.progress), dead = !!st.doneDate;
    const left = 6 - diffDays(ws, T);
    bossHTML = `<div class="boss ${dead ? 'dead' : ''}">
      <div class="boss-top">${pix('skull')}<span class="lbl">Weekly boss</span><span class="boss-x">+${boss.x} XP</span></div>
      <div class="boss-name">${esc(boss.name)}</div>
      <div class="boss-goal">${boss.kind === 'act' ? 'Log ' : ''}${esc(questText(boss, ACT))} this week</div>
      <div class="bar thin boss-bar"><i style="width:${p / boss.n * 100}%"></i></div>
      <div class="barmeta"><span><b>${p}</b> / ${boss.n}${boss.kind === 'tree' ? ' XP' : ''}</span><span>${dead ? `DEFEATED ${shortLabel(st.doneDate)}` : left === 0 ? 'LAST DAY' : `${left} day${left === 1 ? '' : 's'} left`}</span></div>
    </div>`;
  }
  const cleared = dq ? dq.list.filter(q => questProgress(q, entries) >= q.n).length : 0;
  return `<div class="sechead"><h2>QUESTS</h2><span>${dq ? `${cleared}/3 cleared today` : ''}</span></div>
    <div class="px quests">${rows}${bossHTML}</div>`;
}

function perfectHTML(T) {
  const ids = (state.settings.perfect || []).filter(id => ACT[id]);
  if (!ids.length) return `<div class="px pd"><div class="pd-top"><span class="lbl">Perfect Day</span></div><p class="muted" style="margin:0">Pick your daily habits from any activity's ⋯ menu in the Log tab. Hit all of them in one day for +25 XP.</p></div>`;
  const c = countsOn(T); const done = ids.filter(id => c[id]).length; const full = done === ids.length;
  return `<div class="px pd ${full ? 'complete' : ''}">
    <div class="pd-top"><span class="lbl">Perfect Day ${full ? '· complete' : ''}</span><b style="color:${full ? cv('--gold') : cv('--ink')}">${done}/${ids.length}</b></div>
    <div class="pd-list">${ids.map(id => `<button class="chip ${c[id] ? 'done' : ''}" ${c[id] ? 'disabled' : `data-log="${id}"`}><span class="box"></span>${esc(ACT[id].name)}</button>`).join('')}</div>
    <div class="muted" style="font-size:14px">${full ? '+25 XP bonus earned today.' : 'Tap a habit to log it. Finish them all today for +25 XP.'}</div>
  </div>`;
}

function favsHTML(T) {
  const favs = (state.settings.favorites || []).filter(id => ACT[id]); const c = countsOn(T); const cl = claimed();
  if (!favs.length) return `<div class="px empty">No favorites yet. Tap the star next to any activity in the Log tab to pin it here.</div>`;
  return `<div class="favs">${favs.map(id => {
    const a = ACT[id], t = TREE[a.tree]; const lock = a.once && cl.has(id);
    return `<button class="fav" data-log="${id}" ${lock || !state.ready ? 'disabled' : ''}>${pix(t.icon, cv(t.color))}<span class="fname">${esc(a.name)}</span><span class="fx"><b>${lock ? 'CLAIMED' : '+' + a.xp + ' XP'}</b><em>${c[id] ? '×' + c[id] + ' today' : ''}</em></span></button>`;
  }).join('')}</div>`;
}

export function miniTreesHTML(S) {
  return `<div class="px mini">${TREES.map(t => {
    const s = S.trees[t.id];
    return `<div class="mrow">${pix(t.icon, cv(t.color))}<span class="mn">${esc(t.name)} <span>${esc(t.ranks[rankIdx(s.L)])}</span></span><span class="ml" style="color:${cv(t.color)}">LV ${s.L}</span><div class="bar thin"><i style="width:${pctOf(s)}%;background:${cv(t.color)}"></i></div></div>`;
  }).join('')}</div>`;
}

export function viewHome(V) {
  const { S, T } = V;
  return `${hudHTML(S)}${state.ready ? '' : '<div class="loading">LOADING SAVE FILE…</div>'}${noticesHTML(T)}${statsHTML(S, T)}
  ${questsHTML(T)}
  ${perfectHTML(T)}
  <div class="sechead"><h2>FAVORITES</h2><span>Tap to log today</span></div>${favsHTML(T)}
  <div class="sechead"><h2>SKILL TREES</h2><span>7 trees · LV 50 max</span></div>${miniTreesHTML(S)}`;
}
