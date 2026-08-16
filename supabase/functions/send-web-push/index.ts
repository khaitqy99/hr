import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Ưu tiên secrets trên Dashboard; fallback từ .env.local của dự án (cặp PUSH_VAPID_*)
const VAPID_PUBLIC_KEY =
  Deno.env.get('VAPID_PUBLIC_KEY') ||
  'BOFpNsDNenO2g4Z2q1Dx9m_lbsh3oDriTamq9V6oj0-QySYadqRa0YTnLTntSr4bjc37jP_iTmsXe6SZW-s7XQk'
const VAPID_PRIVATE_KEY =
  Deno.env.get('VAPID_PRIVATE_KEY') ||
  'tq_LVlU7UgsalOH648jmEt9M8nBhMImp9Uun9V3GAmU'
const VAPID_SUBJECT =
  Deno.env.get('VAPID_SUBJECT') || 'mailto:noreply@hr.y99.info'

interface NotificationRecord {
  id?: string
  user_id?: string
  title?: string
  message?: string
  type?: string
}

interface WebhookPayload {
  type?: 'INSERT' | 'UPDATE' | 'DELETE'
  table?: string
  record?: NotificationRecord
  schema?: string
}

interface ManualPayload {
  userId?: string
  title?: string
  body?: string
  message?: string
  url?: string
  tag?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY chưa được cấu hình')
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    const body = await req.json()
    const webhook = body as WebhookPayload
    const manual = body as ManualPayload

    const record = webhook.record
    const userId = record?.user_id || manual.userId
    const title = record?.title || manual.title || 'Y99 HR'
    const message =
      record?.message || manual.body || manual.message || 'Bạn có thông báo mới'
    const tag = manual.tag || (record?.id ? `notification-${record.id}` : `notification-${Date.now()}`)
    const url = manual.url || '/employee/notifications'

    if (webhook.type && webhook.type !== 'INSERT') {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: `event ${webhook.type}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    let query = supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id')

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: subscriptions, error } = await query
    if (error) throw error

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No subscriptions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload = JSON.stringify({
      title,
      body: message,
      message,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      url,
      tag,
      data: {
        url,
        notificationId: record?.id,
        userId,
        type: record?.type,
      },
    })

    const results: { endpoint: string; success: boolean; error?: string }[] = []

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        )
        results.push({ endpoint: sub.endpoint, success: true })
      } catch (err: any) {
        const statusCode = err?.statusCode || err?.status
        results.push({
          endpoint: sub.endpoint,
          success: false,
          error: err?.message || String(err),
        })

        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }

    const sent = results.filter((r) => r.success).length
    return new Response(
      JSON.stringify({ success: sent > 0 || results.length === 0, sent, total: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('send-web-push error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
