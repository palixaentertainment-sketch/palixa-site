const CACHE_NAME = 'palixia-shell-v5';
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


function pushPayload(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch {
    return { body: event.data ? event.data.text() : '' };
  }
}

self.addEventListener('push', (event) => {
  const payload = pushPayload(event);
  const title = typeof payload.title === 'string' && payload.title ? payload.title : 'Palixia';
  const options = {
    body: typeof payload.body === 'string' ? payload.body : '',
    icon: payload.icon || '/brand/icon-192.png',
    badge: payload.badge || '/brand/icon-192.png',
    image: payload.image || undefined,
    tag: payload.tag || undefined,
    renotify: Boolean(payload.renotify),
    data: { url: payload.url || '/' },
    actions: Array.isArray(payload.actions) ? payload.actions.slice(0, 2) : [],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  let targetUrl = '/';
  try {
    const rawTarget = event.notification.data && event.notification.data.url;
    const target = new URL(rawTarget || '/', self.location.origin);
    if (target.origin === self.location.origin) targetUrl = target.href;
  } catch {
    targetUrl = self.location.origin + '/';
  }

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windowClients) {
      if (new URL(client.url).origin === self.location.origin) {
        const navigated = await client.navigate(targetUrl);
        return (navigated || client).focus();
      }
    }
    return self.clients.openWindow(targetUrl);
  })());
});
