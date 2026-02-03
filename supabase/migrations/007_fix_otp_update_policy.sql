-- Migration: Fix OTP update policy
-- Sửa RLS policy để cho phép UPDATE OTP từ used = false thành used = true

-- Drop policy cũ
DROP POLICY IF EXISTS "Allow update OTP codes" ON otp_codes;

-- Tạo lại policy với điều kiện rõ ràng hơn
-- USING: Kiểm tra row cũ phải là used = false và chưa hết hạn
-- WITH CHECK: Cho phép update thành used = true (đánh dấu đã dùng)
-- Lưu ý: Khi UPDATE từ used = false thành used = true, row mới sẽ có used = true
-- nên cần cho phép điều này trong WITH CHECK clause
CREATE POLICY "Allow update OTP codes" ON otp_codes
  FOR UPDATE 
  USING (
    -- Row cũ phải là used = false và chưa hết hạn
    used = false 
    AND expires_at > NOW()
  ) 
  WITH CHECK (
    -- Cho phép update thành used = true (đánh dấu đã dùng)
    -- Đây là trường hợp chính khi verify OTP
    used = true
    OR
    -- Hoặc giữ nguyên used = false nếu chỉ update field khác (như expires_at)
    (used = false AND expires_at > NOW())
  );

-- Tạo function SECURITY DEFINER để đánh dấu OTP đã dùng
-- Function này sẽ bypass RLS để đảm bảo có thể update OTP
CREATE OR REPLACE FUNCTION mark_otp_as_used(p_otp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Kiểm tra OTP có tồn tại và chưa được dùng không
  IF EXISTS (
    SELECT 1 FROM otp_codes 
    WHERE id = p_otp_id 
    AND used = false 
    AND expires_at > NOW()
  ) THEN
    -- Đánh dấu OTP đã được sử dụng
    UPDATE otp_codes
    SET used = true
    WHERE id = p_otp_id;
    RETURN true;
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
