-- Migration: Create OTP codes table
-- Tạo bảng để lưu mã OTP tự tạo, không dùng Supabase Auth OTP

-- Bảng OTP Codes
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Index để tìm kiếm nhanh
  CONSTRAINT unique_active_otp UNIQUE NULLS NOT DISTINCT (email, code, expires_at)
);

-- Index để tìm kiếm OTP theo email và code
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_code ON otp_codes(email, code) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);

-- Function để tự động xóa OTP đã hết hạn (chạy định kỳ)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM otp_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Policy để cho phép insert OTP từ client-side
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Policy cho phép insert OTP (cho phép tất cả để client có thể tạo OTP)
CREATE POLICY "Allow insert OTP codes" ON otp_codes
  FOR INSERT WITH CHECK (true);

-- Policy cho phép select OTP để verify (chỉ đọc code chưa dùng và chưa hết hạn)
CREATE POLICY "Allow select active OTP codes" ON otp_codes
  FOR SELECT USING (used = false AND expires_at > NOW());

-- Policy cho phép update OTP để đánh dấu đã dùng (chỉ update code chưa dùng)
CREATE POLICY "Allow update OTP codes" ON otp_codes
  FOR UPDATE USING (used = false) WITH CHECK (true);
