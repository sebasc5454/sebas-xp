/* storage.js: saving your progress.

   Where data lives:
   1. IndexedDB (main save). A real database in the browser. Each day is its own record, so a save
      only rewrites that day. Survives app updates and restarts.
   2. A shadow copy in localStorage, written on every change. If IndexedDB ever fails or gets
      wiped, the app restores from this copy on the next launch (and vice versa).
   3. JSON backups you export from Setup: the only copy that lives outside the browser.

   The browser is also asked to mark storage as "persistent" so it's never auto-cleared. */

const DB_NAME = 'sebas-xp', DB_VERSION = 1;
const SHADOW_KEY = 'sebasxp_shadow_v2';
const LEGACY_KEY = 'sebasxp_save_v1';   // the original single-file app's fallback save

let dbPromise = null;
function openDB() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB not available')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('days')) db.createObjectStore('days', { keyPath: 'date' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      db.onclose = () => { dbPromise = null; };   // Safari can drop the connection when the app is backgrounded
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

/* run fn inside a transaction; resolves when the data is actually written */
function tx(stores, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    let t;
    try { t = db.transaction(stores, mode); } catch (e) { dbPromise = null; reject(e); return; }
    let result;
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
    try { result = fn(t); } catch (e) { try { t.abort(); } catch (_) { /* already finished */ } reject(e); }
  }));
}
/* one automatic retry with a fresh connection */
async function withRetry(fn) { try { return await fn(); } catch (e) { dbPromise = null; return await fn(); } }
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

async function idbLoad() {
  return withRetry(async () => {
    const db = await openDB();
    const t = db.transaction(['days', 'meta'], 'readonly');
    const [dayRecs, metaKeys, metaVals] = await Promise.all([
      reqP(t.objectStore('days').getAll()), reqP(t.objectStore('meta').getAllKeys()), reqP(t.objectStore('meta').getAll())
    ]);
    const days = {}; dayRecs.forEach(r => { if (r && Array.isArray(r.entries) && r.entries.length) days[r.date] = r.entries; });
    const meta = {}; metaKeys.forEach((k, i) => meta[k] = metaVals[i]);
    return { days, meta };
  });
}

/* ---------- shadow copy ---------- */
function readShadow() {
  try { const raw = localStorage.getItem(SHADOW_KEY); if (raw) return JSON.parse(raw); } catch (e) { /* ignore */ }
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) { const o = JSON.parse(raw); return { savedAt: 0, days: o.days || {}, meta: { settings: o.settings } }; }
  } catch (e) { /* ignore */ }
  return null;
}
let shadowOk = true;
export function writeShadow(data) {
  try { localStorage.setItem(SHADOW_KEY, JSON.stringify(data)); shadowOk = true; }
  catch (e) { shadowOk = false; }   // full or blocked: IndexedDB still has everything
}
export const shadowHealthy = () => shadowOk;

/* ---------- public API ---------- */
export let mode = 'loading';   // 'idb' = IndexedDB + shadow, 'local' = shadow only (IndexedDB unavailable)

/* Load the save. Picks whichever copy was saved most recently. */
export async function load() {
  const shadow = readShadow();
  let idb = null;
  try { idb = await idbLoad(); mode = 'idb'; } catch (e) { console.error('IndexedDB load failed', e); mode = 'local'; }
  const idbAt = idb && idb.meta.savedAt || 0, shAt = shadow && shadow.savedAt || 0;
  const idbHas = idb && (Object.keys(idb.days).length || idb.meta.settings);
  let pick = null, source = 'new';
  if (idbHas && idbAt >= shAt) { pick = idb; source = 'idb'; }
  else if (shadow && (Object.keys(shadow.days || {}).length || (shadow.meta && shadow.meta.settings))) { pick = { days: shadow.days || {}, meta: shadow.meta || {} }; source = 'shadow'; }
  else if (idbHas) { pick = idb; source = 'idb'; }
  const data = pick || { days: {}, meta: {} };
  /* heal: if IndexedDB was missing or behind, write the shadow copy back into it */
  if (mode === 'idb' && source === 'shadow') { try { await replaceAll(data.days, data.meta); } catch (e) { console.error(e); } }
  return { days: data.days, meta: data.meta, source };
}

/* Save changed days + meta in ONE transaction (all or nothing). */
export function saveChanges(days, dates, meta) {
  if (mode !== 'idb') return Promise.resolve();
  return withRetry(() => tx(['days', 'meta'], 'readwrite', t => {
    const ds = t.objectStore('days'), ms = t.objectStore('meta');
    for (const d of dates) { if (days[d] && days[d].length) ds.put({ date: d, entries: days[d] }); else ds.delete(d); }
    for (const k in meta) ms.put(meta[k], k);
  }));
}

/* Wipe and rewrite everything (used by Import → Replace and self-healing). */
export function replaceAll(days, meta) {
  if (mode !== 'idb') return Promise.resolve();
  return withRetry(() => tx(['days', 'meta'], 'readwrite', t => {
    const ds = t.objectStore('days'), ms = t.objectStore('meta');
    ds.clear(); ms.clear();
    for (const d in days) if (days[d].length) ds.put({ date: d, entries: days[d] });
    for (const k in meta) ms.put(meta[k], k);
  }));
}

/* ---------- persistence + quota ---------- */
export async function requestPersist() {
  try { if (navigator.storage && navigator.storage.persist) { if (await navigator.storage.persisted()) return true; return await navigator.storage.persist(); } } catch (e) { /* ignore */ }
  return false;
}
export async function storageInfo() {
  const out = { persisted: null, usage: null, quota: null };
  try { if (navigator.storage && navigator.storage.persisted) out.persisted = await navigator.storage.persisted(); } catch (e) { /* ignore */ }
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); out.usage = e.usage; out.quota = e.quota; } } catch (e) { /* ignore */ }
  return out;
}

/* ---------- backups ---------- */
export function makeBackup(state) {
  return JSON.stringify({ app: 'sebas-xp', format: 2, exportedAt: new Date().toISOString(), settings: state.settings, days: state.days, quests: state.quests, badges: state.badges }, null, 1);
}

/* Validate a backup file. Also accepts the original app's {settings, days} shape. Throws on bad files. */
export function parseBackup(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { throw new Error("That file isn't valid JSON."); }
  if (!o || typeof o !== 'object' || typeof o.days !== 'object' || Array.isArray(o.days)) throw new Error("That file doesn't look like a Sebas XP backup.");
  const days = {};
  for (const d of Object.keys(o.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Array.isArray(o.days[d])) continue;
    const list = o.days[d].filter(e => e && typeof e.id === 'string' && typeof e.x === 'number' && isFinite(e.x) && typeof e.ts === 'number');
    if (list.length) days[d] = list.map(e => Object.assign({}, e)).sort((a, b) => a.ts - b.ts);
  }
  const quests = o.quests && typeof o.quests === 'object' ? { daily: o.quests.daily || {}, weekly: o.quests.weekly || {} } : { daily: {}, weekly: {} };
  return { settings: o.settings && typeof o.settings === 'object' ? o.settings : null, days, quests, badges: o.badges && typeof o.badges === 'object' ? o.badges : {}, exportedAt: o.exportedAt || null };
}

/* Save a file. On iPhone this opens the share sheet (pick "Save to Files"); elsewhere it downloads. */
export async function saveFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (coarse && navigator.canShare) {
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return true; }
      catch (e) { if (e && e.name === 'AbortError') return false; /* fall through to download */ }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
