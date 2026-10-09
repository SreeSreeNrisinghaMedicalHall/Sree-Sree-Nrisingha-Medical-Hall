const CACHE_NAME = 'nrisingha-medical-v5';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app-01-data.js',
  './app-02-ui.js',
  './app-03-medicines.js',
  './app-04-sale.js',
  './app-05-purchase.js',
  './app-06-people.js',
  './app-07-lab.js',
  './app-08-rx.js',
  './app-09-reports.js',
  './app-10-backup-cloud.js',
  './app-11-lock-init.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // cache.addAll() is all-or-nothing — if even ONE file here fails to fetch
      // (a brief network hiccup, anything), NOTHING gets cached, not even index.html,
      // and offline opening silently keeps failing forever after that. Caching each
      // file on its own means index.html still gets saved even if something else fails.
      Promise.all(
        ASSETS.map((url) => cache.add(url).catch((err) => console.warn('cache miss:', url, err)))
      )
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: always try to fetch the latest version first.
// cache:'no-store' makes sure this bypasses the browser's own HTTP cache too,
// so a fresh deploy shows up immediately instead of after the HTTP cache expires.
// Only fall back to the cached copy if the network request fails (e.g. offline).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy)).catch(() => {});
        return response;
      })
      .catch(() =>
        caches.match(e.request).then((cached) =>
          // If this exact URL was never cached (e.g. the very first offline visit hits a
          // request variant that wasn't in ASSETS), still open the app for a page-navigation
          // request by falling back to the cached index.html rather than showing nothing.
          cached || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)
        )
      )
  );
});
