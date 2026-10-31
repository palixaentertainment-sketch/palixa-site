const CACHE_NAME = 'palixia-shell-v4';
const IMAGE_CACHE_NAME = 'palixia-images-v1';
const OFFLINE_URL = '/offline.html';
const APP_ICONS = ['/brand/icon-192.png', '/brand/icon-512.png'];
const MAX_CACHED_IMAGES = 180;

// Next.js static files use content-hashed URLs, so a cached copy is safe to
// reuse without contacting the network on every visit.
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

async function cachedImageResponse(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      try {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        if (keys.length > MAX_CACHED_IMAGES) {
          await Promise.all(keys.slice(0, keys.length - MAX_CACHED_IMAGES).map((key) => cache.delete(key)));
        }
      } catch {
        // A browser may refuse to store a response; the network response still works.
      }
    }
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cache optimized book covers and avatars served by Next.js, plus public
  // Supabase Storage images (including comic pages). Uploaded object paths are
  // unique, so previously cached images never need to be downloaded again.
  const nextOptimizedImage = url.origin === self.location.origin && url.pathname === '/_next/image';
  const publicSupabaseImage =
    request.destination === 'image' &&
    url.hostname.endsWith('.supabase.co') &&
    url.pathname.includes('/storage/v1/object/public/');
  if (nextOptimizedImage || publicSupabaseImage) {
    event.respondWith(cachedImageResponse(request));
    return;
  }

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
