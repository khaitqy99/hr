// Supabase Edge Function: Gửi Web Push Notification
// Dùng VAPID private key để gửi tới các subscription đã lưu trong push_subscriptions

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:noreply@hr.y99.info',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

interface PushNotificationRequest {
  userId: string;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  notificationId?: string;
  url?: string;
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  enabled: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const apiKey = req.headers.get('apikey');
    if (!authHeader && !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys chưa được cấu hình. Đặt VAPID_PUBLIC_KEY và VAPID_PRIVATE_KEY trong Supabase secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: PushNotificationRequest = await req.json();

    const { userId, title, message, type = 'info', notificationId, url = '/notifications' } = body;
    if (!userId || !title || !message) {
      return new Response(
        JSON.stringify({ error: 'userId, title, message là bắt buộc' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, enabled')
      .eq('user_id', userId)
      .eq('enabled', true);

    if (error) {
      console.error('Error fetching push_subscriptions:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'User không có subscription nào' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.stringify({
      title,
      message,
      type,
      notificationId,
      url,
    });

    const pushSubscription = (sub: PushSubscriptionRow) => ({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    });

    let sent = 0;
    const errors: string[] = [];

    for (const sub of subscriptions as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(pushSubscription(sub), payload, {
          TTL: 86400,
          urgency: 'high',
        });
        sent += 1;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Push send error for subscription', sub.id, msg);
        errors.push(`${sub.id}: ${msg}`);
        // 410 Gone = subscription expired, có thể xóa khỏi DB
        if (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        total: subscriptions.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('send-push-notification error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
