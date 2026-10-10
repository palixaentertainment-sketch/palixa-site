const CACHE_NAME = 'palixia-shell-v1';
const OFFLINE_URL = '/offline.html';
const APP_ICONS = ['/brand/icon-192.png', '/brand/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL, ...APP_ICONS]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith('palixia-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only provide an offline fallback for page navigations. Do not cache private
  // account pages, reader progress, author dashboards, or Supabase responses.
  if (request.method !== 'GET' || request.mode !== 'navigate') return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(OFFLINE_URL)) || Response.error();
    })
  );
});
