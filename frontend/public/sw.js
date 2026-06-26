const CACHE_NAME = 'leadcrm-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // Return a simple offline fallback if network fails
          return new Response('You are offline. LeadCRM requires an internet connection to sync data, but you can still view cached pages.', {
            headers: { 'Content-Type': 'text/html' }
          });
        });
      }
    )
  );
});
