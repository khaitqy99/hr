-- Lịch tự động bật/tắt đăng ký ca (NV), lưu JSON trong system_configs
INSERT INTO system_configs (id, key, value, description, category, updated_at)
VALUES (
  uuid_generate_v4(),
  'shift_registration_schedule',
  '{"mode":"manual"}',
  'Lịch tự động bật/tắt đăng ký ca cho nhân viên (JSON: mode manual|window|weekly)',
  'ATTENDANCE',
  EXTRACT(EPOCH FROM NOW())::BIGINT
)
ON CONFLICT (key) DO NOTHING;
