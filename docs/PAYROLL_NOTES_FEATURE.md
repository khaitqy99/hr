# Tính năng Ghi chú cho Ca làm việc

## Tổng quan
Tính năng này cho phép admin thêm ghi chú cho từng ngày làm việc của nhân viên trong bảng lương. Ghi chú sẽ được lưu vào database và hiển thị cho cả admin và nhân viên.

## Các thay đổi

### 1. Database Migration
- **File**: `supabase/migrations/018_add_note_to_shift_registrations.sql`
- Thêm cột `note` (TEXT) vào bảng `shift_registrations`
- Cho phép lưu ghi chú cho mỗi ca làm việc

### 2. Type Definition
- **File**: `types.ts`
- Thêm field `note?: string` vào interface `ShiftRegistration`

### 3. Database Service
- **File**: `services/db.ts`
- Cập nhật `getShiftRegistrations()`: Lấy field `note` từ database
- Cập nhật `updateShiftRegistration()`: Hỗ trợ cập nhật field `note`

### 4. Admin UI - PayrollManagement
- **File**: `components/admin/PayrollManagement.tsx`
- Thêm state để quản lý việc edit note:
  - `editingNoteShiftId`: ID của shift đang được edit
  - `noteInputValue`: Giá trị note đang nhập
- Thêm các handler functions:
  - `handleEditNote()`: Bắt đầu edit note
  - `handleSaveNote()`: Lưu note vào database
  - `handleCancelEditNote()`: Hủy edit note
- UI trong dialog chi tiết lương:
  - Hiển thị note hiện tại (nếu có) với background màu vàng
  - Button "Thêm ghi chú" / "Sửa ghi chú"
  - Textarea để nhập/sửa note
  - Buttons "Lưu" và "Hủy"

### 5. Employee UI - Payroll
- **File**: `components/Payroll.tsx`
- Hiển thị note (read-only) trong chi tiết ca làm việc
- Note được hiển thị với background màu vàng để dễ nhận biết

## Cách sử dụng

### Cho Admin:
1. Vào trang `/admin/payroll`
2. Click vào tên nhân viên để xem chi tiết lương
3. Trong danh sách ca làm việc, mỗi ngày có section "Ghi chú"
4. Click "Thêm ghi chú" hoặc "Sửa ghi chú"
5. Nhập nội dung ghi chú
6. Click "Lưu" để lưu hoặc "Hủy" để hủy

### Cho Nhân viên:
1. Vào trang Lương (Payroll)
2. Click "Xem chi tiết" để xem chi tiết lương
3. Trong danh sách ca làm việc, ghi chú của admin sẽ hiển thị (nếu có)
4. Nhân viên chỉ có thể xem, không thể chỉnh sửa

## Ví dụ sử dụng
- Ghi chú về lý do làm thêm giờ
- Ghi chú về công việc đặc biệt trong ngày
- Ghi chú về điều chỉnh lương
- Ghi chú về vấn đề chấm công

## Migration
Để áp dụng tính năng này, cần chạy migration:
```sql
ALTER TABLE shift_registrations 
ADD COLUMN IF NOT EXISTS note TEXT;
```

Hoặc chạy migration file: `supabase/migrations/018_add_note_to_shift_registrations.sql`
