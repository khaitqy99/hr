-- App đăng nhập bằng OTP + localStorage, không dùng supabase.auth session.
-- users.id khác auth.uid() (auth_user_id mới map tới auth.users).
-- Policy cũ `users.id = auth.uid()` chặn cả INSERT lẫn SELECT lịch sử bật/tắt.

DROP POLICY IF EXISTS "Config history can be inserted by admins" ON shift_registration_config_history;
DROP POLICY IF EXISTS "Config history is viewable by admins and HR" ON shift_registration_config_history;

CREATE POLICY "Config history is viewable by everyone"
  ON shift_registration_config_history
  FOR SELECT
  USING (true);

-- changed_by phải là user ADMIN/HR thật trong bảng users (id app, không phải auth.uid())
CREATE POLICY "Config history can be inserted by admins"
  ON shift_registration_config_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = changed_by
        AND users.role IN ('ADMIN', 'HR')
    )
  );
