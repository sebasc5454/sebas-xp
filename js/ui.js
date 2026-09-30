/* ui.js: small screen helpers: escaping text, toasts, the floating +XP, overlays, and bottom sheets. */

export const $ = s => document.querySelector(s);
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = n => Math.round(n).toLocaleString('en-US');
export const cv = name => `var(${name})`;

export function toast(msg, opt) {
  opt = opt || {};
  const box = $('#toasts'); const el = document.createElement('div');
  el.className = 'toast' + (opt.gold ? ' gold' : '') + (opt.bad ? ' bad' : '');
  el.innerHTML = `<span>${esc(msg)}</span>`;
  const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { fn(); el.remove(); }; el.appendChild(b); };
  if (opt.undo) btn('UNDO', opt.undo);
  if (opt.action) btn(opt.action[0], opt.action[1]);
  box.appendChild(el); while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), opt.ms || (opt.undo || opt.action ? 6000 : 3200));
}

/* `at` is the tapped element's position (a DOMRect), measured before the screen re-renders */
export function floatXP(at, text) {
  if (!at || !at.width) return;
  const r = at;
  const f = document.createElement('div'); f.className = 'floatxp'; f.textContent = text;
  f.style.left = Math.max(8, Math.min(window.innerWidth - 120, r.left + r.width / 2 - 40)) + 'px'; f.style.top = (r.top - 6) + 'px';
  document.body.appendChild(f); setTimeout(() => f.remove(), 950);
}

/* full-screen celebration overlay; returns a promise that resolves when closed */
let overlayQueue = Promise.resolve();
export function showOverlay(html, opt) {
  const n = (opt && opt.sparks) || 18;
  overlayQueue = overlayQueue.catch(() => {}).then(() => new Promise(resolve => {   // one at a time; an error never blocks the next one
    const ov = $('#overlay');
    const sparks = Array.from({ length: n }, (_, i) => {
      const a = i / n * Math.PI * 2, d = 110 + Math.random() * 80;
      return `<span class="spark" style="--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d)}px;--c:${(opt && opt.color) || 'var(--gold-hi)'};animation-delay:${(i % 3) * 60}ms"></span>`;
    }).join('');
    ov.innerHTML = `${sparks}<div class="px ov ${(opt && opt.cls) || ''}" role="dialog" aria-modal="true" aria-label="${(opt && opt.label) || 'Celebration'}">${html}<button class="btn gold" id="ov-ok">CONTINUE</button></div>`;
    ov.hidden = false;
    const ok = $('#ov-ok'); ok.focus();
    const close = () => { ov.hidden = true; ov.innerHTML = ''; document.removeEventListener('keydown', onKey); resolve(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    ok.onclick = close; document.addEventListener('keydown', onKey);
    if (opt && opt.onShow) opt.onShow(ov);
  }));
  return overlayQueue;
}

export function openSheet(html, label) {
  const sh = $('#sheet');
  sh.innerHTML = `<div class="px" role="dialog" aria-modal="true" aria-label="${label || 'Dialog'}">${html}</div>`;
  sh.hidden = false;
  const first = sh.querySelector('input,select,button'); if (first) first.focus();
}
export function closeSheet() { const sh = $('#sheet'); sh.hidden = true; sh.innerHTML = ''; }
export const sheetOpen = () => !$('#sheet').hidden;
