const CACHE_NAME = 'couple-ledger-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './toss-style.css',
  './app.js',
  './manifest.json',
  './icon-512.png',
  './app-icon.png'
];

self.addEventListener('install', event => {
  // Activate right away
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => cacheName !== CACHE_NAME).map(cacheName => caches.delete(cacheName))
      );
    })
  );
});

// Network First, Cache Fallback strategy
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).then(response => {
      // If network fetch succeeds, cache it and return
      let responseClone = response.clone();
      caches.open(CACHE_NAME).then(cache => {
        cache.put(event.request, responseClone);
      });
      return response;
    }).catch(() => {
      // If network fails (offline), load from cache
      return caches.match(event.request);
    })
  );
});
