const CACHE_NAME = 'palixia-shell-v3';
const OFFLINE_URL = '/offline.html';
const APP_ICONS = ['/brand/icon-192.png', '/brand/icon-512.png'];

// Next.js static files use content-hashed URLs, so a cached copy is safe to
// reuse without contacting the network on every visit. Bump CACHE_NAME when
// changing the service-worker caching rules or the pre-cached brand assets.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL, ...APP_ICONS]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('palixia-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
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
    const isOfflineRoute =
      url.pathname === '/offline' || url.pathname.startsWith('/offline/read/');
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

  // Hashed Next.js assets are immutable. Serve a cached copy immediately and
  // only use the network the first time a particular asset is requested.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return (await cache.match(request)) || Response.error();
      }
    })());
  }
});
