// Push Notification Service
// Local notifications (app mở) + Web Push subscription (app đóng vẫn nhận)

import { supabase, isSupabaseConfigured } from './supabase';

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

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Kiểm tra xem trình duyệt có hỗ trợ notifications không
 */
export const isPushSupported = (): boolean => {
  return 'serviceWorker' in navigator && 'Notification' in window;
};

/**
 * Hỗ trợ Web Push (cần PushManager)
 */
export const isWebPushSupported = (): boolean => {
  return (
    isPushSupported() &&
    'PushManager' in window &&
    typeof window.PushManager !== 'undefined'
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
 * Yêu cầu quyền notification.
 * Luôn gọi requestPermission() khi chưa granted — nếu user mới dismiss (default)
 * trình duyệt sẽ hiện hộp xin quyền native. Nếu đã Block (denied), hầu hết
 * trình duyệt trả về denied ngay, không hiện UI (hạn chế bảo mật của browser).
 */
export const requestNotificationPermission = (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    return Promise.reject(new Error('Trình duyệt này không hỗ trợ thông báo'));
  }

  if (Notification.permission === 'granted') {
    return Promise.resolve('granted');
  }

  // Trả về thẳng Promise của browser để iOS không mất user gesture.
  return Notification.requestPermission();
};

const isIOSDevice = (): boolean =>
  /iPad|iPhone|iPod/i.test(navigator.userAgent) && !(window as any).MSStream;

const isPWAInstalled = (): boolean => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
};

/** Web Push trên iOS chỉ có từ 16.4 (Home Screen PWA). */
const isIOSPushVersionSupported = (): boolean => {
  const match = navigator.userAgent.match(/OS (\d+)[._](\d+)/);
  if (!match) return true;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > 16 || (major === 16 && minor >= 4);
};

/**
 * Chặn sớm trên iPhone khi chưa đủ điều kiện để hiện hộp xin quyền native.
 * Trả về null nếu có thể gọi requestPermission().
 */
export const getNotificationSetupHelp = (): string | null => {
  if (!isIOSDevice()) return null;

  if (!isIOSPushVersionSupported()) {
    return [
      'iPhone cần iOS 16.4 trở lên mới nhận được thông báo.',
      '',
      'Vào Cài đặt → Cài đặt chung → Cập nhật phần mềm, rồi mở lại app từ màn hình chính.',
    ].join('\n');
  }

  if (!isPWAInstalled()) {
    return [
      'Trên iPhone, thông báo không chạy trong Safari.',
      'Cần mở app từ icon trên Màn hình chính mới xin được quyền.',
      '',
      'Cài đặt Y99 HR:',
      '1. Mở trang này bằng Safari',
      '2. Chạm nút Chia sẻ (ô vuông có mũi tên lên)',
      '3. Chọn Thêm vào Màn hình chính',
      '4. Mở icon Y99 HR rồi nhấn Test Notification',
    ].join('\n');
  }

  return null;
};

/**
 * Hướng dẫn bật lại quyền khi trình duyệt đã Block (không thể hiện lại prompt native).
 */
export const getNotificationDeniedHelp = (): string => {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isStandalone = isPWAInstalled();

  if (isIOSDevice()) {
    if (!isPWAInstalled()) {
      return getNotificationSetupHelp() || '';
    }
    return [
      'Gỡ icon chưa đủ — iPhone vẫn nhớ lần Từ chối trong Safari.',
      'App cũng không hiện trong Cài đặt → Thông báo.',
      '',
      'Làm đủ các bước này:',
      '1. Nhấn giữ icon Y99 HR → Xóa app',
      '2. Cài đặt → Safari → Nâng cao → Dữ liệu website',
      '   (iOS mới: Cài đặt → Ứng dụng → Safari → Nâng cao)',
      '3. Tìm y99 → Xóa',
      '4. Tắt hẳn Safari (vuốt lên khỏi đa nhiệm)',
      '5. Mở Safari, vào lại trang',
      '6. Chia sẻ → Thêm vào Màn hình chính',
      '7. Mở icon mới → nhấn Test Notification',
    ].join('\n');
  }

  if (isAndroid && isStandalone) {
    return [
      'Trình duyệt không cho hiện lại hộp xin quyền sau khi đã từ chối.',
      '',
      'Bật lại trên Android (app đã cài):',
      '1. Nhấn giữ icon ứng dụng trên màn hình',
      '2. Chọn Cài đặt trang / Site settings',
      '3. Notifications → Cho phép',
      '4. Quay lại app và nhấn Test Notification',
    ].join('\n');
  }

  if (isAndroid) {
    return [
      'Trình duyệt không cho hiện lại hộp xin quyền sau khi đã từ chối.',
      '',
      'Bật lại trên Chrome Android:',
      '1. Nhấn biểu tượng ổ khóa cạnh thanh địa chỉ',
      '2. Quyền / Permissions',
      '3. Thông báo → Cho phép',
      '4. Nhấn lại Test Notification',
    ].join('\n');
  }

  return [
    'Trình duyệt không cho hiện lại hộp xin quyền sau khi đã từ chối.',
    '',
    'Bật lại trên máy tính:',
    '1. Nhấn biểu tượng ổ khóa trên thanh địa chỉ',
    '2. Notifications / Thông báo → Allow',
    '3. Tải lại trang rồi nhấn Test Notification',
  ].join('\n');
};

const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const getVapidPublicKey = (): string => {
  // Ưu tiên VITE_VAPID_PUBLIC_KEY; fallback key cũ trong .env.local
  return (
    (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_PUSH_VAPID_PUBLIC_KEY as string | undefined)?.trim() ||
    ''
  );
};

/**
 * Lấy subscription hiện tại từ PushManager (nếu có)
 */
export const getPushSubscription = async (): Promise<PushSubscription | null> => {
  if (!isWebPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
};

/**
 * Đăng ký Web Push và upsert vào Supabase
 */
export const subscribeToPush = async (userId: string): Promise<PushSubscription | null> => {
  if (!isWebPushSupported()) {
    console.warn('[Push] Trình duyệt không hỗ trợ Web Push');
    return null;
  }

  const vapidPublicKey = getVapidPublicKey();
  if (!vapidPublicKey) {
    console.warn('[Push] Thiếu VITE_VAPID_PUBLIC_KEY — bỏ qua đăng ký Web Push');
    return null;
  }

  if (!isSupabaseConfigured()) {
    console.warn('[Push] Supabase chưa cấu hình — bỏ qua đăng ký Web Push');
    return null;
  }

  let permission = getNotificationPermission();
  if (permission === 'default') {
    permission = await requestNotificationPermission();
  }
  if (permission !== 'granted') {
    console.warn('[Push] Chưa được cấp quyền thông báo');
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Subscription thiếu endpoint hoặc keys');
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    console.error('[Push] Lỗi lưu subscription:', error);
    throw new Error(`Không thể lưu subscription: ${error.message}`);
  }

  console.log('✅ [Push] Đã đăng ký Web Push cho user', userId);
  return subscription;
};

/**
 * Hủy subscription hiện tại (PushManager + DB)
 */
export const unsubscribeFromPush = async (): Promise<boolean> => {
  if (!isWebPushSupported()) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;

  const endpoint = subscription.endpoint;
  const ok = await subscription.unsubscribe();

  if (isSupabaseConfigured() && endpoint) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  }

  return ok;
};

/**
 * Đảm bảo đã subscribe sau khi đăng nhập (idempotent, không throw ra UI)
 */
export const ensurePushSubscription = async (userId: string): Promise<void> => {
  try {
    await subscribeToPush(userId);
  } catch (error) {
    console.warn('[Push] ensurePushSubscription thất bại:', error);
  }
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
  const body = payload.body || 'Bạn có thông báo mới';
  const isMobile = isMobileDevice();
  const isStandalone = isPWAInstalled();

  if (isMobile || isStandalone) {
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
      }
    }
  }

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

    return;
  } catch (error: any) {
    console.error('❌ [Push] Direct notification error:', error);

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
