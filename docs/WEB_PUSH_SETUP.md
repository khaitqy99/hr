# Web Push (PWA) — thiết lập để thông báo hoạt động khi app đã đóng

## 1. Migration

Chạy migration `029_recreate_push_subscriptions.sql` trên dự án Supabase (CLI hoặc SQL Editor):

```bash
supabase db push
# hoặc dán nội dung file vào SQL Editor rồi Run
```

## 2. VAPID keys

Tạo một lần:

```bash
npx web-push generate-vapid-keys
```

### Frontend (Vite / Vercel)

Thêm vào `.env` / Vercel Environment Variables:

```
VITE_VAPID_PUBLIC_KEY=<Public Key từ lệnh trên>
```

### Supabase Edge Function secrets

```bash
supabase secrets set VAPID_PUBLIC_KEY="<Public Key>"
supabase secrets set VAPID_PRIVATE_KEY="<Private Key>"
supabase secrets set VAPID_SUBJECT="mailto:noreply@hr.y99.info"
```

Hoặc Dashboard → Edge Functions → Secrets.

> Nếu CLI báo thiếu quyền: function `send-web-push` đã có fallback VAPID khớp `.env.local`. Khi set được secrets trên Dashboard, secrets sẽ được ưu tiên hơn fallback.

## 3. Deploy Edge Function

```bash
supabase functions deploy send-web-push --no-verify-jwt
```

`verify_jwt = false` đã có trong `supabase/config.toml` vì Database Webhook không gửi user JWT.

## 4. Database Webhook / trigger

Đã áp dụng migration `030_notifications_web_push_trigger.sql`: trigger `AFTER INSERT` trên `public.notifications` gọi Edge Function qua `pg_net`.

Hoặc tạo tay trên Dashboard → Database → Webhooks:

1. **Name:** `send-web-push-on-notification`
2. **Table:** `public.notifications`
3. **Events:** `INSERT`
4. **Type:** Supabase Edge Functions
5. **Edge Function:** `send-web-push`

Mỗi lần admin/hệ thống `INSERT` vào `notifications`, function gửi Web Push tới subscription của `user_id` đó.

## 5. Kiểm tra trên máy nhân viên

1. Deploy frontend (có `VITE_VAPID_PUBLIC_KEY`)
2. Mở PWA (iPhone: đã Add to Home Screen, iOS 16.4+)
3. Đăng nhập → cho phép thông báo (hoặc bấm Test Notification trong tab Thông báo)
4. Đóng / vuốt tắt app
5. Admin tạo thông báo cho user đó → máy nhân viên vẫn hiện banner

## 6. Giới hạn

- iPhone: chỉ PWA đã cài, không phải Safari tab thường
- RLS bảng `push_subscriptions` đang mở (giống kiến trúc OTP hiện tại) — phù hợp thông báo chung
- Nhân viên không cần xóa/cài lại app; chỉ cần mở app một lần sau khi deploy để đăng ký subscription + nhận SW mới
