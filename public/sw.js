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

// ============ PUSH NOTIFICATIONS ============

// Lắng nghe push events
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let notificationData = {
    title: 'Thông báo mới',
    body: 'Bạn có thông báo mới',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'hr-connect-notification',
    data: {},
  };

  // Parse notification data từ push payload
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.message || payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        tag: payload.tag || notificationData.tag,
        data: {
          ...payload.data,
          url: payload.url || '/notifications',
          notificationId: payload.notificationId,
          type: payload.type || 'info',
        },
      };
    } catch (e) {
      // Nếu không parse được JSON, sử dụng text
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  // Hiển thị notification
  const promiseChain = self.registration.showNotification(notificationData.title, {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: notificationData.data,
    requireInteraction: notificationData.data.type === 'error' || notificationData.data.type === 'warning',
    vibrate: notificationData.data.type === 'error' ? [200, 100, 200] : [200],
    actions: [
      {
        action: 'open',
        title: 'Mở',
      },
      {
        action: 'close',
        title: 'Đóng',
      },
    ],
  });

  event.waitUntil(promiseChain);
});

// Lắng nghe khi user click vào notification
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || '/notifications';

  if (event.action === 'open' || !event.action) {
    // Mở ứng dụng tại URL được chỉ định
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Kiểm tra xem đã có window mở chưa
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Nếu chưa có, mở window mới
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  } else if (event.action === 'close') {
    // Đóng notification (đã được đóng ở trên)
    return;
  }
});

// Lắng nghe khi notification bị đóng
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});

// Lắng nghe message từ main thread
self.addEventListener('message', (event) => {
  console.log('Service worker received message:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Xử lý message để hiển thị notification khi app đang mở
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { payload } = event.data;
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      data: payload.data,
      requireInteraction: payload.data.type === 'error' || payload.data.type === 'warning',
      vibrate: payload.data.type === 'error' ? [200, 100, 200] : [200],
      actions: [
        {
          action: 'open',
          title: 'Mở',
        },
        {
          action: 'close',
          title: 'Đóng',
        },
      ],
    });
  }
});
