import { supabase, isSupabaseConfigured } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Gọi Supabase Edge Function để gửi push notification (dùng VAPID private key trên server)
 */
async function callSendPushEdgeFunction(
  userId: string,
  notification: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    notificationId?: string;
    url?: string;
  }
): Promise<{ success: boolean; sent?: number; error?: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, error: 'Supabase chưa được cấu hình' };
  }
  const functionUrl = `${SUPABASE_URL}/functions/v1/send-push-notification`;
  const res = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      userId,
      title: notification.title,
      message: notification.message,
      type: notification.type ?? 'info',
      notificationId: notification.notificationId,
      url: notification.url ?? '/notifications',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: data.error || `HTTP ${res.status}` };
  }
  return { success: true, sent: data.sent };
}

/**
 * Gửi push notification đến một user cụ thể
 * Gọi Edge Function send-push-notification (VAPID key chỉ có trên server)
 */
export async function sendPushNotificationToUser(
  userId: string,
  notification: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    notificationId?: string;
    url?: string;
  }
): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase chưa được cấu hình, không thể gửi push notification');
    return;
  }

  try {
    const result = await callSendPushEdgeFunction(userId, notification);
    if (result.error) {
      console.warn('Edge Function send-push-notification:', result.error);
    }
    if (result.sent === 0 && !result.error) {
      console.log('User không có push subscriptions đã đăng ký');
    }

    // Fallback: hiển thị notification trong app khi đang mở (qua Service Worker)
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        registration.active.postMessage({
          type: 'SHOW_NOTIFICATION',
          payload: {
            title: notification.title,
            body: notification.message,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `notification-${notification.notificationId || Date.now()}`,
            data: {
              url: notification.url || '/notifications',
              notificationId: notification.notificationId,
              type: notification.type || 'info',
            },
          },
        });
      }
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

/**
 * Gửi push notification đến nhiều users
 */
export async function sendPushNotificationToUsers(
  userIds: string[],
  notification: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    notificationId?: string;
    url?: string;
  }
): Promise<void> {
  // Gửi đến từng user
  await Promise.all(
    userIds.map(userId => sendPushNotificationToUser(userId, notification))
  );
}

/**
 * Gửi push notification đến tất cả employees (trừ admin)
 */
export async function sendPushNotificationToAllEmployees(
  notification: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    notificationId?: string;
    url?: string;
  }
): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase chưa được cấu hình, không thể gửi push notification');
    return;
  }

  try {
    // Lấy tất cả users có role không phải ADMIN
    const { data: users, error } = await supabase
      .from('users')
      .select('id')
      .neq('role', 'ADMIN');

    if (error) {
      console.error('Error getting employees:', error);
      return;
    }

    if (!users || users.length === 0) {
      console.log('Không có employees nào');
      return;
    }

    const userIds = users.map(u => u.id);
    await sendPushNotificationToUsers(userIds, notification);
  } catch (error) {
    console.error('Error sending push notification to all employees:', error);
  }
}
