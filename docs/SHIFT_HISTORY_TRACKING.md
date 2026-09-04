# Tính năng Lịch sử Đăng ký và Duyệt Ca làm

## Tổng quan

Hệ thống đã được cập nhật để ghi nhận đầy đủ lịch sử liên quan đến đăng ký ca làm việc, bao gồm:

1. **Thời gian đăng ký ca** - Khi nhân viên tạo/sửa đăng ký
2. **Thời gian duyệt** - Khi admin duyệt/từ chối đăng ký
3. **Người duyệt** - Admin nào đã thực hiện thao tác duyệt
4. **Lịch sử bật/tắt đăng ký ca** - Tracking khi admin bật/tắt chức năng đăng ký ca

## 1. Tracking trong Shift Registrations

### Các trường mới

Bảng `shift_registrations` đã được bổ sung 3 trường:

```sql
-- Thời gian cập nhật gần nhất
updated_at BIGINT

-- Thời gian admin duyệt/từ chối  
reviewed_at BIGINT

-- ID của admin đã duyệt/từ chối
reviewed_by UUID REFERENCES users(id)
```

### Luồng hoạt động

1. **Khi nhân viên đăng ký ca mới:**
   - `created_at`: timestamp hiện tại
   - `updated_at`: NULL (chưa sửa)
   - `reviewed_at`: NULL (chưa duyệt)
   - `reviewed_by`: NULL
   - `status`: PENDING

2. **Khi admin duyệt/từ chối:**
   - `updated_at`: timestamp hiện tại
   - `reviewed_at`: timestamp hiện tại
   - `reviewed_by`: ID của admin
   - `status`: APPROVED hoặc REJECTED

3. **Khi nhân viên đổi lịch ca đã duyệt:**
   - `updated_at`: timestamp hiện tại
   - `status`: chuyển về PENDING (cần duyệt lại)
   - `reviewed_at`: giữ nguyên (lịch sử duyệt lần trước)
   - `reviewed_by`: giữ nguyên

## 2. Lịch sử Bật/Tắt Đăng ký Ca

### Bảng mới: `shift_registration_config_history`

```sql
CREATE TABLE shift_registration_config_history (
  id UUID PRIMARY KEY,
  enabled BOOLEAN NOT NULL,              -- true = bật, false = tắt
  changed_by UUID NOT NULL,              -- Admin thay đổi
  changed_at BIGINT NOT NULL,            -- Thời gian (milliseconds)
  reason TEXT,                           -- Lý do (tùy chọn)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Ghi log tự động

Mỗi khi admin bật/tắt đăng ký ca tại `/admin/shift`, hệ thống tự động:

1. Lưu vào bảng `system_configs` (key: `shift_registration_enabled`)
2. Ghi log vào `shift_registration_config_history` với:
   - enabled: true/false
   - changed_by: ID của admin
   - changed_at: timestamp hiện tại
   - reason: lý do mặc định (có thể custom)

## 3. Cách sử dụng trong Code

### Đọc thông tin tracking từ shift registration

```typescript
import { getShiftRegistrations } from './services/db';

const shifts = await getShiftRegistrations(userId);

shifts.forEach(shift => {
  console.log('Đăng ký lúc:', new Date(shift.createdAt));
  
  if (shift.updatedAt) {
    console.log('Cập nhật lúc:', new Date(shift.updatedAt));
  }
  
  if (shift.reviewedAt) {
    console.log('Duyệt lúc:', new Date(shift.reviewedAt));
    console.log('Người duyệt:', shift.reviewedBy);
  }
});
```

### Lấy lịch sử bật/tắt đăng ký ca

```typescript
import { getShiftRegistrationConfigHistory } from './services/db';

// Lấy 50 bản ghi gần nhất
const history = await getShiftRegistrationConfigHistory(50);

history.forEach(record => {
  console.log(
    record.enabled ? 'Bật' : 'Tắt',
    'lúc', new Date(record.changedAt),
    'bởi', record.changedByUser.name,
    'lý do:', record.reason
  );
});
```

### Cập nhật config với logging tự động

```typescript
import { 
  updateSystemConfigWithHistory,
  createSystemConfigWithHistory 
} from './services/db';

// Update existing config
await updateSystemConfigWithHistory(
  configId,
  'true',                           // value
  currentUserId,                    // updated by
  'shift_registration_enabled',     // key
  'Mở lại sau khi điều chỉnh lịch' // reason
);

// Create new config
await createSystemConfigWithHistory(
  'shift_registration_enabled',
  'true',
  'Cho phép NV đăng ký ca',
  'ATTENDANCE',
  currentUserId,
  'Khởi tạo hệ thống'
);
```

## 4. Hiển thị trên UI

### Chi tiết ca đã đăng ký

Trong modal chi tiết ca (khi click vào ô trong lưới), hiển thị:

```
📅 Ngày đăng ký: 15/01/2025 09:30
📝 Cập nhật lần cuối: 16/01/2025 14:20
✅ Duyệt lúc: 16/01/2025 15:45
👤 Người duyệt: Nguyễn Văn A (Admin)
```

### Lịch sử bật/tắt (có thể thêm tab mới)

```
🔄 Lịch sử Đăng ký Ca

20/01/2025 16:00 - Tắt bởi Admin A
Lý do: Tạm khóa để điều chỉnh lịch tháng 2

18/01/2025 09:00 - Bật bởi Admin A  
Lý do: Mở lại sau Tết

15/01/2025 17:00 - Tắt bởi Admin B
Lý do: Nghỉ Tết Nguyên Đán
```

## 5. Migration

File migration: `supabase/migrations/031_add_shift_history_tracking.sql`

### Chạy migration

```bash
npx supabase db push
```

### Rollback (nếu cần)

```sql
-- Xóa bảng lịch sử
DROP TABLE IF EXISTS shift_registration_config_history CASCADE;

-- Xóa các cột tracking
ALTER TABLE shift_registrations
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS reviewed_at,
  DROP COLUMN IF EXISTS reviewed_by;
```

## 6. Benefits

### Cho Admin
- ✅ Biết chính xác khi nào nhân viên đăng ký/đổi ca
- ✅ Biết ai đã duyệt ca nào, lúc nào
- ✅ Track lịch sử bật/tắt đăng ký ca để audit
- ✅ Dễ troubleshoot khi có vấn đề về lịch

### Cho Nhân viên
- ✅ Biết ca của mình đã được duyệt lúc nào
- ✅ Biết admin nào đã duyệt (nếu cần hỏi thêm)

### Cho Hệ thống
- ✅ Audit trail đầy đủ cho compliance
- ✅ Dữ liệu để phân tích hành vi đăng ký ca
- ✅ Debug dễ dàng hơn khi có tranh chấp

## 7. Notes

- Các bản ghi cũ (trước khi migration) sẽ có `updated_at = created_at` và `reviewed_at = created_at` cho ca đã duyệt
- Bảng `shift_registration_config_history` có RLS policy - chỉ admin và HR mới xem được
- Realtime đã được bật cho bảng lịch sử
- Lịch sử được sắp xếp theo `changed_at` giảm dần (mới nhất trước)
