-- Cho phép admin bật/tắt đăng ký ca từ nhân viên (system_configs)
INSERT INTO system_configs (id, key, value, description, category, updated_at)
VALUES (
  uuid_generate_v4(),
  'shift_registration_enabled',
  'true',
  'Cho phép nhân viên đăng ký và đổi lịch ca (true/false)',
  'ATTENDANCE',
  EXTRACT(EPOCH FROM NOW())::BIGINT
)
ON CONFLICT (key) DO NOTHING;
