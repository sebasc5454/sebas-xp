/* sw.js: service worker = the offline engine.
   - App files: network first (so edits you push show up right away), cache if offline or slow.
   - Google Fonts: cache first (font files never change).
   Your XP data is NOT stored here. It lives in IndexedDB, which this file never touches. */
const CACHE = 'sebas-xp-app-v3';
const FONT_CACHE = 'sebas-xp-fonts-v1';
const APP_FILES = [
  './', 'index.html', 'styles.css', 'manifest.json',
  'js/app.js', 'js/config.js', 'js/dates.js', 'js/leveling.js', 'js/quests.js', 'js/rules.js', 'js/stats.js',
  'js/achievements.js', 'js/pixel.js', 'js/storage.js', 'js/feel.js', 'js/state.js', 'js/ui.js', 'js/sync.js', 'js/syncmerge.js',
  'js/views/home.js', 'js/views/log.js', 'js/views/hero.js', 'js/views/history.js', 'js/views/setup.js',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/favicon-32.png', 'icons/favicon.svg'
];
const NETWORK_TIMEOUT = 3500;   // ms before falling back to the cached copy

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_FILES.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { e.respondWith(fontFirst(req)); return; }
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const nav = req.mode === 'navigate';
  const key = nav ? req.url.split('?')[0] : req;   // one cached copy of the page, whatever the ?query
  /* page navigations can't be re-fetched with extra options, so build a fresh request for them */
  const netReq = nav ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(req, { cache: 'no-cache' });
  const net = fetch(netReq).then(res => {
    if (res.ok && res.type === 'basic') cache.put(key, res.clone());
    return res;
  });
  net.catch(() => {});   // offline: handled below
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), NETWORK_TIMEOUT); });
  try {
    return await Promise.race([net, timeout]);
  } catch (err) {
    const hit = (await cache.match(key, { ignoreSearch: nav })) || (nav ? await cache.match('./') || await cache.match('index.html') : null);
    if (hit) return hit;
    return net;   // nothing cached: keep waiting on the network
  } finally { clearTimeout(timer); }
}

async function fontFirst(req) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req);
  if (hit) {
    if (req.url.includes('fonts.googleapis.com')) fetch(req).then(res => { if (res.ok) cache.put(req, res); }).catch(() => {});
    return hit;
  }
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
