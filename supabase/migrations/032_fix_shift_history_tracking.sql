-- Migration: Fix lịch sử tracking
-- 1. Reset reviewed_at cho dữ liệu cũ về NULL (chỉ ca mới duyệt sau này mới track)
-- 2. Fix policy cho phép admin insert history

-- Reset reviewed_at của dữ liệu cũ về NULL
-- Chỉ ca được duyệt SAU migration này mới có reviewed_at chính xác
UPDATE shift_registrations 
SET reviewed_at = NULL
WHERE reviewed_at = created_at 
  AND status IN ('APPROVED', 'REJECTED');

-- Drop policy cũ và tạo lại với logic đúng
DROP POLICY IF EXISTS "Config history can be inserted by admins" ON shift_registration_config_history;

-- Policy mới: Cho phép admin insert và changed_by phải là chính họ
CREATE POLICY "Config history can be inserted by admins" 
  ON shift_registration_config_history
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
        AND users.role = 'ADMIN'
        AND users.id = changed_by
    )
  );

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_shift_registrations_reviewed_at 
  ON shift_registrations(reviewed_at) 
  WHERE reviewed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shift_registrations_reviewed_by 
  ON shift_registrations(reviewed_by) 
  WHERE reviewed_by IS NOT NULL;
