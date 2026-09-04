-- Migration: Thêm tracking lịch sử cho shift registrations
-- Mục đích: Ghi nhận thời gian duyệt, người duyệt, và lịch sử bật/tắt đăng ký ca

-- 1. Thêm các cột tracking vào shift_registrations
ALTER TABLE shift_registrations
  ADD COLUMN IF NOT EXISTS updated_at BIGINT,
  ADD COLUMN IF NOT EXISTS reviewed_at BIGINT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Cập nhật updated_at cho các bản ghi hiện có (set = created_at)
UPDATE shift_registrations 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- KHÔNG cập nhật reviewed_at cho dữ liệu cũ
-- Chỉ các ca mới duyệt từ sau migration mới có reviewed_at
-- Dữ liệu cũ giữ reviewed_at = NULL

-- Thêm comment cho các cột mới
COMMENT ON COLUMN shift_registrations.updated_at IS 'Thời gian cập nhật gần nhất (timestamp)';
COMMENT ON COLUMN shift_registrations.reviewed_at IS 'Thời gian admin duyệt/từ chối (timestamp)';
COMMENT ON COLUMN shift_registrations.reviewed_by IS 'ID của admin đã duyệt/từ chối';

-- 2. Tạo bảng lịch sử thay đổi cấu hình đăng ký ca
CREATE TABLE IF NOT EXISTS shift_registration_config_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enabled BOOLEAN NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changed_at BIGINT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index để truy vấn lịch sử nhanh
CREATE INDEX IF NOT EXISTS idx_shift_config_history_changed_at 
  ON shift_registration_config_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_config_history_changed_by 
  ON shift_registration_config_history(changed_by);

-- Comment cho bảng
COMMENT ON TABLE shift_registration_config_history IS 'Lịch sử bật/tắt chức năng đăng ký ca làm';
COMMENT ON COLUMN shift_registration_config_history.enabled IS 'Trạng thái: true = bật, false = tắt';
COMMENT ON COLUMN shift_registration_config_history.changed_by IS 'Admin thực hiện thay đổi';
COMMENT ON COLUMN shift_registration_config_history.changed_at IS 'Thời gian thay đổi (timestamp milliseconds)';
COMMENT ON COLUMN shift_registration_config_history.reason IS 'Lý do thay đổi (tùy chọn)';

-- Enable RLS
ALTER TABLE shift_registration_config_history ENABLE ROW LEVEL SECURITY;

-- Policies: Admin và HR có thể xem lịch sử
CREATE POLICY "Config history is viewable by admins and HR" 
  ON shift_registration_config_history
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
        AND users.role IN ('ADMIN', 'HR')
    )
  );

-- Chỉ admin mới được insert lịch sử
-- Check: user đang login phải là ADMIN và changed_by phải là chính họ
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

-- Enable realtime cho bảng lịch sử
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_registration_config_history;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL;
END $$;

ALTER TABLE public.shift_registration_config_history REPLICA IDENTITY FULL;

-- Insert bản ghi đầu tiên: Giả định hệ thống mặc định bật từ đầu
INSERT INTO shift_registration_config_history (id, enabled, changed_by, changed_at, reason)
VALUES (
  uuid_generate_v4(),
  true,
  (SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1),
  EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  'Khởi tạo hệ thống - Đăng ký ca mặc định bật'
)
ON CONFLICT DO NOTHING;
