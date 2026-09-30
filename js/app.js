/* app.js: starts the app and handles everything you tap.
   Flow: tap → change `state` → settle bonuses/quests → save (shadow copy instantly, database right after) → render. */
import { TREES, TREE, TIERS, DEFAULT_SETTINGS } from './config.js';
import { state, ACT, buildActs, mergeSettings, today, target, uid, defaultXP, defaultOnce } from './state.js';
import { addDays, weekStart, backdateTs, shortLabel, dayLabel, isYmd, pad, diffDays } from './dates.js';
import { snapshot, tierIdx, rankIdx, pctOf, allEntries, isAuto, qty } from './leveling.js';
import { settle, applyDay } from './rules.js';
import { makeDailyQuests, makeBoss, rerollQuest } from './quests.js';
import { lifetimeStats } from './stats.js';
import { evaluateBadges, BADGES } from './achievements.js';
import * as store from './storage.js';
import * as sync from './sync.js';
import { mergeEntryRows, mergeSettingsDoc, mergeBadgesDoc, mergeQuestWeek, packQuestWeek, questKey, indexEntries } from './syncmerge.js';
import { sfx, buzz, shake, unlockAudio } from './feel.js';
import { $, esc, cv, fmt, toast, floatXP, showOverlay, openSheet, closeSheet, sheetOpen } from './ui.js';
import { pix, crest, heroSprite, HERO_GEAR } from './pixel.js';
import { viewHome, claimed } from './views/home.js';
import { viewLog, MAX_QTY } from './views/log.js';
import { viewHero } from './views/hero.js';
import { viewHistory } from './views/history.js';
import { viewSetup } from './views/setup.js';

const rulesCtx = () => ({ perfect: (state.settings.perfect || []).filter(id => ACT[id]), quests: state.quests, acts: ACT });
const questCtx = () => ({ acts: ACT, favorites: state.settings.favorites, perfect: state.settings.perfect, days: state.days, target: target() });
const normQuests = q => ({ daily: (q && q.daily) || {}, weekly: (q && q.weekly) || {} });
let preImport = null;   // data from before the last "Import → Replace", so it can be undone

/* =====================================================================
   SAVING
   Every change writes the shadow copy immediately, then the database.
   ===================================================================== */
const dirty = new Set();
let flushing = null, again = false;
let savedAt = 0;   // bumps on every change; on launch, whichever copy has the newest savedAt wins
const metaNow = () => ({ settings: state.settings, quests: state.quests, badges: state.badges, outbox: state.outbox, savedAt });
const writeShadow = () => store.writeShadow({ savedAt, days: state.days, meta: metaNow() });

/* save now; `quiet` = don't trigger a cloud sync (used by the sync code itself) */
function persist(dates, quiet) {
  (dates || []).forEach(d => dirty.add(d));
  savedAt = Date.now();
  writeShadow();
  flush();
  if (!quiet) scheduleSync();
}
function flush() {
  if (flushing) { again = true; return flushing; }
  state.save.pending = 1; syncLabel();
  flushing = (async () => {
    do {
      again = false;
      const ds = [...dirty]; dirty.clear();
      try { await store.saveChanges(state.days, ds, metaNow()); state.save.error = false; state.save.at = Date.now(); }
      catch (e) {
        console.error('Save failed', e); ds.forEach(d => dirty.add(d));
        if (!state.save.error) toast('Saving hit a snag. Your log is safe in the backup copy; retrying.', { bad: true });
        state.save.error = true; setTimeout(flush, 5000); break;
      }
    } while (again);
  })().finally(() => { flushing = null; state.save.pending = 0; syncLabel(); });
  return flushing;
}
function syncLabel() {
  const el = $('#sync'); if (!el) return;
  let txt = 'LOADING', warn = false;
  if (state.ready) {
    if (state.save.error) { txt = 'SAVE RETRY'; warn = true; }
    else if (state.save.pending) txt = 'SAVING';
    else txt = store.mode === 'local' ? 'SAVED (BACKUP COPY)' : 'SAVED';
    if (!state.save.error && !state.save.pending && signedIn()) {
      const st = state.sync.status;
      if (st === 'syncing') txt = 'SYNCING';
      else if (st === 'ok') txt = Object.keys(state.outbox.ent).length ? 'SAVED' : 'SYNCED';
      else if (st === 'offline') txt = 'SAVED · OFFLINE';
      else if (st === 'error') { txt = 'SYNC ERROR'; warn = true; }
    }
  }
  el.textContent = txt; el.classList.toggle('warn', warn);
}
function saveSettings() { state.settings._at = Date.now(); markDoc('settings'); buildActs(); persist([]); }
function refreshStorage() { store.storageInfo().then(i => { state.storage = i; if (state.tab === 'setup') render(); }); }

/* =====================================================================
   QUESTS
   ===================================================================== */
function ensureQuests() {
  const T = today(), ws = weekStart(T); let changed = false;
  const now = Date.now();
  if (!state.quests.daily[T]) { state.quests.daily[T] = Object.assign(makeDailyQuests(T, questCtx()), { genAt: now, modAt: now }); changed = true; }
  if (!state.quests.weekly[ws]) { const prev = state.quests.weekly[addDays(ws, -7)]; state.quests.weekly[ws] = Object.assign(makeBoss(ws, questCtx(), prev && prev.id), { genAt: now, modAt: now }); changed = true; }
  if (changed) {
    markDoc(questKey(ws));
    const cut = addDays(T, -800);   // keep ~2 years of quest history
    Object.keys(state.quests.daily).forEach(d => { if (d < cut) delete state.quests.daily[d]; });
    Object.keys(state.quests.weekly).forEach(d => { if (d < cut) delete state.quests.weekly[d]; });
    const ch = settle(state.days, ws, rulesCtx(), uid);   // award anything already done today
    persist(ch.map(c => c.date));
  }
  return changed;
}

/* =====================================================================
   LOGGING
   ===================================================================== */
function badgeCtx(snap) { return { s: lifetimeStats(state.days, target()), snap, settings: state.settings }; }
function gameState() {
  const snap = snapshot(state.days);
  const got = new Set(evaluateBadges(badgeCtx(snap)).filter(b => b.got).map(b => b.id));
  return { snap, got };
}
function recordBadges(got) {
  let changed = false;
  got.forEach(id => { if (!state.badges[id]) { state.badges[id] = today(); changed = true; } });
  if (changed) markDoc('badges');
  return changed;
}

function logActivity(id, el, opt) {
  const a = ACT[id]; if (!a) return;
  if (!state.ready) { toast('Still loading your save file.'); return; }
  if (a.once && claimed().has(id)) { toast('Already claimed'); return; }
  const T = today(), date = opt.date || T, q = a.once ? 1 : Math.max(1, Math.min(MAX_QTY, opt.qty || 1));
  if (date > T) { toast("Can't log to a future day."); return; }
  const e = { id: uid(), ts: date === T ? Date.now() : backdateTs(date, Date.now(), state.settings.resetHour), a: id, n: a.name, t: a.tree, x: a.xp * q, k: 'log' };
  if (q > 1) e.q = q;
  if (date !== T) e.bf = 1;
  addEntries(date, [e], el);
}

function addEntries(date, entries, el) {
  const at = el && el.isConnected ? el.getBoundingClientRect() : null;   // where to float "+XP" from
  const before = gameState();
  applyDay(state.days, date, entries, []);
  markPut(entries);
  const changed = settle(state.days, date, rulesCtx(), uid);
  const after = gameState();
  recordBadges(after.got);
  persist([date, ...changed.map(c => c.date)]);
  render();
  const gained = entries.reduce((s, e) => s + e.x, 0);
  const autos = changed.flatMap(c => c.add);
  celebrate(before, after, gained, autos, at);
  const e = entries[0];
  toast(`+${gained} XP · ${e.n}${qty(e) > 1 ? ' ×' + qty(e) : ''}${date !== today() ? ' · ' + shortLabel(date) : ''}`, { undo: () => removeEntries(date, entries.map(x => x.id), 'Undone') });
}

function removeEntries(date, ids, msg) {
  applyDay(state.days, date, [], ids);
  markDel(ids);
  const changed = settle(state.days, date, rulesCtx(), uid);
  persist([date, ...changed.map(c => c.date)]);
  render();
  if (msg) toast(msg);
}

/* =====================================================================
   CELEBRATIONS
   ===================================================================== */
function animateHud(beforePct) {
  const el = $('#hud-fill'); if (!el) return;
  const bar = el.parentElement, end = el.style.width, lv = $('#hud-lvnum');
  el.classList.add('smooth');
  el.style.transition = 'none'; el.style.width = beforePct + '%'; void el.offsetWidth; el.style.transition = '';
  el.style.width = '100%';
  setTimeout(() => {
    bar.classList.add('flash'); if (lv) lv.classList.add('bump');
    el.style.transition = 'none'; el.style.width = '0%'; void el.offsetWidth; el.style.transition = ''; el.style.width = end;
    setTimeout(() => { bar.classList.remove('flash'); el.classList.remove('smooth'); if (lv) lv.classList.remove('bump'); }, 800);
  }, 620);
}
function countUp(el, from, to) {
  if (!el || to <= from) return;
  let n = from; const step = () => { n++; el.textContent = n; if (n < to) setTimeout(step, 110); };
  setTimeout(step, 250);
}
const treeLines = ls => ls.length ? `<ul>${ls.map(l => `<li>${pix(TREE[l.t].icon, cv(TREE[l.t].color))} <b>${esc(TREE[l.t].name)}</b> ${l.rank ? `ranked up to <b>${esc(l.rank)}</b>` : 'reached'} LV ${l.L}</li>`).join('')}</ul>` : '';

function celebrate(b, a, gained, autos, at) {
  const s = state.settings;
  floatXP(at, `+${gained} XP`);
  buzz('tap', s.haptics);
  const lines = [];
  TREES.forEach(t => { const lb = b.snap.trees[t.id].L, la = a.snap.trees[t.id].L; if (la > lb) { const rb = rankIdx(lb), ra = rankIdx(la); lines.push({ t: t.id, L: la, rank: ra > rb ? t.ranks[ra] : null }); } });
  const bo = b.snap.o, ao = a.snap.o;
  const overlays = [];   // shown one after another: level/rank → boss → badges
  if (ao.L > bo.L) {
    const tb = tierIdx(bo.L), ta = tierIdx(ao.L), tierUp = ta > tb;
    const html = tierUp
      ? `<h2>RANK UP!</h2><div class="ov-hero">${heroSprite(ta)}</div><div class="big">LV <span data-count>${bo.L}</span></div><div class="sub">${esc(TIERS[ta][1])} · Tier ${TIERS[ta][0]}</div><div class="gear-new">NEW GEAR · ${esc(HERO_GEAR[ta])}</div>${treeLines(lines)}`
      : `<h2>${ao.L >= 100 ? 'MAX LEVEL' : 'LEVEL UP!'}</h2><div class="crest">${crest(ta)}</div><div class="big">LV <span data-count>${bo.L}</span></div><div class="sub">${esc(TIERS[ta][1])}</div>${treeLines(lines)}`;
    overlays.push(() => showOverlay(html, {
      sparks: tierUp ? 36 : 22, color: tierUp ? `var(${TIERS[ta][2]})` : null, cls: tierUp ? 'tierup' : '', label: tierUp ? 'Rank up' : 'Level up',
      onShow: ov => { sfx(tierUp ? 'rank' : 'level', s.sound); buzz(tierUp ? 'rank' : 'level', s.haptics); if (tierUp) shake(true); countUp(ov.querySelector('[data-count]'), bo.L, ao.L); }
    }));
  } else if (lines.some(l => l.rank)) {
    overlays.push(() => showOverlay(`<h2>SKILL RANK UP!</h2>${treeLines(lines.filter(l => l.rank))}`, { label: 'Skill rank up', onShow: () => { sfx('level', s.sound); buzz('level', s.haptics); shake(false); } }));
  } else if (lines.length) {
    lines.forEach(l => toast(`${TREE[l.t].name.toUpperCase()} REACHED LV ${l.L}`, { gold: true })); sfx('small', s.sound);
  } else sfx('blip', s.sound);

  autos.forEach(e => {
    if (e.b === 'boss') overlays.push(() => showOverlay(`<h2>BOSS DEFEATED!</h2><div class="ov-icon">${pix('skull')}</div><div class="sub">${esc(e.n.replace('Boss defeated: ', ''))}</div><div class="big">+${e.x} <small>XP</small></div>`,
      { label: 'Boss defeated', sparks: 28, onShow: () => { sfx('level', s.sound); buzz('rank', s.haptics); shake(true); } }));
    else toast(`${e.k === 'quest' ? 'QUEST CLEARED' : e.n.toUpperCase()} · +${e.x} XP`, { gold: true });
  });
  if (!overlays.length && autos.length) { sfx('quest', s.sound); buzz('quest', s.haptics); }
  const fresh = [...a.got].filter(id => !b.got.has(id));
  if (fresh.length) overlays.push(() => announceBadges(fresh));

  const levelUp = ao.L > bo.L;
  if (levelUp && state.tab === 'home') animateHud(pctOf(bo));
  /* on Home, let the XP bar fill up first */
  setTimeout(() => overlays.forEach(show => show()), levelUp && state.tab === 'home' ? 700 : 0);
}

function announceBadges(ids) {
  if (!ids.length) return;
  const list = ids.map(id => BADGES.find(x => x.id === id)).filter(Boolean);
  const cards = list.slice(0, 4).map(bd => `<div class="ov-badge"><span class="bicon got" style="--bc:${bd.color ? cv(bd.color) : 'var(--gold)'}">${pix(bd.icon)}</span><span><b>${esc(bd.name)}</b><em>${esc(bd.desc)}</em></span></div>`).join('');
  showOverlay(`<h2>${list.length > 1 ? list.length + ' BADGES!' : 'BADGE UNLOCKED!'}</h2>${cards}${list.length > 4 ? `<p class="muted">+${list.length - 4} more in Hero → Badges</p>` : ''}`,
    { label: 'Badge unlocked', sparks: 14, onShow: () => { sfx('badge', state.settings.sound); buzz('badge', state.settings.haptics); } });
}
/* for badges earned outside of logging (backup, install) */
function checkBadges() {
  const before = new Set(Object.keys(state.badges));
  const got = gameState().got;
  if (recordBadges(got)) { persist([]); announceBadges([...got].filter(id => !before.has(id))); }
}

/* =====================================================================
   CLOUD SYNC (optional). See sync.js, syncmerge.js, README → Cloud sync.
   Every local change is noted in state.outbox (saved with your data, so it survives the app closing).
   A sync round: download what other devices changed → merge → upload the outbox.
   ===================================================================== */
function signedIn() { return sync.configured() && !!sync.currentUser(); }
function markPut(entries) { if (signedIn()) entries.forEach(e => { if (!isAuto(e)) state.outbox.ent[e.id] = 'put'; }); }
function markDel(ids) { if (signedIn()) ids.forEach(id => { state.outbox.ent[id] = 'del'; }); }
function markDoc(key) { if (signedIn()) state.outbox.docs[key] = Date.now(); }

let syncTimer = null, syncRun = null, syncAgain = false;
function scheduleSync(ms) { if (!signedIn()) return; clearTimeout(syncTimer); syncTimer = setTimeout(runSync, ms == null ? 1500 : ms); }
function runSync() {
  if (!signedIn() || !state.ready) return Promise.resolve();
  if (syncRun) { syncAgain = true; return syncRun; }
  clearTimeout(syncTimer);
  const prevStatus = state.sync.status;
  state.sync.status = 'syncing'; syncLabel();
  syncRun = (async () => {
    let rounds = 0;
    do { syncAgain = false; await pullRemote(); await pushOutbox(); } while (syncAgain && ++rounds < 3);
    state.sync.status = 'ok'; state.sync.error = null; state.sync.at = Date.now();
  })().catch(e => {
    console.warn('Sync failed', e);
    state.sync.status = e.status === 0 ? 'offline' : 'error'; state.sync.error = e.message;
    if (e.status === 401 && !sync.currentUser()) toast(e.message, { bad: true });
  }).finally(() => {
    syncRun = null; syncLabel();
    /* refresh Setup only when the status changes, and never while you're typing in it */
    const a = document.activeElement, typing = a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName);
    if (state.tab === 'setup' && prevStatus !== state.sync.status && !typing) render();
  });
  return syncRun;
}

/* server timestamps have microseconds; trim to milliseconds so every browser can read them */
const serverMs = iso => Date.parse(String(iso).replace(/(\.\d{3})\d+/, '$1'));
async function pullRemote() {
  const meta = sync.syncMeta(), full = !meta.cursorD;
  const back = iso => iso ? new Date(serverMs(iso) - 30e3).toISOString() : null;   // 30 s overlap so nothing slips between rounds
  const [rowsE, rowsD] = await Promise.all([sync.pullRows('entries', back(meta.cursorE)), sync.pullRows('docs', back(meta.cursorD))]);
  applyRemote(rowsE, rowsD, full);
  const latest = (rows, cur) => rows.reduce((m, r) => (!m || serverMs(r.updated_at) > serverMs(m) ? r.updated_at : m), cur || null);
  sync.setSyncMeta(Object.assign(meta, { cursorE: latest(rowsE, meta.cursorE), cursorD: latest(rowsD, meta.cursorD) || '1970-01-01T00:00:00Z' }));
}

function applyRemote(rowsE, rowsD, full) {
  if (!rowsE.length && !rowsD.length && !full) return;
  let from = null, settingsChanged = false;
  const note = d => { if (d && (!from || d < from)) from = d; };
  const { dates, added } = mergeEntryRows(state.days, rowsE, state.outbox.ent);
  dates.forEach(note);
  const seen = new Set();
  for (const r of rowsD) {
    seen.add(r.key);
    if (r.key === 'settings') {
      const m = mergeSettingsDoc(state.settings, r.value);
      if (m.adopt) { state.settings = mergeSettings(r.value); settingsChanged = true; note(today()); }
      else if (m.push) markDoc('settings');
    } else if (r.key === 'badges') {
      const m = mergeBadgesDoc(state.badges, r.value); state.badges = m.badges; if (m.push) markDoc('badges');
    } else if (r.key.startsWith('quests:') && isYmd(r.key.slice(7))) {
      const m = mergeQuestWeek(state.quests, r.key.slice(7), r.value);
      if (m.changedDates.length) note(r.key.slice(7));
      if (m.push) markDoc(r.key);
    }
  }
  if (full) {   // first sync from this device: upload any docs the cloud doesn't have yet
    if (!seen.has('settings')) markDoc('settings');
    if (!seen.has('badges')) markDoc('badges');
    new Set([...Object.keys(state.quests.daily).map(weekStart), ...Object.keys(state.quests.weekly)]).forEach(ws => { if (!seen.has(questKey(ws))) markDoc(questKey(ws)); });
  }
  buildActs();
  const ch = from ? settle(state.days, from, rulesCtx(), uid) : [];   // recompute bonuses + quest XP locally
  if (settingsChanged) ensureQuests();
  recordBadges(gameState().got);
  persist([...dates, ...ch.map(c => c.date)], true);
  render();
  if (added) toast(`Synced ${added} log${added === 1 ? '' : 's'} from your other device.`, { gold: true });
}

async function pushOutbox() {
  const ent = Object.assign({}, state.outbox.ent), docs = Object.assign({}, state.outbox.docs);
  const ids = Object.keys(ent), keys = Object.keys(docs);
  if (!ids.length && !keys.length) return;
  const me = sync.currentUser().id, idx = indexEntries(state.days);
  const rows = ids.map(id => {
    const hit = idx.get(id);
    return ent[id] === 'put' && hit && !isAuto(hit.e)
      ? { user_id: me, id, date: hit.date, data: hit.e, deleted: false }
      : { user_id: me, id, date: hit ? hit.date : '', data: {}, deleted: true };
  });
  const docValue = k => k === 'settings' ? state.settings : k === 'badges' ? state.badges : k.startsWith('quests:') ? packQuestWeek(state.quests, k.slice(7)) : null;
  const docRows = keys.map(k => ({ user_id: me, key: k, value: docValue(k) })).filter(r => r.value);
  await sync.pushRows('entries', rows);
  await sync.pushRows('docs', docRows);
  ids.forEach(id => { if (state.outbox.ent[id] === ent[id]) delete state.outbox.ent[id]; });   // keep anything that changed mid-upload
  keys.forEach(k => { if (state.outbox.docs[k] === docs[k]) delete state.outbox.docs[k]; });
  persist([], true);
}

async function syncSignIn(create) {
  const email = ($('#sy-email').value || '').trim(), pw = $('#sy-pass').value || '';
  if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Enter your email address.'); return; }
  if (pw.length < 6) { toast('The password needs at least 6 characters.'); return; }
  state.sync.busy = true; render();
  try {
    if (create && !(await sync.signUp(email, pw))) { toast('Account made. Open the confirmation email from Supabase, then come back and tap SIGN IN.', { ms: 9000 }); return; }
    if (!create) await sync.signIn(email, pw);
    /* first sync from this device: upload everything here, download everything there */
    sync.setSyncMeta({});
    for (const d in state.days) for (const e of state.days[d]) if (!isAuto(e)) state.outbox.ent[e.id] = 'put';
    persist([], true);
    await runSync();
    if (state.sync.status === 'ok') toast('Sync is on. This device is up to date.', { gold: true });
    else toast(`Signed in, but the first sync failed: ${state.sync.error}`, { bad: true });
  } catch (e) { toast(e.message, { bad: true }); }
  finally { state.sync.busy = false; render(); }
}
async function syncSignOut() {
  await sync.signOut();
  state.outbox = { ent: {}, docs: {} }; state.sync = { status: 'off', error: null, at: 0, busy: false };
  persist([], true); render();
  toast('Signed out. Everything stays on this device.');
}

/* =====================================================================
   BACKUPS
   ===================================================================== */
async function exportJSON() {
  const ok = await store.saveFile(`sebas-xp-backup-${today()}.json`, store.makeBackup(state), 'application/json');
  if (!ok) return;
  state.settings.lastBackup = Date.now(); saveSettings(); render();
  toast('Backup saved. Keep it somewhere safe (Files, iCloud Drive).', { gold: true });
  checkBadges();
}
async function exportCSV() {
  const rows = [['date', 'time', 'activity', 'tree', 'xp', 'qty', 'type']];
  Object.keys(state.days).sort().forEach(d => state.days[d].forEach(e => { const tm = new Date(e.ts); rows.push([d, e.bf ? '' : `${pad(tm.getHours())}:${pad(tm.getMinutes())}`, e.n, (TREE[e.t] || {}).name || e.t, e.x, qty(e), e.k]); }));
  const csv = rows.map(r => r.map(v => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
  await store.saveFile(`sebas-xp-log-${today()}.csv`, csv, 'text/csv');
}

let pendingImport = null;
async function onImportFile(file) {
  let b;
  try { b = store.parseBackup(await file.text()); } catch (e) { toast(e.message, { bad: true }); return; }
  pendingImport = b;
  const n = allEntries(b.days).filter(e => !isAuto(e)).length, dates = Object.keys(b.days).sort();
  const mine = allEntries(state.days).filter(e => !isAuto(e)).length;
  openSheet(`<h3>IMPORT BACKUP</h3>
    <dl class="kv"><dt>Backup</dt><dd>${fmt(n)} logs${dates.length ? ` · ${shortLabel(dates[0])} – ${shortLabel(dates[dates.length - 1])}` : ''}${b.exportedAt ? `<br><span class="muted">exported ${esc(new Date(b.exportedAt).toLocaleString())}</span>` : ''}</dd>
    <dt>This device</dt><dd>${fmt(mine)} logs</dd></dl>
    <p><b>Merge</b> adds everything from the backup that isn't here yet and keeps what's here. Use it to combine your phone and laptop. <b>Replace</b> makes this device an exact copy of the backup.${signedIn() ? ' With cloud sync on, Replace also changes your other devices.' : ''}</p>
    <div class="btnrow"><button class="btn gold" data-act="import-merge">MERGE</button><button class="btn danger" data-act="import-replace">REPLACE</button><button class="btn" data-act="ed-close">CANCEL</button></div>`, 'Import backup');
}
function doMerge(b) {
  const before = gameState(); const touched = []; let added = 0;
  for (const d in b.days) {
    const have = new Set((state.days[d] || []).map(e => e.id));
    const add = b.days[d].filter(e => !have.has(e.id) && !isAuto(e));   // bonuses get recalculated, not copied
    if (add.length) { applyDay(state.days, d, add, []); markPut(add); added += add.length; touched.push(d); }
  }
  for (const d in b.quests.daily) if (!state.quests.daily[d]) { state.quests.daily[d] = b.quests.daily[d]; markDoc(questKey(weekStart(d))); }
  for (const w in b.quests.weekly) if (!state.quests.weekly[w]) { state.quests.weekly[w] = b.quests.weekly[w]; markDoc(questKey(w)); }
  for (const id in b.badges) if (!state.badges[id] || b.badges[id] < state.badges[id]) { state.badges[id] = b.badges[id]; markDoc('badges'); }
  let newCustom = false;
  if (b.settings && Array.isArray(b.settings.custom)) b.settings.custom.forEach(c => { if (c && c.id && TREE[c.tree] && !state.settings.custom.some(x => x.id === c.id)) { state.settings.custom.push(c); newCustom = true; } });
  if (newCustom) { state.settings._at = Date.now(); markDoc('settings'); }
  buildActs();
  const first = touched.sort()[0];
  const changed = first ? settle(state.days, first, rulesCtx(), uid) : [];
  const after = gameState();
  recordBadges(after.got);
  persist([...touched, ...changed.map(c => c.date)]);
  closeSheet(); render();
  toast(added ? `Merged ${added} new log${added === 1 ? '' : 's'} from the backup.` : 'Nothing new in that backup. You already had all of it.', { gold: !!added });
  announceBadges([...after.got].filter(id => !before.got.has(id)));
}
async function doReplace(b, isUndo) {
  const prev = { days: state.days, meta: { settings: state.settings, quests: state.quests, badges: state.badges } };
  const realIds = days => allEntries(days).filter(e => !isAuto(e)).map(e => e.id);
  const keep = new Set(realIds(b.days));
  state.days = b.days; state.settings = mergeSettings(b.settings || state.settings);
  state.quests = normQuests(b.quests); state.badges = b.badges || {};
  /* cloud sync: remove what's gone, upload what's here */
  markDel(realIds(prev.days).filter(id => !keep.has(id)));
  markPut(allEntries(state.days));
  state.settings._at = Date.now(); markDoc('settings'); markDoc('badges');
  new Set([...Object.keys(state.quests.daily).map(weekStart), ...Object.keys(state.quests.weekly)]).forEach(ws => markDoc(questKey(ws)));
  buildActs();
  const first = Object.keys(state.days).sort()[0];
  if (first) settle(state.days, first, rulesCtx(), uid);
  ensureQuests();
  preImport = isUndo ? null : prev; state.hasPreImport = !!preImport;
  savedAt = Date.now();
  try { await store.replaceAll(state.days, Object.assign(metaNow(), preImport ? { preImport } : {})); }
  catch (e) { console.error(e); toast('Could not write the database; the backup copy has it.', { bad: true }); }
  persist([]);
  closeSheet(); render();
  toast(isUndo ? 'Restored your data from before the import.' : 'Backup restored.', { gold: true });
}

/* =====================================================================
   EDIT SHEET (⋯ on an activity)
   ===================================================================== */
function openEdit(id) {
  const a = ACT[id]; if (!a) return; const s = state.settings;
  const treeOpts = TREES.map(t => `<option value="${t.id}" ${t.id === a.tree ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  openSheet(`<h3>${esc(a.name)}</h3>
    ${a.custom ? `<label class="field"><span class="lbl">Name</span><input id="ed-name" maxlength="80" value="${esc(a.name)}"></label><label class="field"><span class="lbl">Tree</span><select id="ed-tree">${treeOpts}</select></label>` : ''}
    <label class="field"><span class="lbl">XP value${a.custom ? '' : ` (default ${defaultXP(id)})`}</span><input id="ed-xp" type="number" min="1" max="5000" inputmode="numeric" value="${a.xp}"></label>
    <label class="check"><input type="checkbox" id="ed-fav" ${s.favorites.includes(id) ? 'checked' : ''}> Favorite (pinned on Home)</label>
    <label class="check"><input type="checkbox" id="ed-pd" ${s.perfect.includes(id) ? 'checked' : ''}> Perfect Day habit</label>
    <label class="check"><input type="checkbox" id="ed-once" ${a.once ? 'checked' : ''}> One-time achievement</label>
    <label class="check"><input type="checkbox" id="ed-hide" ${a.hidden ? 'checked' : ''}> Hide from the Log</label>
    <div class="btnrow"><button class="btn gold" data-act="ed-save" data-id="${id}">SAVE</button><button class="btn" data-act="ed-close">CANCEL</button>${a.custom ? `<button class="btn danger" data-act="ed-delete" data-id="${id}">DELETE</button>` : ''}</div>`, 'Edit activity');
  const x = $('#ed-xp'); if (x) x.focus();
}
function saveEdit(id) {
  const a = ACT[id]; if (!a) return; const s = state.settings;
  const xp = Math.round(Number($('#ed-xp').value));
  if (!(xp >= 1 && xp <= 5000)) { toast('XP must be a whole number from 1 to 5000.'); return; }
  const setIn = (arr, on) => { const i = arr.indexOf(id); if (on && i < 0) arr.push(id); if (!on && i >= 0) arr.splice(i, 1); };
  const pdBefore = s.perfect.includes(id);
  setIn(s.favorites, $('#ed-fav').checked); setIn(s.perfect, $('#ed-pd').checked); setIn(s.hidden, $('#ed-hide').checked);
  const once = $('#ed-once').checked;
  if (a.custom) { const c = s.custom.find(c => c.id === id); const nm = $('#ed-name').value.trim(); if (!nm) { toast('Give the activity a name.'); return; } c.name = nm; c.tree = $('#ed-tree').value; c.xp = xp; c.once = once; }
  else { if (xp === defaultXP(id)) delete s.overrides[id]; else s.overrides[id] = xp; if (once === defaultOnce(id)) delete s.onceOverrides[id]; else s.onceOverrides[id] = once; }
  saveSettings();
  if (pdBefore !== s.perfect.includes(id)) { const ch = settle(state.days, today(), rulesCtx(), uid); persist(ch.map(c => c.date)); }   // today's Perfect Day may change
  closeSheet(); render(); toast('Saved');
}

/* =====================================================================
   RENDER
   ===================================================================== */
const TABS = [['home', 'HOME', 'home'], ['log', 'LOG', 'list'], ['hero', 'HERO', 'hero'], ['history', 'HISTORY', 'scroll'], ['setup', 'SETUP', 'cog']];
function renderNav() { $('#nav').innerHTML = TABS.map(([id, l, ic]) => `<button class="tab" role="tab" aria-selected="${state.tab === id}" data-tab="${id}">${pix(ic)}${l}</button>`).join(''); }

let heatScrolled = false;
function render() {
  buildActs(); renderNav();
  const T = today();
  const V = { S: snapshot(state.days), T };
  if (state.tab === 'hero') { V.stats = lifetimeStats(state.days, target()); V.badges = evaluateBadges({ s: V.stats, snap: V.S, settings: state.settings }); }
  const html = state.tab === 'log' ? viewLog(V) : state.tab === 'hero' ? viewHero(V) : state.tab === 'history' ? viewHistory(V) : state.tab === 'setup' ? viewSetup(V) : viewHome(V);
  const act = document.activeElement, keepSearch = act && act.id === 'q', selStart = keepSearch ? act.selectionStart : 0;
  const hs = $('#heatScroll'), heatLeft = hs ? hs.scrollLeft : null;
  $('#app').innerHTML = html;
  if (keepSearch) { const q = $('#q'); if (q) { q.focus(); try { q.setSelectionRange(selStart, selStart); } catch (e) { /* ignore */ } } }
  const hs2 = $('#heatScroll');
  if (hs2) {
    if (heatLeft !== null && heatScrolled) hs2.scrollLeft = heatLeft;
    else { const now = hs2.querySelector('.hc.now'); if (now) hs2.scrollLeft = now.offsetLeft - hs2.clientWidth / 2; heatScrolled = true; }
  } else heatScrolled = false;
  syncLabel();
}
function go(tab) {
  if (state.tab === 'log' && tab !== 'log') { state.logDate = null; state.logQty = 1; }   // back to "today" so you don't log to the wrong day by accident
  state.tab = tab; render(); window.scrollTo(0, 0);
}

/* =====================================================================
   EVENTS
   ===================================================================== */
document.addEventListener('click', e => {
  const heat = e.target.closest('[data-heat]');
  if (heat) { state.heatSel = state.heatSel === heat.dataset.heat ? null : heat.dataset.heat; render(); return; }
  const t = e.target.closest('button'); if (!t || t.disabled) return;
  const d = t.dataset;
  if (d.tab) { go(d.tab); return; }
  if (d.log) {
    const inLog = state.tab === 'log';
    logActivity(d.log, t, { date: inLog ? state.logDate : null, qty: inLog ? state.logQty : 1 });
    if (inLog && state.logQty !== 1) { state.logQty = 1; render(); }
    return;
  }
  if (d.fav) { const f = state.settings.favorites, i = f.indexOf(d.fav); if (i >= 0) f.splice(i, 1); else f.push(d.fav); saveSettings(); render(); return; }
  if (d.edit) { openEdit(d.edit); return; }
  if (d.filter) { state.filter = d.filter; render(); return; }
  if (d.sub) { const [tab, sub] = d.sub.split(':'); state.sub[tab] = sub; render(); return; }
  if (d.logdate) { state.logDate = d.logdate === today() ? null : d.logdate; render(); return; }
  if (d.qty) { state.logQty = Math.max(1, Math.min(MAX_QTY, state.logQty + Number(d.qty))); render(); return; }
  if (d.week) { const cur = weekStart(today()); const ws = addDays(state.recapWeek || cur, Number(d.week)); state.recapWeek = ws >= cur ? null : ws; render(); return; }
  if (d.reroll) {
    const T = today(), day = state.quests.daily[T]; if (!day || day.rerolled) return;
    state.quests.daily[T] = Object.assign(rerollQuest(day, d.reroll, T, questCtx()), { genAt: day.genAt, modAt: Date.now() });
    markDoc(questKey(weekStart(T)));
    const ch = settle(state.days, T, rulesCtx(), uid); persist([T, ...ch.map(c => c.date)]); render(); toast('Quest swapped. No more swaps today.'); return;
  }
  if (d.unpd) { const p = state.settings.perfect; p.splice(p.indexOf(d.unpd), 1); saveSettings(); const ch = settle(state.days, today(), rulesCtx(), uid); persist(ch.map(c => c.date)); render(); return; }
  if (d.del) {
    if (!t.classList.contains('arm')) { document.querySelectorAll('.del.arm').forEach(b => { b.classList.remove('arm'); b.textContent = '✕'; }); t.classList.add('arm'); t.textContent = 'DELETE?'; return; }
    const [date, id] = d.del.split('|'); removeEntries(date, [id], 'Entry deleted'); return;
  }
  const act = d.act; if (!act) return;
  if (act === 'ed-save') saveEdit(d.id);
  else if (act === 'ed-close') { closeSheet(); pendingImport = null; }
  else if (act === 'ed-delete') {
    const s = state.settings, id = d.id;
    s.custom = s.custom.filter(c => c.id !== id); ['favorites', 'perfect', 'hidden'].forEach(k => { s[k] = s[k].filter(x => x !== id); });
    saveSettings(); closeSheet(); render(); toast('Activity deleted. Past log entries stay.');
  }
  else if (act === 'custom-log' || act === 'custom-save') {
    const name = $('#cu-name').value.trim(), tree = $('#cu-tree').value, xp = Math.round(Number($('#cu-xp').value));
    if (!name) { toast('Name what you did first.'); return; }
    if (!(xp >= 1 && xp <= 5000)) { toast('XP must be a whole number from 1 to 5000.'); return; }
    if (act === 'custom-log') {
      const T = today(), date = state.logDate || T;
      addEntries(date, [Object.assign({ id: uid(), ts: date === T ? Date.now() : backdateTs(date, Date.now(), state.settings.resetHour), a: null, n: name, t: tree, x: xp, k: 'custom' }, date !== T ? { bf: 1 } : {})], t);
    } else { const id = 'c_' + uid(); state.settings.custom.push({ id, name, tree, xp, once: $('#cu-once').checked }); state.settings.favorites.push(id); saveSettings(); render(); toast('Saved and added to favorites'); }
  }
  else if (act === 'more') { state.histShown += 14; render(); }
  else if (act === 'export-csv') exportCSV();
  else if (act === 'export-json') exportJSON();
  else if (act === 'import-json') { const f = $('#importFile'); if (f) { f.value = ''; f.click(); } }
  else if (act === 'import-merge') { if (pendingImport) doMerge(pendingImport); pendingImport = null; }
  else if (act === 'import-replace') { if (pendingImport) doReplace(pendingImport); pendingImport = null; }
  else if (act === 'undo-import') { if (preImport) doReplace({ days: preImport.days, settings: preImport.meta.settings, quests: preImport.meta.quests, badges: preImport.meta.badges }, true); }
  else if (act === 'sync-signin') syncSignIn(false);
  else if (act === 'sync-signup') syncSignIn(true);
  else if (act === 'sync-now') runSync().then(() => { render(); toast(state.sync.status === 'ok' ? 'Synced.' : `Sync problem: ${state.sync.error}`, { bad: state.sync.status !== 'ok' }); });
  else if (act === 'sync-signout') syncSignOut();
  else if (act === 'persist') store.requestPersist().then(ok => { toast(ok ? 'Storage protected.' : 'The browser said no. Installing the app to your home screen usually fixes this.'); refreshStorage(); });
  else if (act === 'goto-recap') { state.sub.history = 'recap'; state.recapWeek = addDays(weekStart(today()), -7); go('history'); }
  else if (act === 'save-game') {
    const tgt = Math.round(Number($('#set-target').value)), sd = $('#set-start').value, rh = Number($('#set-reset-hour').value);
    if (!(tgt >= 1 && tgt <= 5000)) { toast('Daily target must be 1 to 5000 XP.'); return; }
    if (!isYmd(sd)) { toast('Pick a valid start date.'); return; }
    Object.assign(state.settings, { dailyTarget: tgt, startDate: sd, resetHour: rh });
    saveSettings(); ensureQuests(); render(); toast('Settings saved');
  }
  else if (act === 'default-game') { Object.assign(state.settings, { dailyTarget: DEFAULT_SETTINGS.dailyTarget, startDate: DEFAULT_SETTINGS.startDate, resetHour: DEFAULT_SETTINGS.resetHour }); saveSettings(); ensureQuests(); render(); toast('Defaults restored'); }
  else if (act === 'restore-values') { state.settings.overrides = {}; state.settings.onceOverrides = {}; saveSettings(); render(); toast('Default XP values restored'); }
  else if (act === 'unhide') { state.settings.hidden = []; saveSettings(); render(); toast('All activities visible'); }
  else if (act === 'reset') {
    if (($('#set-reset').value || '').trim() !== 'RESET') return;
    const dates = Object.keys(state.days);
    markDel(allEntries(state.days).filter(e => !isAuto(e)).map(e => e.id));
    state.days = {}; state.badges = {}; markDoc('badges');
    persist(dates); render(); toast('Progress reset to LV 1');
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { state.q = e.target.value; render(); }
  else if (e.target.id === 'set-reset') { const b = $('#reset-btn'); if (b) b.disabled = e.target.value.trim() !== 'RESET'; }
});
document.addEventListener('change', e => {
  const id = e.target.id, s = state.settings;
  if (id === 'set-sound') { s.sound = e.target.checked; saveSettings(); if (s.sound) sfx('blip', true); }
  else if (id === 'set-haptics') { s.haptics = e.target.checked; saveSettings(); buzz('tap', s.haptics); }
  else if (id === 'set-nudges') { s.nudges = e.target.checked; saveSettings(); }
  else if (id === 'set-hidden') { s.showHidden = e.target.checked; saveSettings(); }
  else if (id === 'logdate') {
    const v = e.target.value, T = today();
    if (!isYmd(v)) return;
    if (v > T) { toast("Can't log to a future day."); render(); return; }
    state.logDate = v === T ? null : v; render();
  }
  else if (id === 'importFile' && e.target.files && e.target.files[0]) onImportFile(e.target.files[0]);
});
window.addEventListener('online', () => runSync());
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen()) { closeSheet(); pendingImport = null; } });
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') { closeSheet(); pendingImport = null; } });

/* re-check when the game day rolls over, and when you come back to the app */
let lastDay = null;
function tick() {
  if (!state.ready) return;
  const d = today();
  if (d !== lastDay) { lastDay = d; ensureQuests(); if (state.logDate && state.logDate >= d) state.logDate = null; render(); }
  if (document.visibilityState === 'visible') runSync();   // pick up logs from your other device about once a minute
}
setInterval(tick, 60000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { tick(); if (state.tab === 'home') render(); if (dirty.size) flush(); }
  else writeShadow();
});

/* =====================================================================
   START
   ===================================================================== */
function detectEnv() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  return { ios, standalone };
}

async function boot() {
  state.env = detectEnv();
  buildActs(); render();
  let data;
  try { data = await store.load(); }
  catch (e) { console.error(e); data = { days: {}, meta: {}, source: 'new' }; toast('Could not open your save file. Reload the app.', { bad: true }); }
  state.settings = mergeSettings(data.meta.settings);
  state.days = data.days || {};
  state.quests = normQuests(data.meta.quests);
  state.badges = data.meta.badges || {};
  state.outbox = { ent: (data.meta.outbox && data.meta.outbox.ent) || {}, docs: (data.meta.outbox && data.meta.outbox.docs) || {} };
  savedAt = data.meta.savedAt || 0;
  preImport = data.meta.preImport || null; state.hasPreImport = !!preImport;
  buildActs();
  state.ready = true; lastDay = today();
  if (data.source === 'shadow') console.info('Restored from the backup copy');
  ensureQuests();
  if (recordBadges(gameState().got)) persist([]);
  if (!store.shadowHealthy()) persist([]);
  render();
  window.__sebasBooted = true;
  if (state.env.standalone && !state.settings.installedSeen) { state.settings.installedSeen = true; saveSettings(); checkBadges(); }
  store.requestPersist().finally(refreshStorage);
  runSync();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(err => console.warn('Offline mode unavailable', err));
}
window.__sebasBooted = 'starting';
document.addEventListener('pointerdown', () => { if (state.settings.sound) unlockAudio(); }, { once: true });
boot();

/* for debugging in the browser console: window.sebas.state */
window.sebas = { state, render, persist };
