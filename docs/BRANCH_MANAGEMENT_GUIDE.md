# Hướng dẫn quản lý chi nhánh

## Tổng quan

Hệ thống đã được cập nhật để hỗ trợ quản lý nhiều chi nhánh. Tính năng này cho phép:
- Tạo và quản lý thông tin các chi nhánh
- Gán nhân viên vào từng chi nhánh
- Theo dõi nhân viên theo chi nhánh

## Cấu trúc database

### Bảng `branches`
- `id`: UUID - Mã định danh chi nhánh
- `name`: VARCHAR(255) - Tên chi nhánh
- `code`: VARCHAR(50) - Mã chi nhánh (unique)
- `address`: TEXT - Địa chỉ chi nhánh
- `phone`: VARCHAR(20) - Số điện thoại
- `manager_id`: UUID - ID người quản lý (tham chiếu đến bảng users)
- `is_active`: BOOLEAN - Trạng thái hoạt động
- `created_at`: TIMESTAMP - Ngày tạo
- `updated_at`: TIMESTAMP - Ngày cập nhật

### Bảng `users` (đã cập nhật)
- Thêm cột `branch_id`: UUID - ID chi nhánh (tham chiếu đến bảng branches)

## Hướng dẫn sử dụng

### 1. Quản lý chi nhánh (Admin)

#### Truy cập trang quản lý chi nhánh
1. Đăng nhập với tài khoản Admin
2. Vào menu Admin Panel
3. Chọn tab "Chi nhánh"

#### Tạo chi nhánh mới
1. Click nút "+ Thêm chi nhánh"
2. Điền thông tin:
   - Tên chi nhánh (bắt buộc)
   - Mã chi nhánh (bắt buộc, unique)
   - Địa chỉ (tùy chọn)
   - Số điện thoại (tùy chọn)
   - Quản lý (tùy chọn - chọn từ danh sách nhân viên)
   - Trạng thái (Hoạt động/Ngừng hoạt động)
3. Click "Tạo chi nhánh"

#### Chỉnh sửa chi nhánh
1. Trong danh sách chi nhánh, click "Sửa" ở chi nhánh cần chỉnh sửa
2. Cập nhật thông tin
3. Click "Cập nhật"

#### Xóa chi nhánh
1. Trong danh sách chi nhánh, click "Xóa"
2. Xác nhận xóa

**Lưu ý:** Khi xóa chi nhánh, các nhân viên thuộc chi nhánh đó sẽ không bị xóa, chỉ bị bỏ gán chi nhánh.

### 2. Gán chi nhánh cho nhân viên

#### Khi tạo nhân viên mới
1. Vào tab "Nhân viên" trong Admin Panel
2. Click "+ Thêm nhân viên"
3. Điền thông tin nhân viên
4. Chọn chi nhánh từ dropdown "Chi nhánh"
5. Click "Tạo tài khoản"

#### Cập nhật chi nhánh cho nhân viên hiện có
1. Vào tab "Nhân viên" trong Admin Panel
2. Click "Chỉnh sửa" ở nhân viên cần cập nhật
3. Hoặc click vào tên nhân viên để xem hồ sơ
4. Chọn chi nhánh mới từ dropdown
5. Click "Lưu" hoặc "Cập nhật"

### 3. Xem thông tin chi nhánh của nhân viên

#### Trong danh sách nhân viên
- Thông tin chi nhánh sẽ hiển thị trong cột tương ứng (nếu có)

#### Trong hồ sơ nhân viên
- Chi nhánh sẽ hiển thị trong phần "Thông tin cơ bản"
- Chỉ hiển thị khi nhân viên đã được gán chi nhánh

## Migration

Để áp dụng tính năng này cho database hiện tại:

```bash
# Chạy migration
psql -U postgres -d your_database -f supabase/migrations/020_add_branches.sql
```

Migration sẽ:
1. Tạo bảng `branches`
2. Thêm cột `branch_id` vào bảng `users`
3. Tạo 2 chi nhánh mặc định (CN1 và CN2)
4. Thiết lập RLS policies cho bảng `branches`

## API Functions

### Branches
- `getBranches()`: Lấy danh sách tất cả chi nhánh
- `createBranch(data)`: Tạo chi nhánh mới
- `updateBranch(id, data)`: Cập nhật thông tin chi nhánh
- `deleteBranch(id)`: Xóa chi nhánh

### Users (đã cập nhật)
- `createUser(data)`: Thêm field `branchId` (optional)
- `updateUser(id, data)`: Thêm field `branchId` (optional)
- `getAllUsers()`: Trả về thêm field `branchId`

## Types

### Branch Interface
```typescript
interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  managerId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### User Interface (đã cập nhật)
```typescript
interface User {
  // ... các field hiện có
  branchId?: string; // Thêm mới
}
```

## Lưu ý

1. Mã chi nhánh (code) phải unique trong hệ thống
2. Chỉ hiển thị các chi nhánh đang hoạt động (isActive = true) trong dropdown
3. Nhân viên có thể không thuộc chi nhánh nào (branchId = null)
4. Khi xóa chi nhánh, cần kiểm tra và cập nhật lại nhân viên thuộc chi nhánh đó
5. Người quản lý chi nhánh (manager) là tùy chọn và có thể là bất kỳ nhân viên nào

## Tính năng mở rộng (tương lai)

- Lọc nhân viên theo chi nhánh
- Báo cáo theo chi nhánh
- Cấu hình riêng cho từng chi nhánh (địa điểm chấm công, giờ làm việc, v.v.)
- Phân quyền quản lý theo chi nhánh
