/* Cache visited Pico workspaces and runtime assets for offline use. APIs are always network-only. */
const CACHE = 'pico-offline-v3';
const CORE = ['/', '/app', '/pico-logo.svg', '/manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(CORE.map(url => cache.add(url)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => (key.startsWith('pico-') && key !== CACHE)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_PICO_HOME') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    let manifest = [];
    try {
      const response = await fetch('/offline-assets.json', { cache: 'no-store' });
      if (response.ok) manifest = await response.json();
    } catch { /* Partial caching remains available if the manifest is unreachable. */ }
    const assets = Array.isArray(event.data.assets) ? event.data.assets : [];
    const urls = [...new Set(['/app', '/', '/pico-logo.svg', ...manifest, ...assets].filter(url =>
      typeof url === 'string' && (url === '/' || url === '/app' || url === '/pico-logo.svg' ||
      url.startsWith('/assets/') || url.startsWith('/python-runtime/'))))];
    let index = 0;
    await Promise.all(Array.from({length: 4}, async () => {
      while (index < urls.length) {
        const url = urls[index++];
        try {
          if (url !== '/' && url !== '/app' && await cache.match(url)) continue;
          const response = await fetch(url, { cache: 'no-store' });
          if (response.ok && response.type === 'basic') await cache.put(url, response);
        } catch { /* A later online visit may retry missing assets. */ }
      }
    }));
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/pico-online.txt') return;
  const appNavigation = request.mode === 'navigate' && (url.pathname === '/app' || url.pathname.startsWith('/app/'));
  const shellNavigation = request.mode === 'navigate';
  const staticAsset = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/python-runtime/') || url.pathname === '/pico-logo.svg' || url.pathname === '/manifest.webmanifest';
  if (!shellNavigation && !staticAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (staticAsset) {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    }
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(appNavigation ? '/app' : request, response.clone());
      return response;
    } catch {
      return (await cache.match(appNavigation ? '/app' : request)) || (await cache.match('/app')) || (await cache.match('/')) || Response.error();
    }
  })());
});
