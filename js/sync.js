/* sync.js: talks to your Supabase project (free cloud database) using plain fetch(), no extra libraries.
   - Auth: email + password. The session is remembered on this device (localStorage) and refreshed automatically.
   - Data: two tables, `entries` (one row per log) and `docs` (settings, badges, quests). See supabase/schema.sql.
   Your data stays usable offline. Sync only copies changes when there's a connection. */
import { SYNC } from './config.js';

const AUTH_KEY = 'sebasxp_auth', META_KEY = 'sebasxp_sync', SERVER_KEY = 'sebasxp_sync_server', DEVICE_KEY = 'sebasxp_device';

function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }

/* config.js holds the real server. A per-device override (localStorage) exists for testing against tools/mock_supabase.py. */
function cfg() { const o = lsGet(SERVER_KEY); return o && o.url && o.key ? o : SYNC; }
export const configured = () => { const c = cfg(); return !!(c.url && c.key); };
export const serverHost = () => { try { return new URL(cfg().url).host; } catch (e) { return ''; } };

/* a random id for this device; uploads are tagged with it so a device never re-downloads its own changes */
export function deviceId() {
  let id = lsGet(DEVICE_KEY);
  if (!id) { id = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); lsSet(DEVICE_KEY, id); }
  return id;
}

let session = lsGet(AUTH_KEY);
export const currentUser = () => (session && session.user) || null;
/* per-device sync bookkeeping: how far we've downloaded ({cursorE, cursorD}) and when */
export const syncMeta = () => lsGet(META_KEY) || {};
export const setSyncMeta = m => lsSet(META_KEY, m);

export class SyncError extends Error { constructor(msg, status) { super(msg); this.status = status; } }

async function call(path, opt) {
  let res;
  try { res = await fetch(cfg().url.replace(/\/+$/, '') + path, opt); }
  catch (e) { throw new SyncError("Can't reach the sync server (offline?)", 0); }
  const text = await res.text(); let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
  if (!res.ok) {
    const msg = (body && typeof body === 'object' && (body.error_description || body.msg || body.message || body.error)) || `Server error ${res.status}`;
    throw new SyncError(String(msg), res.status);
  }
  return body;
}
const baseHeaders = () => ({ apikey: cfg().key, 'Content-Type': 'application/json' });

function keepSession(s) {
  session = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + (s.expires_in || 3600) * 1000, user: { id: s.user.id, email: s.user.email } };
  lsSet(AUTH_KEY, session);
}
function dropSession() { session = null; lsSet(AUTH_KEY, null); }

/* returns true if signed in right away, false if Supabase wants an email confirmation first */
export async function signUp(email, password) {
  const r = await call('/auth/v1/signup', { method: 'POST', headers: baseHeaders(), body: JSON.stringify({ email, password }) });
  if (r && r.access_token) { keepSession(r); return true; }
  return false;
}
export async function signIn(email, password) {
  const r = await call('/auth/v1/token?grant_type=password', { method: 'POST', headers: baseHeaders(), body: JSON.stringify({ email, password }) });
  keepSession(r);
}
export async function signOut() {
  const s = session; dropSession(); setSyncMeta(null);
  if (s) { try { await call('/auth/v1/logout', { method: 'POST', headers: Object.assign(baseHeaders(), { Authorization: 'Bearer ' + s.access_token }) }); } catch (e) { /* already signed out locally */ } }
}

/* Refresh tokens work only once, so parallel requests must share a single refresh. */
let refreshing = null;
async function refreshSession() {
  try {
    const r = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: baseHeaders(), body: JSON.stringify({ refresh_token: session.refresh_token }) });
    keepSession(r);
  } catch (e) {
    if (e.status >= 400 && e.status < 500) { dropSession(); throw new SyncError('Your sign-in expired. Sign in again in Setup.', 401); }
    throw e;   // offline etc.: keep the session and try again later
  }
}
async function accessToken() {
  if (!session) throw new SyncError('Signed out', 401);
  if (Date.now() > session.expires_at - 60e3) {
    if (!refreshing) refreshing = refreshSession().finally(() => { refreshing = null; });
    await refreshing;
    if (!session) throw new SyncError('Your sign-in expired. Sign in again in Setup.', 401);
  }
  return session.access_token;
}

async function rest(method, path, body, extra) {
  const run = async () => call('/rest/v1/' + path, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: Object.assign(baseHeaders(), { Authorization: 'Bearer ' + await accessToken() }, extra || {})
  });
  try { return await run(); }
  catch (e) { if (e.status === 401 && session) { session.expires_at = 0; return run(); } throw e; }   // stale token: refresh once
}

const PAGE = 1000;
/* download rows other devices changed after `since` (a server timestamp), oldest first */
export async function pullRows(table, since) {
  const out = [], tie = table === 'docs' ? 'key' : 'id';
  for (let off = 0; ; off += PAGE) {
    const q = `${table}?select=*&device=neq.${encodeURIComponent(deviceId())}${since ? '&updated_at=gt.' + encodeURIComponent(since) : ''}&order=updated_at.asc,${tie}.asc&limit=${PAGE}&offset=${off}`;
    const rows = await rest('GET', q);
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
/* upload rows (insert or update), in batches */
export async function pushRows(table, rows) {
  const device = deviceId();
  for (let i = 0; i < rows.length; i += 500) {
    await rest('POST', table, rows.slice(i, i + 500).map(r => Object.assign({}, r, { device })), { Prefer: 'resolution=merge-duplicates,return=minimal' });
  }
}
