// Retire existing offline shell caches and unregister this worker.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('pico-shell-')).map(key => caches.delete(key)));
    await self.registration.unregister();
  })());
});
// No fetch interception: the website requires a network connection.
