import { supabase, isSupabaseConfigured } from './supabase';

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// VAPID public key - cần được cấu hình từ environment variable
// Để tạo VAPID keys, bạn có thể sử dụng: https://web-push-codelab.glitch.me/
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Convert base64 URL safe string to Uint8Array
 * VAPID public key phải là uncompressed P-256: 65 bytes (0x04 + 32 bytes X + 32 bytes Y).
 * Một số tool sinh ra 66 bytes (thêm byte length hoặc padding) - chuẩn hóa về đúng 65 bytes.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  try {
    // Remove any whitespace
    const cleaned = base64String.trim();
    
    // Add padding if needed
    const padding = '='.repeat((4 - cleaned.length % 4) % 4);
    const base64 = (cleaned + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    let outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    // Chuẩn hóa về đúng 65 bytes (Push API yêu cầu uncompressed P-256)
    if (outputArray.length === 66) {
      // 66 bytes: thường là [length=65] + [04][x][y] hoặc [04][x][y] + padding
      if (outputArray[0] === 0x04) {
        outputArray = outputArray.subarray(0, 65);
      } else if (outputArray[1] === 0x04) {
        outputArray = outputArray.subarray(1, 66);
      } else {
        outputArray = outputArray.subarray(0, 65);
      }
      console.log('VAPID key đã chuẩn hóa từ 66 xuống 65 bytes');
    } else if (outputArray.length !== 65) {
      if (outputArray.length > 65) {
        const idx = outputArray.indexOf(0x04);
        if (idx >= 0 && idx + 65 <= outputArray.length) {
          outputArray = outputArray.subarray(idx, idx + 65);
        } else {
          outputArray = outputArray.subarray(0, 65);
        }
      }
      console.warn(`VAPID key length: ${outputArray.length} bytes (expected 65), đã chuẩn hóa`);
    }
    
    if (outputArray.length !== 65 || outputArray[0] !== 0x04) {
      console.warn('VAPID key có thể không đúng format P-256 (byte đầu nên là 0x04)');
    }
    
    return outputArray;
  } catch (error) {
    console.error('Error converting VAPID key:', error);
    throw new Error(`Không thể convert VAPID key: ${error}`);
  }
}

/**
 * Kiểm tra xem browser có hỗ trợ push notifications không
 */
export function isPushNotificationSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Trên localhost (Chrome/Windows) push service (FCM) thường trả "push service error".
 * Chỉ cho phép subscribe khi chạy trên HTTPS (production).
 */
export function isPushSupportedOnOrigin(): boolean {
  if (typeof window === 'undefined') return true;
  const origin = window.location.origin;
  if (/^https:\/\//i.test(origin)) return true;
  if (/^http:\/\/localhost(\b|:)/i.test(origin) || /^http:\/\/127\.0\.0\.1(\b|:)/i.test(origin)) {
    return false; // localhost: push thường lỗi, hướng user lên production
  }
  return false; // HTTP khác không hỗ trợ push
}

/**
 * Kiểm tra xem user đã cấp quyền notification chưa
 */
export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Yêu cầu quyền notification từ user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('Browser không hỗ trợ notifications');
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    throw new Error('User đã từ chối notifications. Vui lòng bật trong cài đặt browser.');
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Đăng ký service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker không được hỗ trợ');
    return null;
  }

  try {
    // Kiểm tra xem đã có service worker đăng ký chưa
    const existingRegistration = await navigator.serviceWorker.getRegistration();
    if (existingRegistration) {
      console.log('✅ Service Worker đã tồn tại:', existingRegistration.scope);
      return existingRegistration;
    }

    // VitePWA với injectManifest sẽ tạo service worker tại /sw.js
    // Trong dev mode có thể ở /dev-dist/sw.js
    const swPath = '/sw.js';
    const registration = await navigator.serviceWorker.register(swPath, {
      scope: '/',
    });

    console.log('✅ Service Worker đã đăng ký:', registration.scope);
    
    // Đợi service worker active nếu đang installing
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        const worker = registration.installing!;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') {
            console.log('✅ Service Worker đã activated');
            resolve();
          }
        });
      });
    }

    return registration;
  } catch (error: any) {
    console.error('❌ Lỗi đăng ký Service Worker:', error);
    console.error('Chi tiết:', error.message);
    
    // Thử đăng ký với path khác nếu lỗi
    if (error.message?.includes('Failed to register')) {
      try {
        console.log('Thử đăng ký với /dev-dist/sw.js...');
        const registration = await navigator.serviceWorker.register('/dev-dist/sw.js', {
          scope: '/',
        });
        console.log('✅ Service Worker đã đăng ký với dev path');
        return registration;
      } catch (retryError) {
        console.error('❌ Lỗi khi thử lại:', retryError);
      }
    }
    
    return null;
  }
}

/**
 * Đăng ký push subscription
 */
export async function subscribeToPushNotifications(
  userId: string
): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) {
    throw new Error('Browser không hỗ trợ push notifications');
  }

  // Trên localhost push service (FCM) gần như luôn lỗi — không gọi subscribe, báo rõ
  if (!isPushSupportedOnOrigin()) {
    throw new Error(
      'Thông báo đẩy không khả dụng trên localhost. Vui lòng deploy lên https://hr.y99.info/ rồi mở ứng dụng tại đó và bật thông báo đẩy.'
    );
  }

  // Kiểm tra quyền notification
  const permission = await getNotificationPermission();
  if (permission !== 'granted') {
    const newPermission = await requestNotificationPermission();
    if (newPermission !== 'granted') {
      throw new Error('Cần quyền notification để nhận thông báo đẩy');
    }
  }

  // Đăng ký service worker
  let registration = await registerServiceWorker();
  if (!registration) {
    throw new Error('Không thể đăng ký service worker');
  }

  // Đợi service worker active (quan trọng!)
  // Nếu service worker đang installing, đợi nó active
  if (registration.installing) {
    console.log('Service worker đang installing, đợi active...');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout đợi service worker active'));
      }, 10000); // 10 seconds timeout
      
      const worker = registration!.installing!;
      worker.addEventListener('statechange', () => {
        console.log('Service worker state:', worker.state);
        if (worker.state === 'activated') {
          clearTimeout(timeout);
          resolve();
        } else if (worker.state === 'redundant') {
          clearTimeout(timeout);
          reject(new Error('Service worker bị redundant'));
        }
      });
    });
  } else if (registration.waiting) {
    // Nếu có waiting worker, activate nó
    console.log('Service worker đang waiting, skip waiting...');
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Đợi service worker ready (đảm bảo service worker đã active)
  // Retry nếu cần
  let retries = 0;
  while (retries < 3) {
    try {
      registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        console.log('✅ Service worker đã ready:', registration.active.scriptURL);
        console.log('Service worker state:', registration.active.state);
        break;
      }
    } catch (error) {
      console.warn(`Retry ${retries + 1}/3 để đợi service worker ready...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries++;
    }
  }
  
  if (!registration.active) {
    throw new Error('Service worker chưa active sau nhiều lần thử');
  }

  // Delay ngắn để push service (FCM) ổn định - giảm "push service error" trên Chrome/localhost
  await new Promise((r) => setTimeout(r, 1500));

  // Kiểm tra xem đã có subscription chưa
  let subscription = await registration.pushManager.getSubscription();

  // Nếu chưa có, tạo subscription mới
  if (!subscription) {
    if (!VAPID_PUBLIC_KEY) {
      throw new Error('VAPID public key chưa được cấu hình. Vui lòng thêm VITE_VAPID_PUBLIC_KEY vào environment variables.');
    }

    // Validate VAPID key format
    if (VAPID_PUBLIC_KEY.length < 80) {
      throw new Error('VAPID public key không đúng format. Vui lòng kiểm tra lại.');
    }

    try {
      console.log('Đang subscribe push với VAPID key:', VAPID_PUBLIC_KEY.substring(0, 20) + '...');
      console.log('VAPID key length:', VAPID_PUBLIC_KEY.length);
      console.log('Service worker state:', registration.active?.state);
      console.log('Push Manager available:', !!registration.pushManager);
      
      // Validate VAPID key format trước khi convert
      if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.trim().length === 0) {
        throw new Error('VAPID key không được để trống');
      }
      
      if (!/^[A-Za-z0-9_-]+$/.test(VAPID_PUBLIC_KEY.trim())) {
        throw new Error('VAPID key chứa ký tự không hợp lệ. Chỉ được phép: A-Z, a-z, 0-9, _, -');
      }
      
      console.log('VAPID key info:', {
        length: VAPID_PUBLIC_KEY.length,
        firstChars: VAPID_PUBLIC_KEY.substring(0, 20),
        lastChars: VAPID_PUBLIC_KEY.substring(VAPID_PUBLIC_KEY.length - 10),
      });
      
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY.trim());
      console.log('Application server key converted:', applicationServerKey.length, 'bytes');
      
      // Đảm bảo pushManager sẵn sàng
      if (!registration.pushManager) {
        throw new Error('Push Manager không khả dụng. Service worker có thể chưa active.');
      }
      
      // Kiểm tra permission một lần nữa
      const currentPermission = await Notification.requestPermission();
      if (currentPermission !== 'granted') {
        throw new Error('Notification permission chưa được cấp');
      }
      
      console.log('Đang subscribe với pushManager...');
      console.log('PushManager supported:', 'supportedContentEncodings' in registration.pushManager);
      
      // Retry khi gặp AbortError (push service đôi khi lỗi tạm thời)
      const maxRetries = 3;
      let lastError: any;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const subscribePromise = registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
          
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Subscribe timeout sau 10 giây')), 10000);
          });
          
          subscription = await Promise.race([subscribePromise, timeoutPromise]) as PushSubscription;
          lastError = null;
          break;
        } catch (subscribeError: any) {
          lastError = subscribeError;
          const isAbortOrPushError = subscribeError?.name === 'AbortError' || subscribeError?.message?.includes('push service');
          if (isAbortOrPushError && attempt < maxRetries) {
            console.warn(`Subscribe lỗi (lần ${attempt}/${maxRetries}), thử lại sau 2 giây...`, subscribeError?.message);
            await new Promise(r => setTimeout(r, 2000));
          } else {
            throw subscribeError;
          }
        }
      }
      
      if (lastError || !subscription) {
        throw lastError || new Error('Subscribe thất bại sau nhiều lần thử');
      }
      
      console.log('✅ Push subscription thành công:', subscription.endpoint);
      console.log('Subscription keys:', {
        p256dh: subscription.getKey('p256dh') ? 'present' : 'missing',
        auth: subscription.getKey('auth') ? 'present' : 'missing',
      });
    } catch (error: any) {
      console.error('❌ Lỗi khi subscribe push:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Cung cấp thông báo lỗi chi tiết hơn
      if (error.name === 'NotAllowedError') {
        throw new Error('Browser đã từ chối push subscription. Vui lòng kiểm tra cài đặt browser và permissions.');
      } else if (error.name === 'InvalidStateError') {
        throw new Error('Push subscription đã tồn tại hoặc không hợp lệ. Vui lòng thử unsubscribe trước.');
      } else if (error.name === 'AbortError' || error.message?.includes('push service error')) {
        const isLocalhost = typeof window !== 'undefined' && /^https?:\/\/localhost(\b|:)/i.test(window.location.origin);
        const errorMsg =
          'Không thể đăng ký thông báo đẩy (push service lỗi). ' +
          'Vui lòng: 1) Thử bật lại sau vài phút. ' +
          '2) Dùng nút "Xóa cache SW và tải lại" rồi bật lại. ' +
          (isLocalhost
            ? ' 3) Trên localhost đôi khi bị lỗi; sau khi deploy lên https://hr.y99.info/ thử bật lại tại đó.'
            : ' 3) Chạy trên HTTPS hoặc localhost.');
        console.error(errorMsg);
        throw new Error(errorMsg);
      } else if (error.message?.includes('VAPID') || error.message?.includes('key')) {
        throw new Error(`VAPID key không hợp lệ: ${error.message}. Vui lòng kiểm tra lại VITE_VAPID_PUBLIC_KEY trong .env.local`);
      } else if (error.message?.includes('service worker') || error.message?.includes('not ready')) {
        throw new Error('Service worker chưa sẵn sàng. Vui lòng đợi và thử lại sau vài giây.');
      } else {
        throw new Error(`Lỗi đăng ký push: ${error.name || 'Unknown'} - ${error.message || error}`);
      }
    }
  }

  // Lưu subscription vào database
  const subscriptionData = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
      auth: arrayBufferToBase64(subscription.getKey('auth')!),
    },
  };

  return await savePushSubscription(userId, subscriptionData);
}

/**
 * Reset service worker và push subscription (dùng khi gặp lỗi push service để thử lại từ đầu)
 */
export async function resetPushAndServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const regs = await navigator.serviceWorker.getRegistrations();
  for (const reg of regs) {
    const sub = await reg.pushManager.getSubscription().catch(() => null);
    if (sub) await sub.unsubscribe().catch(() => {});
    await reg.unregister();
  }

  if ('caches' in window) {
    const keys = await caches.keys();
    for (const key of keys) await caches.delete(key);
  }

  console.log('Đã reset service worker và push subscription. Tải lại trang để đăng ký lại.');
}

/**
 * Hủy đăng ký push notifications
 */
export async function unsubscribeFromPushNotifications(
  userId: string,
  subscriptionId?: string
): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await subscription.unsubscribe();
  }

  // Xóa subscription khỏi database
  if (isSupabaseConfigured()) {
    try {
      if (subscriptionId) {
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', subscriptionId)
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId);
        
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error deleting push subscription:', error);
      throw error;
    }
  }
}

/**
 * Lưu push subscription vào database
 */
async function savePushSubscription(
  userId: string,
  subscriptionData: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }
): Promise<PushSubscription | null> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase chưa được cấu hình, không thể lưu push subscription');
    return null;
  }

  try {
    // Kiểm tra xem đã có subscription với endpoint này chưa
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('endpoint', subscriptionData.endpoint)
      .single();

    if (existing) {
      // Cập nhật subscription hiện có
      const { data, error } = await supabase
        .from('push_subscriptions')
        .update({
          p256dh: subscriptionData.keys.p256dh,
          auth: subscriptionData.keys.auth,
          enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return mapSubscriptionFromDb(data);
    }

    // Tạo subscription mới
    const { data, error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: userId,
        endpoint: subscriptionData.endpoint,
        p256dh: subscriptionData.keys.p256dh,
        auth: subscriptionData.keys.auth,
        enabled: true,
      })
      .select()
      .single();

    if (error) throw error;
    return mapSubscriptionFromDb(data);
  } catch (error) {
    console.error('Error saving push subscription:', error);
    throw error;
  }
}

/**
 * Lấy push subscriptions của user
 */
export async function getUserPushSubscriptions(
  userId: string
): Promise<PushSubscription[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true);

    if (error) throw error;
    return (data || []).map(mapSubscriptionFromDb);
  } catch (error) {
    console.error('Error getting push subscriptions:', error);
    return [];
  }
}

/**
 * Bật/tắt push notifications
 */
export async function togglePushNotifications(
  userId: string,
  enabled: boolean
): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase chưa được cấu hình');
  }

  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ enabled })
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error toggling push notifications:', error);
    throw error;
  }
}

/**
 * Gửi push notification đến user
 * Hàm này sẽ được gọi từ backend/admin
 */
export async function sendPushNotification(
  userId: string,
  notification: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    url?: string;
  }
): Promise<void> {
  // Hàm này sẽ gọi API endpoint để gửi push notification
  // Backend sẽ sử dụng VAPID private key để gửi
  // Tạm thời, chúng ta sẽ sử dụng Supabase Edge Function hoặc API endpoint
  
  if (!isSupabaseConfigured()) {
    console.warn('Supabase chưa được cấu hình, không thể gửi push notification');
    return;
  }

  // TODO: Implement API call to send push notification
  // Có thể sử dụng Supabase Edge Function hoặc external API
  console.log('Sending push notification to user:', userId, notification);
}

/**
 * Helper: Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Map database row to PushSubscription interface
 */
function mapSubscriptionFromDb(row: any): PushSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
