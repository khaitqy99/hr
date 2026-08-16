// Service Worker cho Y99 HR PWA
// File này sẽ được sử dụng thay cho service worker tự động tạo bởi VitePWA

// Cache Workbox CDN để tải nhanh hơn lần sau
const WORKBOX_CDN = 'https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js';

// Tối ưu: Cache Workbox CDN response để tránh delay khi reload
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('workbox-cdn-cache').then((cache) => {
      return fetch(WORKBOX_CDN).then((response) => {
        if (response.ok) {
          cache.put(WORKBOX_CDN, response.clone());
        }
        return response;
      }).catch(() => {
        // Nếu fetch fail, thử load từ cache
        return cache.match(WORKBOX_CDN);
      });
    })
  );
});

// Import workbox với fallback từ cache
let workboxLoaded = false;
try {
  importScripts(WORKBOX_CDN);
  workboxLoaded = true;
} catch (error) {
  console.warn('Failed to load Workbox from CDN, trying cache...', error);
  // Fallback: Thử load từ cache nếu có
  caches.open('workbox-cdn-cache').then((cache) => {
    cache.match(WORKBOX_CDN).then((cachedResponse) => {
      if (cachedResponse) {
        cachedResponse.text().then((text) => {
          try {
            // Sử dụng blob URL thay vì eval để tránh security warning
            const blob = new Blob([text], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            importScripts(blobUrl);
            URL.revokeObjectURL(blobUrl);
            workboxLoaded = true;
            console.log('Workbox loaded from cache');
          } catch (e) {
            console.error('Failed to load Workbox from cache', e);
          }
        });
      }
    });
  });
}

// Kiểm tra workbox có sẵn không
if (typeof workbox !== 'undefined' && workbox) {
  console.log('Workbox loaded');

  // Skip waiting và claim clients ngay lập tức
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // Precache assets
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  // Cleanup outdated caches
  workbox.precaching.cleanupOutdatedCaches();

  // Cache strategy cho navigation requests - tối ưu với timeout và offline fallback
  // Thêm ExpirationPlugin để tránh cache pages tích lũy vô hạn gây lag
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: 'pages',
      networkTimeoutSeconds: 3, // Timeout sau 3 giây để tránh delay
      plugins: [
        {
          cacheWillUpdate: async ({ response }) => {
            return response && response.status === 200 ? response : null;
          },
        },
        {
          handlerDidError: async () => {
            // Return offline page if network fails and no cache
            const cache = await caches.open('pages');
            const cachedResponse = await cache.match('/offline.html');
            return cachedResponse || new Response('Offline', { status: 503 });
          },
        },
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 30,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 7 ngày
        }),
      ],
    })
  );

  // Cache strategy cho API requests từ Supabase - tối ưu performance
  workbox.routing.registerRoute(
    ({ url }) => url.hostname.includes('supabase.co'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'supabase-api',
      networkTimeoutSeconds: 5,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 60 * 10, // Cache 10 phút (tăng từ 5 phút để giảm requests)
        }),
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

} else {
  console.error('Workbox could not be loaded');
}

// Lắng nghe message từ main thread (SKIP_WAITING và SEND_NOTIFICATIONS)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Handle notification broadcast from admin panel
  if (event.data && event.data.type === 'SEND_NOTIFICATIONS') {
    console.log('📨 [SW] Nhận yêu cầu gửi notifications từ admin:', event.data.notifications);

    const notifications = event.data.notifications || [];

    // Show notification for each employee
    notifications.forEach(async (notifData) => {
      try {
        const options = {
          body: notifData.body || notifData.message || 'Bạn có thông báo mới',
          icon: notifData.icon || '/icon-192.png',
          badge: notifData.badge || '/icon-192.png',
          vibrate: notifData.vibrate || [200, 100, 200],
          tag: notifData.tag || `notification-${Date.now()}`,
          requireInteraction: notifData.requireInteraction || false,
          silent: notifData.silent || false,
          data: {
            url: notifData.url || '/employee/notifications',
            ...notifData.data,
          },
        };

        await self.registration.showNotification(
          notifData.title || 'Y99 HR',
          options
        );

        console.log('✅ [SW] Đã gửi notification:', notifData.title);
      } catch (error) {
        console.error('❌ [SW] Lỗi khi gửi notification:', error);
      }
    });
  }
});

// ============ WEB PUSH (hoạt động khi app đã đóng) ============

self.addEventListener('push', (event) => {
  console.log('📨 [SW] Push event received');

  let notificationData = {
    title: 'Y99 HR',
    body: 'Bạn có thông báo mới',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: '/employee/notifications',
    tag: 'hr-notification',
    requireInteraction: false,
    silent: false,
    vibrate: [100, 50, 100],
    data: { url: '/employee/notifications' },
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || data.message || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        url: data.url || data.actionUrl || notificationData.url,
        tag: data.tag || data.id || notificationData.tag,
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
        vibrate: data.vibrate || [100, 50, 100],
        data: {
          ...data,
          url: data.url || data.actionUrl || data.data?.url || '/employee/notifications',
        },
      };
    } catch (e) {
      try {
        const text = event.data.text();
        if (text) notificationData.body = text;
      } catch (_) {
        console.warn('⚠️ [SW] Could not parse push data:', e);
      }
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    vibrate: notificationData.vibrate,
    tag: notificationData.tag,
    requireInteraction: notificationData.requireInteraction,
    silent: notificationData.silent,
    data: notificationData.data,
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('👆 [SW] Notification clicked');
  event.notification.close();

  const rawUrl = event.notification.data?.url || '/employee/notifications';
  const absoluteUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then((focused) => {
            if (focused && 'navigate' in focused) {
              return focused.navigate(absoluteUrl);
            }
            return focused;
          });
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl);
      }
    }).catch((error) => {
      console.error('❌ [SW] Error handling notification click:', error);
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('ℹ️ [SW] Notification closed:', event.notification.tag);
});
