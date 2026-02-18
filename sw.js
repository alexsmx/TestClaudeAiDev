const CACHE_NAME = 'interval-timer-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './icon.svg',
  './manifest.json'
];

// Cache all assets on install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Clean up old caches on activate
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Serve from cache, fall back to network
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
