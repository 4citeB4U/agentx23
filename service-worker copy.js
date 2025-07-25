// service-worker.js

const CACHE_NAME = 'agentlee-cache-v1';
const urlsToCache = [
  '/agentx23/',
  '/agentx23/index.html',
  '/agentx23/env.js',
  '/agentx23/agentlee.js',
  '/agentx23/docs.html',
  '/agentx23/assets/logo.png', // add all required asset paths
  '/agentx23/assets/styles.css'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keyList =>
      Promise.all(
        keyList.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
