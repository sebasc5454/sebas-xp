/* views/setup.js: save file, backups, game settings, feel, install/notifications info, and activity options. */
import { state, ACT } from '../state.js';
import { TREE, XP_TO_100, APP_VERSION } from '../config.js';
import { dayLabel, hourLabel, fmtEta, ymd, addDays } from '../dates.js';
import { allEntries } from '../leveling.js';
import { mode, shadowHealthy } from '../storage.js';
import { canVibrate } from '../feel.js';
import * as sync from '../sync.js';
import { esc, fmt } from '../ui.js';

function syncPanel() {
  if (!sync.configured()) return `<div class="px set"><h3>CLOUD SYNC</h3>
    <p>Off. Your phone and laptop keep separate saves. To sync them, set up a free Supabase project (about 10 minutes) and add its URL and key to <code>js/config.js</code>. README → Cloud sync has the steps.</p></div>`;
  const u = sync.currentUser(), st = state.sync;
  if (!u) return `<div class="px set"><h3>CLOUD SYNC</h3>
    <p>Sign in to sync this device with your others. Logs already on this device are kept and combined with the cloud copy.</p>
    <div class="fgrid" style="grid-template-columns:1fr">
      <label class="field"><span class="lbl">Email</span><input id="sy-email" type="email" autocomplete="username" inputmode="email" autocapitalize="off" spellcheck="false"></label>
      <label class="field"><span class="lbl">Password</span><input id="sy-pass" type="password" autocomplete="current-password" minlength="6"></label>
    </div>
    <div class="btnrow"><button class="btn gold" data-act="sync-signin" ${st.busy ? 'disabled' : ''}>${st.busy ? 'WORKING…' : 'SIGN IN'}</button><button class="btn" data-act="sync-signup" ${st.busy ? 'disabled' : ''}>CREATE ACCOUNT</button></div>
    <p>First device: <b>Create account</b>. Every other device: <b>Sign in</b> with the same email and password.</p></div>`;
  const pending = Object.keys(state.outbox.ent).length + Object.keys(state.outbox.docs).length;
  const status = st.status === 'syncing' ? 'Syncing…' : st.status === 'ok' ? '<span class="good">Up to date</span>'
    : st.status === 'offline' ? 'Offline. Will sync when you\'re back online' : st.status === 'error' ? `<span class="bad">${esc(st.error || 'Error')}</span>` : 'Starting…';
  return `<div class="px set"><h3>CLOUD SYNC</h3>
    <dl class="kv">
      <dt>Account</dt><dd>${esc(u.email)}</dd>
      <dt>Status</dt><dd>${status}</dd>
      <dt>Last sync</dt><dd>${st.at ? new Date(st.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}</dd>
      <dt>To upload</dt><dd>${pending ? `${pending} change${pending === 1 ? '' : 's'}` : 'Nothing'}</dd>
    </dl>
    <p>Syncs when you open the app, after each log, and every minute while it's open. Works offline; changes upload when you reconnect.</p>
    <div class="btnrow"><button class="btn gold" data-act="sync-now" ${st.status === 'syncing' ? 'disabled' : ''}>SYNC NOW</button><button class="btn" data-act="sync-signout">SIGN OUT</button></div></div>`;
}

const mb = b => b == null ? '?' : b < 1e6 ? `${Math.max(1, Math.round(b / 1e3))} KB` : `${(b / 1e6).toFixed(1)} MB`;

export function viewSetup() {
  const s = state.settings, st = state.storage;
  const pd = (s.perfect || []).filter(id => ACT[id]);
  const custom = s.custom || [];
  const nEntries = allEntries(state.days).length;
  const saved = state.save.at ? new Date(state.save.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
  const last = s.lastBackup ? `${dayLabel(ymd(new Date(s.lastBackup)))} (${Math.floor((Date.now() - s.lastBackup) / 864e5)}d ago)` : 'Never';
  const hours = Array.from({ length: 12 }, (_, h) => `<option value="${h}" ${h === s.resetHour ? 'selected' : ''}>${hourLabel(h)}</option>`).join('');
  return `<div class="sechead"><h2>SETUP</h2><span>v${APP_VERSION}</span></div>

  <div class="px set"><h3>SAVE FILE</h3>
    <dl class="kv">
      <dt>Saved to</dt><dd>${mode === 'idb' ? 'This device (database + backup copy)' : mode === 'local' ? 'This device (backup copy only)' : 'Loading'}${sync.currentUser() ? ' + cloud' : ''}</dd>
      <dt>Last save</dt><dd>${state.save.error ? '<span class="bad">FAILED, retrying</span>' : state.save.pending ? 'Saving…' : saved}</dd>
      <dt>Protected</dt><dd>${st.persisted === true ? '<span class="good">Yes, won\'t be auto-cleared</span>' : st.persisted === false ? 'Not yet (install the app, or tap below)' : 'Unknown on this browser'}</dd>
      <dt>Entries</dt><dd>${fmt(nEntries)} · ${mb(st.usage)} used</dd>
      <dt>Backup copy</dt><dd>${shadowHealthy() ? 'OK' : '<span class="bad">Full. Export a backup</span>'}</dd>
      <dt>Last backup</dt><dd>${last}</dd>
    </dl>
    <p>Your progress lives on this device, and every log saves right away. Export a JSON backup every week or so and keep it in iCloud Drive or Files. That's the only copy that survives a lost phone or cleared browser data.</p>
    <div class="btnrow">
      <button class="btn gold" data-act="export-json">EXPORT BACKUP</button>
      <button class="btn" data-act="import-json">IMPORT BACKUP</button>
      <button class="btn" data-act="export-csv">EXPORT CSV</button>
      ${st.persisted === false ? '<button class="btn" data-act="persist">PROTECT STORAGE</button>' : ''}
    </div>
    ${state.hasPreImport ? `<p>Changed your mind about the last import? <button class="linkbtn" data-act="undo-import">Restore the data from before it</button>.</p>` : ''}
    <input type="file" id="importFile" accept=".json,application/json" hidden>
  </div>

  ${syncPanel()}

  <div class="px set"><h3>GAME SETTINGS</h3>
    <div class="fgrid three">
      <label class="field"><span class="lbl">Daily target</span><input id="set-target" type="number" min="1" max="5000" inputmode="numeric" value="${s.dailyTarget}"></label>
      <label class="field"><span class="lbl">Start date</span><input id="set-start" type="date" value="${s.startDate}"></label>
      <label class="field"><span class="lbl">Day resets at</span><select id="set-reset-hour">${hours}</select></label>
    </div>
    <p>At ${fmt(s.dailyTarget)} XP/day you hit LV 100 in ${fmt(Math.ceil(XP_TO_100 / s.dailyTarget))} days (${fmtEta(addDays(s.startDate, Math.ceil(XP_TO_100 / s.dailyTarget)))}). ${s.resetHour === 0 ? 'Days run midnight to midnight.' : `A log at ${s.resetHour > 1 ? s.resetHour - 1 : 12}:30 AM counts for the day before.`} Changing the reset hour only affects new logs.</p>
    <div class="btnrow"><button class="btn gold" data-act="save-game">SAVE SETTINGS</button><button class="btn" data-act="default-game">DEFAULTS</button></div>
  </div>

  <div class="px set"><h3>FEEL</h3>
    <label class="check"><input type="checkbox" id="set-sound" ${s.sound ? 'checked' : ''}> 8-bit sound effects</label>
    <label class="check"><input type="checkbox" id="set-haptics" ${s.haptics ? 'checked' : ''} ${canVibrate() ? '' : 'disabled'}> Vibration ${canVibrate() ? '' : '<span class="muted">(not supported here; iPhone Safari has no vibration API)</span>'}</label>
    <label class="check"><input type="checkbox" id="set-nudges" ${s.nudges ? 'checked' : ''}> Evening check banner when under 100 XP after 7 PM</label>
  </div>

  <div class="px set"><h3>INSTALL + REMINDERS</h3>
    <dl class="kv"><dt>Running as</dt><dd>${state.env.standalone ? '<span class="good">Installed app</span>' : 'Browser tab'}</dd><dt>Offline</dt><dd>${'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? '<span class="good">Ready</span>' : 'Ready after next launch') : 'Not supported'}</dd></dl>
    <p><b>iPhone:</b> open the site in Safari → Share → Add to Home Screen. <b>Mac:</b> Safari → File → Add to Dock, or the install icon in Chrome's address bar.</p>
    <p><b>Reminders:</b> iPhone web apps can't schedule notifications on their own. They'd need a push server that knows your XP. The in-app evening banner covers you whenever you open the app. For a nightly ping, set up a Shortcuts automation (Time of Day, 8:00 PM → Show Notification) or a repeating Reminder. The README has steps.</p>
  </div>

  <div class="px set"><h3>PERFECT DAY HABITS</h3><p>Log all of these in one day for +25 XP. Add more from any activity's ⋯ menu in the Log tab.</p>
    <div class="plist">${pd.length ? pd.map(id => `<div class="pitem"><span>${esc(ACT[id].name)}</span><button class="iconbtn" data-unpd="${id}" aria-label="Remove">✕</button></div>`).join('') : '<p>No habits picked.</p>'}</div></div>
  <div class="px set"><h3>CUSTOM ACTIVITIES</h3><p>Save your own from the + Custom XP box in the Log tab. Edit or delete them from their ⋯ menu.</p>
    <div class="plist">${custom.length ? custom.map(c => `<div class="pitem"><span>${esc(c.name)} <span class="muted">· ${esc(TREE[c.tree] ? TREE[c.tree].name : '')} · ${c.xp} XP</span></span><button class="iconbtn" data-edit="${c.id}" aria-label="Edit">⋯</button></div>`).join('') : '<p>None yet.</p>'}</div></div>
  <div class="px set"><h3>ACTIVITY LIST</h3>
    <label class="check"><input type="checkbox" id="set-hidden" ${s.showHidden ? 'checked' : ''}> Show hidden activities in the Log</label>
    <div class="btnrow"><button class="btn" data-act="restore-values">RESTORE DEFAULT XP VALUES</button><button class="btn" data-act="unhide">UNHIDE ALL</button></div></div>
  <div class="px set"><h3>RESET PROGRESS</h3><p>Deletes every log entry and puts you back at LV 1. Settings and favorites stay. ${sync.currentUser() ? '<b>Cloud sync is on, so this resets your other devices too.</b> ' : ''}Export a backup first. Type RESET to unlock the button.</p>
    <div class="fgrid" style="grid-template-columns:1fr auto"><label class="field"><span class="lbl">Confirm</span><input id="set-reset" autocomplete="off" placeholder="RESET"></label><button class="btn danger" data-act="reset" id="reset-btn" disabled style="align-self:end">RESET ALL</button></div></div>`;
}
