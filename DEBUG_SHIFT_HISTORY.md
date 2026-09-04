# Debug: Lịch sử Đăng ký Ca

## Vấn đề đã phát hiện

### 1. ❌ Thời gian đăng ký = Thời gian duyệt
**Nguyên nhân:** Migration 031 tự động set `reviewed_at = created_at` cho tất cả ca đã duyệt (dữ liệu cũ)

**Fix:** 
- Migration 032 reset `reviewed_at = NULL` cho dữ liệu cũ
- Chỉ ca được duyệt SAU khi chạy migration mới có `reviewed_at` chính xác
- Dữ liệu cũ sẽ không hiển thị thông tin duyệt (vì không track được)

### 2. ❌ Lịch sử bật/tắt không lưu
**Nguyên nhân:** RLS policy quá strict

**Fix:**
- Migration 032 sửa policy: `changed_by` phải match với `auth.uid()`
- Thêm logging debug để track errors
- Index cho performance

## Các bước Fix

### Bước 1: Chạy Migration 032
```bash
npx supabase db push
```

Hoặc chạy trực tiếp SQL:
```sql
-- supabase/migrations/032_fix_shift_history_tracking.sql
```

### Bước 2: Test lại

#### A. Test Tracking Duyệt Ca
1. Vào `/admin/shift`
2. Duyệt 1 ca mới (PENDING → APPROVED)
3. Click vào ca đó
4. Kiểm tra modal có hiển thị:
   - ✅ Thời gian duyệt (khác thời gian đăng ký)
   - ✅ Người duyệt

**Expected:**
- Ca cũ (đã duyệt trước migration): KHÔNG hiển thị reviewed_at
- Ca mới (duyệt sau migration): Hiển thị đầy đủ

#### B. Test Lịch sử Bật/Tắt
1. Vào `/admin/shift`
2. Toggle "Bật" → "Tắt" hoặc ngược lại
3. Mở Console (F12)
4. Kiểm tra logs:
   ```
   [DEBUG] Logging shift config change: {...}
   [SUCCESS] Shift config history logged: {...}
   ```
5. Click button "📋 Lịch sử"
6. Xem modal có hiển thị record mới không

**Expected:**
- Console log thành công
- Modal hiển thị lịch sử thay đổi
- Record mới nhất ở đầu với label "Hiện tại"

## Debug Console Logs

### Khi bật/tắt đăng ký ca:

✅ **Thành công:**
```javascript
[DEBUG] Logging shift config change: {
  enabled: true,
  changedBy: "uuid-của-admin",
  reason: "Mở lại đăng ký ca cho nhân viên"
}
[SUCCESS] Shift config history logged: [{...}]
```

❌ **Thất bại - Policy Error:**
```javascript
[ERROR] Failed to log shift config history: {
  code: "42501",
  message: "new row violates row-level security policy"
}
```
→ **Fix:** Kiểm tra user đang login có role ADMIN không

❌ **Thất bại - Foreign Key Error:**
```javascript
[ERROR] Failed to log shift config history: {
  code: "23503",
  message: "violates foreign key constraint"
}
```
→ **Fix:** `changedBy` UUID không tồn tại trong bảng users

❌ **Thất bại - Table Not Found:**
```javascript
[ERROR] Failed to log shift config history: {
  code: "42P01",
  message: "relation \"shift_registration_config_history\" does not exist"
}
```
→ **Fix:** Migration 031 chưa chạy, run `npx supabase db push`

## Kiểm tra Database

### 1. Kiểm tra bảng có tồn tại không:
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'shift_registration_config_history'
);
```

### 2. Kiểm tra RLS policies:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'shift_registration_config_history';
```

### 3. Kiểm tra dữ liệu:
```sql
SELECT 
  h.*,
  u.name as changed_by_name,
  u.role
FROM shift_registration_config_history h
LEFT JOIN users u ON u.id = h.changed_by
ORDER BY h.changed_at DESC
LIMIT 10;
```

### 4. Kiểm tra reviewed_at:
```sql
-- Số ca có reviewed_at = created_at (nên = 0 sau migration 032)
SELECT COUNT(*) 
FROM shift_registrations 
WHERE reviewed_at = created_at;

-- Số ca có reviewed_at != NULL (ca mới duyệt sau migration)
SELECT COUNT(*) 
FROM shift_registrations 
WHERE reviewed_at IS NOT NULL;
```

## Manual Test Insert History

Nếu vẫn không lưu được, test trực tiếp:

```sql
-- 1. Lấy admin ID
SELECT id, email, role FROM users WHERE role = 'ADMIN' LIMIT 1;

-- 2. Insert thử (thay <admin-uuid> bằng ID từ bước 1)
INSERT INTO shift_registration_config_history 
  (enabled, changed_by, changed_at, reason)
VALUES 
  (true, '<admin-uuid>', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000, 'Test manual insert');

-- 3. Kiểm tra
SELECT * FROM shift_registration_config_history ORDER BY changed_at DESC LIMIT 1;
```

Nếu thất bại → check error message để biết vấn đề

## Rollback (nếu cần)

```sql
-- Xóa migration 032
DELETE FROM shift_registration_config_history;

-- Restore reviewed_at cho dữ liệu cũ (nếu muốn)
UPDATE shift_registrations 
SET reviewed_at = created_at 
WHERE reviewed_at IS NULL 
  AND status IN ('APPROVED', 'REJECTED');
```

## Expected Behavior Sau Fix

### Dữ liệu cũ (trước migration):
- `created_at`: có giá trị
- `updated_at`: = `created_at`
- `reviewed_at`: **NULL** (không track được)
- `reviewed_by`: **NULL**
- UI: Chỉ hiển thị "Thời gian đăng ký"

### Dữ liệu mới (sau migration):
- `created_at`: thời gian nhân viên đăng ký
- `updated_at`: = `created_at` (nếu chưa sửa)
- `reviewed_at`: thời gian admin duyệt (**KHÁC** created_at)
- `reviewed_by`: UUID của admin duyệt
- UI: Hiển thị đầy đủ tracking info

### Lịch sử bật/tắt:
- Mỗi lần toggle → 1 record mới trong `shift_registration_config_history`
- Button "📋 Lịch sử" → Modal hiển thị 50 records
- Record đầu tiên có label "Hiện tại"

## Contact Points

Nếu vẫn có vấn đề, check:
1. ✅ Migration 031 + 032 đã chạy?
2. ✅ Console có error logs?
3. ✅ User đang login có role ADMIN?
4. ✅ Supabase project có online?
5. ✅ RLS policies đúng chưa? (check bằng SQL trên)
