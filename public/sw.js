// Service Worker cho HR Connect PWA
// File này sẽ được sử dụng thay cho service worker tự động tạo bởi VitePWA

// Import workbox
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

// Kiểm tra workbox có sẵn không
if (workbox) {
  console.log('Workbox loaded');

  // Skip waiting và claim clients ngay lập tức
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // Precache assets
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  // Cleanup outdated caches
  workbox.precaching.cleanupOutdatedCaches();

  // Cache strategy cho navigation requests
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: 'pages',
      plugins: [
        {
          cacheWillUpdate: async ({ response }) => {
            return response && response.status === 200 ? response : null;
          },
        },
      ],
    })
  );

  // Cache strategy cho fonts
  workbox.routing.registerRoute(
    /^https:\/\/fonts\.googleapis\.com\/.*/i,
    new workbox.strategies.CacheFirst({
      cacheName: 'google-fonts-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // Cache strategy cho Tailwind CSS CDN
  workbox.routing.registerRoute(
    /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
    new workbox.strategies.CacheFirst({
      cacheName: 'tailwind-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 1,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );
} else {
  console.error('Workbox could not be loaded');
}

// Lắng nghe message từ main thread (SKIP_WAITING)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
