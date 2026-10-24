const CACHE_NAME = 'palixia-shell-v2';
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
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Keep the offline library and downloaded reader pages available after they
  // have first been opened online. Actual chapter text is stored separately in IndexedDB.
  if (request.mode === 'navigate') {
    const isOfflineRoute = url.pathname === '/offline' || url.pathname.startsWith('/offline/read/');
    if (!isOfflineRoute) return;
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match(OFFLINE_URL)) || Response.error();
      }
    })());
    return;
  }

  // Cache same-origin Next.js assets after they load so the offline reader can
  // reuse the app code when the browser has previously visited it online.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const network = fetch(request).then((response) => {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => cached);
      return cached || network || Response.error();
    })());
  }
});
