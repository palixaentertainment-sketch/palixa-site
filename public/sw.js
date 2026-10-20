const CACHE_NAME = 'palixia-shell-v2';
const OFFLINE_URL = '/offline.html';
const OFFLINE_LIBRARY_URL = '/offline-library.html';
const APP_ICONS = ['/brand/icon-192.png', '/brand/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL, OFFLINE_LIBRARY_URL, ...APP_ICONS])
    )
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
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  // The offline library is a self-contained local reader and must work without a network.
  if (url.origin === self.location.origin && url.pathname === OFFLINE_LIBRARY_URL) {
    event.respondWith(caches.match(OFFLINE_LIBRARY_URL).then((cached) => cached || fetch(request)));
    return;
  }
  // Never cache private account pages, Supabase responses, reader progress, or API data.
  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(OFFLINE_URL)) || Response.error();
    })
  );
});
