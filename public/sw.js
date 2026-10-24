/* Pico service worker: same-origin static resources only. Never cache API or user code. */
const VERSION = 'pico-shell-v1';
const SHELL = ['/', '/offline.html', '/pico-logo.svg', '/manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('pico-shell-') && key !== VERSION).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/python-runtime/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && response.type === 'basic' && url.pathname === '/') {
        const copy = response.clone();
        void caches.open(VERSION).then(cache => cache.put('/', copy));
      }
      return response;
    }).catch(async () => (await caches.match(request)) || (url.pathname === '/' ? await caches.match('/') : null) || (await caches.match('/offline.html'))));
    return;
  }
  if (url.pathname.startsWith('/assets/') || ['/pico-logo.svg','/manifest.webmanifest','/offline.html'].includes(url.pathname)) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        void caches.open(VERSION).then(cache => cache.put(request, copy));
      }
      return response;
    })));
  }
});
