/* Offline homepage shell only: never serve compilers or workspaces offline. */
const CACHE = 'pico-home-v2';
const CORE = ['/', '/pico-logo.svg', '/manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('pico-shell-') || (key.startsWith('pico-home-') && key !== CACHE)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_PICO_HOME') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const urls = ['/', '/pico-logo.svg', ...event.data.assets.filter(path => typeof path === 'string' && path.startsWith('/assets/'))];
    await Promise.allSettled(urls.map(async url => {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) await cache.put(url, response);
    }));
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/python-runtime/') || url.pathname === '/pico-online.txt') return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match('/')) || Response.error()));
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname === '/pico-logo.svg' || url.pathname === '/manifest.webmanifest') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request)) || Response.error();
      }
    })());
  }
});
