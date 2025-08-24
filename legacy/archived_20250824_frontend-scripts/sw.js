// Minimal stub service worker to avoid 404 when browsers check for /sw.js
self.addEventListener('install', event => {
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
  // noop - allow network requests to proceed normally
});
