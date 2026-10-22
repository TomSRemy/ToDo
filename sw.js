const CACHE = 'todo-pwa-v17';
// Excel / Outlook reader, loaded on demand by the app: kept for offline use
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const EXCELJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';   // the « Caractéristiques Centrales » file in its design
const LIBS = [XLSX_URL, EXCELJS_URL];
const ASSETS = [
  './',
  './index.html',
  './index.html?lite',
  './app.css',
  './js/storage.js',
  './js/celebrate.js',
  './js/network.js',
  './js/app.js',
  './mobile.html',
  './manifest-lite.json',
  './widget.html',
  './manifest.json',
  './share-target.html',
  './fr-map.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(ASSETS);
    // best effort: the app works without it, only .msg / .xlsx reading needs it
    try { const r = await fetch(new Request(XLSX_URL, { mode: 'no-cors' })); await c.put(XLSX_URL, r); } catch (err) {}
  }));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return; // skip chrome-extension:// and similar, Cache API can't store them

  // Only the app's own files (and the Excel library) are cached. Everything else — GitHub API (sync, inbox),
  // the local Excel bridge, fonts — goes straight to the network: serving a cached copy of data/tasks.json
  // made a sync merge against an old server state and undo recent changes.
  const sameOrigin = new URL(e.request.url).origin === self.location.origin;
  if (!sameOrigin && !LIBS.includes(e.request.url)) return;

  // Pages and the app's own code (index.html, app.css, js/*.js): network first, so a new version shows at the
  // first reload and the page never runs with an older copy of its code; the cached copy only serves when offline.
  const path = new URL(e.request.url).pathname;
  const isPage = e.request.mode === 'navigate' || /\.html?$/.test(path) || e.request.url.endsWith('/') || /\/app\.css$/.test(path) || /\/js\/[^/]+\.js$/.test(path);
  if (sameOrigin && isPage) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(e.request, clone)); }
        return res;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Other files (icons, manifest, Excel library): cache first, refreshed in the background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        // cross-origin scripts (the CDN library) come back "opaque": cache them too
        if (res && (res.ok || (res.type === 'opaque' && LIBS.includes(e.request.url)))) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
