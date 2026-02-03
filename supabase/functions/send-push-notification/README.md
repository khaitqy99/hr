# Edge Function: send-push-notification

Gửi Web Push notification tới user qua các subscription đã lưu trong bảng `push_subscriptions`.

## Cấu hình

1. **VAPID keys** (bắt buộc): Đặt trong Supabase Secrets (Dashboard > Project Settings > Edge Functions > Secrets hoặc CLI):

   ```bash
   supabase secrets set VAPID_PUBLIC_KEY="<giá trị VITE_VAPID_PUBLIC_KEY từ .env.local>"
   supabase secrets set VAPID_PRIVATE_KEY="<giá trị VAPID_PRIVATE_KEY từ .env.local>"
   ```

   Cặp key phải trùng với key dùng ở frontend (`.env.local`: `VITE_VAPID_PUBLIC_KEY`). Sinh key mới: `node scripts/generate-vapid-keys.mjs`.

2. **Deploy**

   ```bash
   supabase functions deploy send-push-notification
   ```

## Request

- **Method:** POST  
- **Headers:** `Authorization: Bearer <SUPABASE_ANON_KEY>`, `apikey: <SUPABASE_ANON_KEY>`, `Content-Type: application/json`  
- **Body:**

```json
{
  "userId": "uuid-của-user",
  "title": "Tiêu đề thông báo",
  "message": "Nội dung thông báo",
  "type": "info",
  "notificationId": "optional-uuid",
  "url": "/notifications"
}
```

## Response

- Thành công: `{ "success": true, "sent": 1, "total": 1 }`
- User không có subscription: `{ "success": true, "sent": 0, "message": "..." }`
- Lỗi: `{ "error": "..." }`

## Ghi chú

- Function dùng thư viện `web-push` (npm). Nếu deploy báo lỗi tương thích Deno, có thể cần chuyển sang thư viện Deno-native (ví dụ `@negrel/webpush`).
- Subscription trả về 410 Gone sẽ bị xóa khỏi `push_subscriptions`.
