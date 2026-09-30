/* views/hero.js: character sheet, skill trees, and badges. */
import { state, ACT, startDate } from '../state.js';
import { TIERS, TREES, W } from '../config.js';
import { tierIdx, rankIdx, pctOf, currentStreak } from '../leveling.js';
import { diffDays, shortLabel, dayLabel } from '../dates.js';
import { GROUPS } from '../achievements.js';
import { pix, heroSprite, HERO_GEAR, pixelRadar, radarLabelPos } from '../pixel.js';
import { esc, fmt, cv } from '../ui.js';

export function subTabs(tab, items) {
  const cur = state.sub[tab];
  return `<div class="seg sub" role="tablist">${items.map(([id, l]) => `<button role="tab" data-sub="${tab}:${id}" aria-selected="${cur === id}">${l}</button>`).join('')}</div>`;
}

function sheetHTML(V) {
  const { S, T, stats: st, badges } = V;
  const ti = tierIdx(S.o.L);
  const best = TREES.slice().sort((a, b) => S.trees[b.id].xp - S.trees[a.id].xp)[0];
  const bestS = S.trees[best.id];
  const fav = st.favId && ACT[st.favId];
  const campaignDay = diffDays(startDate(), T) + 1;
  const got = badges.filter(b => b.got).length;
  const ladder = TIERS.map((tr, i) => `<div class="tier-step ${i === ti ? 'now' : i < ti ? 'past' : ''}" title="${esc(tr[1])}">${heroSprite(i, i > ti)}<small>${tr[0]}</small></div>`).join('');
  const stat = (k, v, sub) => `<div class="kstat"><span class="lbl">${k}</span><b>${v}</b>${sub ? `<em>${sub}</em>` : ''}</div>`;
  /* radar scaled to the highest tree level (at least 10) so the shape is readable early on */
  const maxL = Math.max(...TREES.map(t => S.trees[t.id].L));
  const scale = Math.max(10, Math.ceil(maxL / 10) * 10);
  const radar = pixelRadar(TREES.map(t => (S.trees[t.id].L + pctOf(S.trees[t.id]) / 100) / scale), TREES.map(t => t.color), { label: 'Tree levels radar' });
  const labels = TREES.map((t, i) => { const p = radarLabelPos(i, TREES.length); return `<span class="rlab" style="left:${p.left}%;top:${p.top}%;color:${cv(t.color)}">${pix(t.icon, cv(t.color))}<b>${S.trees[t.id].L}</b></span>`; }).join('');
  const maxXP = Math.max(1, ...TREES.map(t => S.trees[t.id].xp));
  const bars = TREES.slice().sort((a, b) => S.trees[b.id].xp - S.trees[a.id].xp).map(t => {
    const x = S.trees[t.id].xp;
    return `<div class="xrow">${pix(t.icon, cv(t.color))}<span class="xn">${esc(t.name)}</span><span class="xv">${fmt(x)}</span><div class="bar thin"><i style="width:${x / maxXP * 100}%;background:${cv(t.color)}"></i></div></div>`;
  }).join('');
  return `<div class="px charsheet">
      <div class="hero-stage t${ti}">${heroSprite(ti)}</div>
      <div class="hero-info">
        <span class="hud-name">SEBAS</span>
        <div class="hud-lv"><small>LV</small>${S.o.L}</div>
        <div class="hud-rank">${esc(TIERS[ti][1])} <span>· Tier ${TIERS[ti][0]}</span></div>
        <div class="hero-meta"><span>Gear: ${esc(HERO_GEAR[ti])}</span>${ti < 4 ? `<span>Next: ${esc(HERO_GEAR[ti + 1])} at LV ${(ti + 1) * 20 + 1}</span>` : '<span>Fully geared.</span>'}</div>
      </div>
      <div class="tier-ladder">${ladder}</div>
    </div>
    <div class="sechead"><h2>STATS</h2><span>Day ${Math.max(1, campaignDay)} of 365</span></div>
    <div class="px kstats">
      ${stat('Days active', fmt(st.daysActive))}
      ${stat('Best streak', `${st.bestStreak} ${st.bestStreak === 1 ? 'day' : 'days'}`, `Current: ${currentStreak(state.days, T)}`)}
      ${stat('Most XP in a day', fmt(st.maxDay.xp), st.maxDay.date ? dayLabel(st.maxDay.date) : '—')}
      ${stat('Favorite activity', fav ? esc(fav.name) : '—', fav ? `×${st.counts[st.favId]}` : '')}
      ${stat('Activities logged', fmt(st.logs))}
      ${stat('Perfect Days', fmt(st.perfectDays))}
      ${stat('Quests cleared', fmt(st.questsDone), `${st.bosses} ${st.bosses === 1 ? 'boss' : 'bosses'} defeated`)}
      ${stat('Badges', `${got}/${badges.length}`)}
      ${stat('Top tree', esc(best.name), `LV ${bestS.L} · ${esc(best.ranks[rankIdx(bestS.L)])}`)}
      ${stat('Target days', fmt(st.targetDays), `${fmt(state.settings.dailyTarget)}+ XP`)}
    </div>
    <div class="sechead"><h2>BALANCE</h2><span>Tree levels · ring = LV ${scale / 2} / ${scale}</span></div>
    <div class="px radar"><div class="radar-box">${radar}${labels}</div></div>
    <div class="sechead"><h2>XP BY TREE</h2><span>${fmt(S.total)} total</span></div>
    <div class="px xbars">${bars}</div>`;
}

function treesHTML(V) {
  const S = V.S;
  return TREES.map(t => {
    const s = S.trees[t.id], ri = rankIdx(s.L);
    const nextRank = ri < 4 ? `${t.ranks[ri + 1]} at LV ${(ri + 1) * 10 + 1}` : (s.maxed ? 'Tree maxed' : 'Final rank');
    return `<div class="px tree">
      <div class="tree-top">${pix(t.icon, cv(t.color))}<h3 style="color:${cv(t.color)}">${esc(t.name.toUpperCase())}</h3><span class="tl">LV ${s.L}</span></div>
      <div class="tree-rank">${esc(t.ranks[ri])} <span class="muted">· next: ${esc(nextRank)}</span></div>
      <div><div class="bar"><i style="width:${pctOf(s)}%;background:${cv(t.color)}"></i></div>
      <div class="barmeta"><span>${s.maxed ? '<b>MAX</b>' : `<b>${fmt(s.into)}</b> / ${fmt(s.need)} XP`}</span><span>${fmt(s.xp)} XP in tree</span></div></div>
      <div class="ladder">${t.ranks.map((r, i) => `<div class="rung ${i < ri ? 'got' : ''} ${i === ri ? 'now' : ''}" style="${i === ri ? `color:${cv(t.color)}` : ''}"><small>LV ${i * 10 + 1}</small>${esc(r)}</div>`).join('')}</div>
      <div class="muted" style="font-size:13px">Cost per level by rank: ${t.costs.join(' / ')} XP</div>
    </div>`;
  }).join('') +
  `<div class="px set"><h3>OVERALL TIERS</h3><dl class="kv">${TIERS.map((tr, i) => `<dt>Tier ${tr[0]} · LV ${i * 20 + 1}-${i * 20 + 20}</dt><dd>${esc(tr[1])} · ${W[i]} XP/level</dd>`).join('')}</dl></div>`;
}

function badgesHTML(V) {
  const list = V.badges, got = list.filter(b => b.got).length;
  const groups = GROUPS.map(([g, title]) => {
    const items = list.filter(b => b.g === g); if (!items.length) return '';
    const n = items.filter(b => b.got).length;
    return `<div class="sechead"><h2>${title}</h2><span>${n}/${items.length}</span></div>
    <div class="badges">${items.map(b => {
      const col = b.color ? cv(b.color) : 'var(--gold)';
      const since = state.badges[b.id];
      const prog = !b.got && b.need > 1 ? `<div class="bar thin"><i style="width:${Math.min(100, b.have / b.need * 100)}%;background:${col}"></i></div><em>${fmt(Math.min(b.have, b.need))} / ${fmt(b.need)}</em>` : '';
      return `<div class="px badge ${b.got ? 'got' : ''}">
        <div class="bicon" style="--bc:${col}">${pix(b.icon)}</div>
        <div class="bt"><b>${esc(b.name)}</b><span>${esc(b.desc)}</span>${prog}${b.got && since ? `<em>Unlocked ${shortLabel(since)}</em>` : ''}</div>
      </div>`;
    }).join('')}</div>`;
  }).join('');
  return `<div class="px badge-sum"><span class="lbl">Unlocked</span><b>${got} / ${list.length}</b><div class="bar thin"><i style="width:${got / list.length * 100}%"></i></div></div>${groups}`;
}

export function viewHero(V) {
  const sub = state.sub.hero;
  const body = sub === 'trees' ? treesHTML(V) : sub === 'badges' ? badgesHTML(V) : sheetHTML(V);
  return `<div class="sechead"><h2>${sub === 'trees' ? 'SKILL TREES' : sub === 'badges' ? 'BADGES' : 'CHARACTER'}</h2><span>${sub === 'trees' ? 'New rank every 10 levels' : ''}</span></div>
  ${subTabs('hero', [['sheet', 'SHEET'], ['trees', 'TREES'], ['badges', 'BADGES']])}${body}`;
}
