/**
 * Service Worker: ระบบห้องพยาบาล โรงเรียนวิสุทธิกษัตรี
 * ช่วยให้ติดตั้งเป็น Web App / Desktop App และทำงานแบบ Offline ได้
 */

const CACHE_NAME = 'vk-nurse-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './assets/app.css',
  './assets/app.js',
  './assets/chart-engine.js',
  './assets/logo.jpg',
  './manifest.json'
];

// Install Event: Cache Core Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Network first for API, Cache first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // If requesting API (/api/...), try Network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({
          error: 'Offline mode',
          fallbackToLocal: true
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // For static assets, cache first, then network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
