# Supabase Edge Functions

## Deploy Edge Function để gửi email OTP

### 1. Cài đặt Supabase CLI (nếu chưa có)

```bash
npm install -g supabase
```

### 2. Login vào Supabase

```bash
supabase login
```

### 3. Link project

```bash
supabase link --project-ref your-project-ref
```

### 4. Set Environment Variable cho Resend API Key

```bash
supabase secrets set RESEND_API_KEY=re_4EWrmr9B_8N48wgfgVePFqy5sBKMqJXCe
```

Hoặc set trong Supabase Dashboard:
- Vào Project Settings → Edge Functions → Secrets
- Thêm secret: `RESEND_API_KEY` với value là API key của bạn

### 5. Deploy Edge Function

```bash
supabase functions deploy send-otp-email
```

**Lưu ý quan trọng**: Nếu gặp lỗi 403 Forbidden sau khi deploy:

1. **Kiểm tra config.toml**: File `supabase/config.toml` đã được tạo với `verify_jwt = false` để cho phép gọi từ client-side

2. **Hoặc set trong Supabase Dashboard**:
   - Vào Project Settings → Edge Functions
   - Tìm function `send-otp-email`
   - Set "Verify JWT" thành OFF (nếu có option này)

3. **Hoặc deploy với flag**:
   ```bash
   supabase functions deploy send-otp-email --no-verify-jwt
   ```

### 6. Test Edge Function

```bash
supabase functions invoke send-otp-email --body '{"email":"test@example.com","otpCode":"123456","userName":"Test User"}'
```

## Lưu ý

1. **Resend Domain**: Domain `hr.y99.info` đã được verify. `from` address đã được cập nhật thành:
   ```typescript
   from: 'HR Connect <noreply@hr.y99.info>'
   ```
   
   Nếu cần thay đổi, sửa trong `index.ts` tại dòng gọi Resend API.

2. **CORS**: Edge Function đã được cấu hình CORS để cho phép gọi từ client-side

3. **Security**: Resend API Key được lưu trong Supabase Secrets, không expose ở client-side

4. **403 Forbidden Error**: Nếu gặp lỗi 403, kiểm tra:
   - Edge Function đã được deploy thành công
   - Supabase client có đúng URL và anon key
   - Edge Function có thể được gọi từ browser (check CORS và authentication)
   
   Để làm Edge Function public (không cần authentication), có thể:
   - Bỏ qua việc verify JWT trong Edge Function (như đã làm)
   - Hoặc verify nhưng chấp nhận anon key từ Supabase client
