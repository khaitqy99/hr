-- Migration: Fix OTP expiration check
-- Đảm bảo OTP đã hết hạn không thể được sử dụng để đăng nhập

-- Drop và recreate policy để đảm bảo nó hoạt động đúng
DROP POLICY IF EXISTS "Allow select active OTP codes" ON otp_codes;

-- Tạo lại policy với điều kiện chặt chẽ hơn
-- Supabase tự động xử lý timezone cho TIMESTAMP WITH TIME ZONE, chỉ cần dùng NOW()
CREATE POLICY "Allow select active OTP codes" ON otp_codes
  FOR SELECT USING (
    used = false 
    AND expires_at > NOW()
  );

-- Cập nhật policy update để chỉ cho phép update OTP chưa hết hạn
DROP POLICY IF EXISTS "Allow update OTP codes" ON otp_codes;

CREATE POLICY "Allow update OTP codes" ON otp_codes
  FOR UPDATE USING (
    used = false 
    AND expires_at > NOW()
  ) WITH CHECK (true);

-- Tạo index để tối ưu query tìm OTP
-- Lưu ý: Không thể dùng NOW() trong index predicate vì NOW() không phải IMMUTABLE
-- Index này sẽ index tất cả OTP chưa được sử dụng, và query sẽ filter thêm điều kiện expires_at
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_code_expires 
ON otp_codes(email, code, expires_at) 
WHERE used = false;
