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

// ============ PUSH NOTIFICATIONS HANDLERS (Quan trọng cho mobile) ============

// Xử lý khi nhận được push notification (từ server hoặc local)
self.addEventListener('push', (event) => {
  console.log('📨 [SW] Push event received');
  
  let notificationData = {
    title: 'Y99 HR',
    body: 'Bạn có thông báo mới',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: '/employee/notifications',
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
        tag: data.tag || data.id || 'hr-notification',
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
        vibrate: data.vibrate || [100, 50, 100],
        data: {
          ...data,
          url: data.url || data.actionUrl || '/employee/notifications',
        },
      };
    } catch (e) {
      console.warn('⚠️ [SW] Could not parse push data:', e);
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

// Xử lý khi user click vào notification (quan trọng cho mobile)
self.addEventListener('notificationclick', (event) => {
  console.log('👆 [SW] Notification clicked');
  console.log('👆 [SW] Notification data:', event.notification.data);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/employee/notifications';
  console.log('🔗 [SW] URL to open:', urlToOpen);
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      console.log('🪟 [SW] Found clients:', clientList.length);
      
      // Kiểm tra xem có cửa sổ nào đang mở URL này không
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        console.log(`🪟 [SW] Client ${i}:`, client.url);
        if (client.url === urlToOpen && 'focus' in client) {
          console.log('✅ [SW] Focusing existing window');
          return client.focus();
        }
      }
      
      // Nếu không có cửa sổ nào mở, mở cửa sổ mới
      if (clients.openWindow) {
        console.log('🆕 [SW] Opening new window');
        return clients.openWindow(urlToOpen);
      }
    }).catch((error) => {
      console.error('❌ [SW] Error handling notification click:', error);
    })
  );
});

// Xử lý khi notification đóng (optional, để log)
self.addEventListener('notificationclose', (event) => {
  console.log('ℹ️ [SW] Notification closed:', event.notification.tag);
});