// Push Notification Service
// Quản lý push notification subscriptions và gửi notifications

// Không cần PushSubscriptionData interface nữa vì chỉ dùng local notifications

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  data?: any;
}

/**
 * Kiểm tra xem trình duyệt có hỗ trợ notifications không
 * Chỉ cần Service Worker và Notification API (không cần PushManager)
 */
export const isPushSupported = (): boolean => {
  return (
    'serviceWorker' in navigator &&
    'Notification' in window
  );
};

/**
 * Kiểm tra quyền notification hiện tại
 */
export const getNotificationPermission = (): NotificationPermission => {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
};

/**
 * Yêu cầu quyền notification
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    throw new Error('Trình duyệt này không hỗ trợ thông báo');
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    throw new Error('Quyền thông báo đã bị từ chối. Vui lòng bật trong cài đặt trình duyệt');
  }

  const permission = await Notification.requestPermission();
  return permission;
};

/**
 * Kiểm tra xem push notifications đã được kích hoạt chưa
 * (Kiểm tra quyền và Service Worker)
 */
export const getPushSubscription = async (): Promise<boolean> => {
  if (!isPushSupported()) {
    return false;
  }

  try {
    const permission = getNotificationPermission();
    if (permission !== 'granted') {
      return false;
    }

    if (!('serviceWorker' in navigator)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    return !!registration;
  } catch (error) {
    console.error('Lỗi khi kiểm tra push subscription:', error);
    return false;
  }
};

/**
 * Tạo push subscription mới
 * Lưu ý: Không cần VAPID key cho local notifications qua Service Worker
 * Chỉ cần quyền notification và Service Worker đã sẵn sàng
 */
export const subscribeToPush = async (): Promise<boolean> => {
  if (!isPushSupported()) {
    throw new Error('Push notifications không được hỗ trợ');
  }

  // Kiểm tra quyền
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    throw new Error('Quyền thông báo chưa được cấp');
  }

  try {
    // Kiểm tra Service Worker đã sẵn sàng chưa
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker không được hỗ trợ');
    }

    const registration = await navigator.serviceWorker.ready;
    if (!registration) {
      throw new Error('Service Worker chưa sẵn sàng');
    }

    console.log('✅ Push notifications đã được kích hoạt (local notifications)');
    return true;
  } catch (error: any) {
    console.error('Lỗi khi kích hoạt push notifications:', error);
    throw error;
  }
};

/**
 * Hủy push notifications (chỉ cần revoke permission)
 */
export const unsubscribeFromPush = async (): Promise<boolean> => {
  // Không thể programmatically revoke permission
  // User phải tự tắt trong cài đặt trình duyệt
  console.log('💡 Để tắt push notifications, vui lòng tắt quyền thông báo trong cài đặt trình duyệt');
  return true;
};

// Không cần subscriptionToJSON nữa vì chỉ dùng local notifications

/**
 * Kiểm tra thiết bị mobile
 */
const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Kiểm tra app đã được cài đặt như PWA chưa
 */
const isPWAInstalled = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches;
};

/**
 * Gửi local notification
 * Tối ưu cho mobile: Ưu tiên Service Worker trên mobile, direct Notification trên desktop
 */
export const sendLocalNotification = async (
  payload: PushNotificationPayload
): Promise<void> => {
  const permission = getNotificationPermission();
  if (permission !== 'granted') {
    throw new Error('Quyền thông báo chưa được cấp');
  }

  const title = payload.title || 'Thông báo mới';
  const body = payload.body || payload.message || 'Bạn có thông báo mới';
  const isMobile = isMobileDevice();
  const isStandalone = isPWAInstalled();

  // Trên mobile, đặc biệt là iOS, Service Worker là cách tốt nhất
  // iOS Safari chỉ hỗ trợ notifications khi app được cài đặt như PWA
  if (isMobile || isStandalone) {
    // Ưu tiên Service Worker trên mobile
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        
        if (registrations.length === 0) {
          throw new Error('Không tìm thấy Service Worker');
        }

        const registration = await navigator.serviceWorker.ready;
        
        if (registration && registration.active) {
          const options = {
            body: body,
            icon: payload.icon || '/icon-192.png',
            badge: payload.badge || '/icon-192.png',
            vibrate: payload.vibrate || [200, 100, 200],
            tag: payload.tag || 'hr-notification-' + Date.now(),
            requireInteraction: payload.requireInteraction || false,
            silent: payload.silent || false,
            data: {
              ...payload.data,
              url: payload.url || '/employee/notifications',
            },
          };
          
          await registration.showNotification(title, options);
          console.log('✅ [Push] Notification sent via Service Worker (mobile optimized)');
          return;
        }
      } catch (swError: any) {
        console.error('❌ [Push] Service Worker error:', swError);
        // Fallback sang direct notification nếu Service Worker thất bại
      }
    }
  }

  // Trên desktop hoặc khi Service Worker không khả dụng, thử direct Notification
  try {
    const notificationOptions = {
      body: body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      vibrate: payload.vibrate || [200, 100, 200],
      tag: payload.tag || 'hr-notification-' + Date.now(),
      requireInteraction: payload.requireInteraction || false,
      silent: payload.silent || false,
    };
    
    const notification = new Notification(title, notificationOptions);
    
    notification.onclick = () => {
      window.focus();
      if (payload.url) {
        window.location.href = payload.url;
      }
      notification.close();
    };

    notification.onshow = () => {
      console.log('✅ [Push] Notification shown successfully');
    };

    notification.onerror = (error) => {
      console.error('❌ [Push] Notification error:', error);
    };

    notification.onclose = () => {
      console.log('ℹ️ [Push] Notification closed');
    };
    
    return;
  } catch (error: any) {
    console.error('❌ [Push] Direct notification error:', error);
    
    // Nếu direct notification thất bại và chưa thử Service Worker, thử Service Worker
    if (!isMobile && 'serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length > 0) {
          const registration = await navigator.serviceWorker.ready;
          if (registration && registration.active) {
            const options = {
              body: body,
              icon: payload.icon || '/icon-192.png',
              badge: payload.badge || '/icon-192.png',
              vibrate: payload.vibrate || [200, 100, 200],
              tag: payload.tag || 'hr-notification-' + Date.now(),
              requireInteraction: payload.requireInteraction || false,
              silent: payload.silent || false,
              data: {
                ...payload.data,
                url: payload.url || '/employee/notifications',
              },
            };
            await registration.showNotification(title, options);
            console.log('✅ [Push] Notification sent via Service Worker (fallback)');
            return;
          }
        }
      } catch (swError: any) {
        console.error('❌ [Push] Service Worker fallback error:', swError);
      }
    }
    
    throw new Error(`Không thể hiển thị thông báo: ${error.message || error}`);
  }
};

// Không cần VAPID key conversion và arrayBufferToBase64 nữa vì chỉ dùng local notifications
