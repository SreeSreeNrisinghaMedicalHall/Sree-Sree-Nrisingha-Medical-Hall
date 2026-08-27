const CACHE_NAME = 'nrisingha-medical-v3';
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first: always try to fetch the latest version first.
// cache:'no-store' makes sure this bypasses the browser's own HTTP cache too,
// so a fresh deploy shows up immediately instead of after the HTTP cache expires.
// Only fall back to the cached copy if the network request fails (e.g. offline).
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy)).catch(()=>{});
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
