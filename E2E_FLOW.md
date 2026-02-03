# 📋 LUỒNG HOẠT ĐỘNG END-TO-END (E2E) CỦA HỆ THỐNG HR CONNECT PWA

## 🎯 TỔNG QUAN

Hệ thống HR Connect PWA là một ứng dụng quản lý nhân sự với các luồng hoạt động chính:
1. **Khởi tạo hệ thống** - Tạo admin user tự động
2. **Quản lý nhân viên** - Admin tạo/quản lý nhân viên
3. **Đăng nhập** - Nhân viên đăng nhập bằng OTP qua email
4. **Sử dụng hệ thống** - Các chức năng theo role (ADMIN/EMPLOYEE)

---

## 🔄 LUỒNG HOẠT ĐỘNG CHI TIẾT

### 1️⃣ KHỞI TẠO HỆ THỐNG

**Khi nào**: Khi ứng dụng được khởi động lần đầu hoặc khi module `db.ts` được load

**Luồng hoạt động**:
```
1. App.tsx được mount
   ↓
2. Kiểm tra environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
   ↓
3. Nếu thiếu → Hiển thị EnvError component
   ↓
4. Nếu đủ → Khởi tạo database (initializeDB)
   ↓
5. Kiểm tra admin user (admin@congty.com) đã tồn tại chưa
   ↓
6. Nếu chưa có → Tạo admin user tự động trong bảng users
   ↓
7. Hệ thống sẵn sàng hoạt động
```

**Chi tiết kỹ thuật**:
- File: `services/db.ts` → `initializeDB()`
- Admin user mặc định:
  - Email: `admin@congty.com`
  - Role: `ADMIN`
  - Department: `Board`
  - Status: `ACTIVE`
  - Contract Type: `OFFICIAL`

---

### 2️⃣ QUẢN LÝ NHÂN VIÊN (ADMIN ONLY)

**Khi nào**: Admin đăng nhập và vào tab "USERS" trong AdminPanel

**Luồng hoạt động**:
```
1. Admin đăng nhập thành công → Redirect đến /admin
   ↓
2. AdminPanel hiển thị với sidebar chứa 12 tabs
   ↓
3. Admin click tab "USERS" → UsersManagement component được render
   ↓
4. Admin click "Thêm nhân viên" → Form tạo user mới
   ↓
5. Admin điền thông tin:
   - Tên, Email, Role, Department
   - Employee Code, Job Title
   - Contract Type, Start Date
   - Salary (Gross, Social Insurance, Trainee)
   ↓
6. Submit form → createUser() được gọi
   ↓
7. Kiểm tra email đã tồn tại chưa
   ↓
8. Nếu chưa tồn tại → Insert vào bảng users
   ↓
9. Nếu đã tồn tại → Trả về user hiện có (không tạo mới)
   ↓
10. UI cập nhật danh sách nhân viên
```

**Chi tiết kỹ thuật**:
- Component: `components/admin/UsersManagement.tsx`
- Service: `services/db.ts` → `createUser()`
- Database: Bảng `users` trong Supabase
- Validation: Email phải unique, các trường bắt buộc được validate

---

### 3️⃣ ĐĂNG NHẬP (OTP AUTHENTICATION)

**Khi nào**: User truy cập ứng dụng và chưa đăng nhập

**Luồng hoạt động**:

#### 3.1. Gửi OTP

```
1. User truy cập ứng dụng → App.tsx kiểm tra localStorage
   ↓
2. Không có user → Hiển thị LoginScreen component
   ↓
3. User nhập email vào form
   ↓
4. Click "Gửi mã OTP" → handleEmailSubmit()
   ↓
5. Kiểm tra rate limit phía client (tối thiểu 10 giây giữa các request)
   ↓
6. Gọi sendOTP(email) từ services/auth.ts
   ↓
7. Validate email format (regex)
   ↓
8. Kiểm tra email có tồn tại trong bảng users không
   ↓
9. Nếu không tồn tại → Trả về lỗi: "Email chưa được đăng ký"
   ↓
10. Nếu tồn tại → Tạo mã OTP 6 chữ số ngẫu nhiên
   ↓
11. Lưu OTP vào bảng otp_codes với:
    - email: email của user
    - code: mã OTP 6 chữ số
    - expires_at: thời gian hiện tại + 5 phút
    - used: false
   ↓
12. Gọi sendOTPEmail() từ services/email.ts
   ↓
13. Gửi request đến Supabase Edge Function: /functions/v1/send-otp-email
   ↓
14. Edge Function gửi email qua Resend API với:
    - From: HR Connect <noreply@hr.y99.info>
    - To: email của user
    - Subject: "Mã OTP đăng nhập - HR Connect"
    - Body: HTML template chứa mã OTP
   ↓
15. Nếu thành công → UI chuyển sang màn hình nhập OTP
   ↓
16. Hiển thị countdown timer 5 phút
```

#### 3.2. Xác thực OTP

```
1. User nhận được email chứa mã OTP
   ↓
2. User nhập mã OTP vào form (6 chữ số)
   ↓
3. Click "Xác thực OTP" → handleOTPSubmit()
   ↓
4. Gọi verifyOTP(email, otp) từ services/auth.ts
   ↓
5. Validate OTP format (phải là 6 chữ số)
   ↓
6. Kiểm tra email có tồn tại trong bảng users không
   ↓
7. Nếu không tồn tại → Trả về lỗi
   ↓
8. Nếu tồn tại → Gọi verifyOTPCode() từ services/db.ts
   ↓
9. Query bảng otp_codes với điều kiện:
    - email = email của user
    - code = mã OTP nhập vào
    - used = false
    - expires_at > thời gian hiện tại
   ↓
10. Nếu không tìm thấy → Trả về false (OTP không đúng hoặc đã hết hạn)
   ↓
11. Nếu tìm thấy → Kiểm tra lại expiration một lần nữa
   ↓
12. Đánh dấu OTP đã sử dụng (used = true) bằng RPC function mark_otp_as_used
   ↓
13. Lấy thông tin user từ bảng users
   ↓
14. Trả về success: true và user object
   ↓
15. Gọi handleLogin(user) trong App.tsx
   ↓
16. Lưu user vào state và localStorage
   ↓
17. Redirect đến URL phù hợp với role:
    - ADMIN → /admin
    - EMPLOYEE/HR/MANAGER → /employee
```

**Chi tiết kỹ thuật**:
- Component: `App.tsx` → `LoginScreen`
- Services:
  - `services/auth.ts` → `sendOTP()`, `verifyOTP()`
  - `services/db.ts` → `createOTPCode()`, `verifyOTPCode()`
  - `services/email.ts` → `sendOTPEmail()`
- Edge Function: `supabase/functions/send-otp-email/index.ts`
- Database Tables:
  - `users`: Lưu thông tin user
  - `otp_codes`: Lưu mã OTP với expiration và used flag
- Rate Limiting:
  - Client-side: Tối thiểu 10 giây giữa các request
  - Server-side: Supabase có thể rate limit (5 phút nếu vượt quá)

---

### 4️⃣ ROUTING SAU KHI ĐĂNG NHẬP

**Luồng hoạt động**:
```
1. User đăng nhập thành công
   ↓
2. handleLogin(user) được gọi
   ↓
3. Lưu user vào state và localStorage
   ↓
4. Kiểm tra role của user:
   ↓
5. Nếu role = ADMIN:
    → updateViewAndURL('admin', true)
    → URL: /admin
    → View: 'admin'
    → Render: AdminPanel component
   ↓
6. Nếu role = EMPLOYEE/HR/MANAGER:
    → updateViewAndURL('dashboard', true)
    → URL: /employee
    → View: 'dashboard'
    → Render: Dashboard component (trong Layout mobile)
```

**Chi tiết routing**:
- Routes chính:
  - `/` - Trang đăng nhập (chỉ khi chưa login)
  - `/admin` - Admin Panel (chỉ ADMIN)
  - `/employee` - Employee Dashboard (EMPLOYEE/HR/MANAGER)
- Custom routing: Sử dụng `window.history.pushState/replaceState` (không dùng React Router)
- URL sync: URL được sync với view state
- Browser navigation: Hỗ trợ back/forward button với `popstate` event

---

### 5️⃣ SỬ DỤNG HỆ THỐNG - ADMIN

**Khi nào**: User có role = ADMIN đăng nhập thành công

**Luồng hoạt động**:
```
1. Admin đăng nhập → Redirect đến /admin
   ↓
2. AdminPanel component được render với:
    - Sidebar bên trái (desktop layout)
    - 12 tabs quản lý:
      * USERS - Quản lý nhân viên
      * ATTENDANCE - Quản lý chấm công
      * LEAVE - Quản lý nghỉ phép
      * SHIFT - Quản lý đăng ký ca
      * PAYROLL - Quản lý bảng lương
      * REPORTS - Thống kê báo cáo
      * DEPARTMENTS - Quản lý phòng ban
      * HOLIDAYS - Quản lý ngày lễ
      * CONFIG - Cấu hình hệ thống
      * NOTIFICATIONS - Quản lý thông báo
      * EXPORT - Xuất/Nhập dữ liệu
      * SETTINGS - Cài đặt hệ thống
   ↓
3. Admin click vào tab → Component tương ứng được render
   ↓
4. Admin thực hiện các thao tác CRUD:
    - Tạo/Sửa/Xóa nhân viên
    - Xem/Phê duyệt chấm công
    - Xem/Phê duyệt đơn nghỉ phép
    - Quản lý ca làm việc
    - Tính toán và quản lý lương
    - Xem báo cáo thống kê
    - Quản lý phòng ban
    - Quản lý ngày lễ
    - Cấu hình hệ thống
    - Gửi thông báo
    - Xuất/Nhập dữ liệu
   ↓
5. Tất cả thao tác được lưu vào Supabase database
   ↓
6. UI tự động cập nhật sau mỗi thao tác
```

**Chi tiết kỹ thuật**:
- Component: `components/AdminPanel.tsx`
- Layout: Desktop với sidebar (không dùng Layout mobile)
- Views:
  - `admin` - AdminPanel chính
  - `salary-management` - Quản lý tính lương
  - `employee-profile` - Hồ sơ nhân viên (từ UsersManagement)
- Services: `services/db.ts` chứa tất cả database operations

---

### 6️⃣ SỬ DỤNG HỆ THỐNG - EMPLOYEE

**Khi nào**: User có role = EMPLOYEE/HR/MANAGER đăng nhập thành công

**Luồng hoạt động**:
```
1. Employee đăng nhập → Redirect đến /employee
   ↓
2. Layout component được render với:
    - Mobile layout (max-width: 768px)
    - Bottom navigation với 4 tabs:
      * Dashboard - Trang chủ
      * Check-in - Chấm công
      * Shifts - Đăng ký ca
      * Payroll - Xem lương
   ↓
3. Dashboard view được hiển thị mặc định
   ↓
4. Employee click vào tab → View tương ứng được render:
   ↓
5. Dashboard:
    - Hiển thị thông tin tổng quan
    - Thống kê cá nhân
   ↓
6. Check-in:
    - Lấy vị trí GPS hiện tại
    - Chấm công vào/ra
    - Lưu vào bảng attendance_records
   ↓
7. Shifts:
    - Xem lịch làm việc theo tuần/tháng
    - Đăng ký ca làm việc
    - Lưu vào bảng shift_registrations
   ↓
8. Payroll:
    - Xem bảng lương cá nhân
    - Lọc theo tháng/năm
    - Dữ liệu từ bảng payroll_records
```

**Chi tiết kỹ thuật**:
- Component: `components/Layout.tsx` (mobile layout)
- Views:
  - `dashboard` - `components/Dashboard.tsx`
  - `checkin` - `components/CheckIn.tsx`
  - `shifts` - `components/ShiftRegister.tsx`
  - `payroll` - `components/Payroll.tsx`
- Services: `services/db.ts` chứa các hàm:
  - `createAttendanceRecord()` - Tạo bản ghi chấm công
  - `createShiftRegistration()` - Đăng ký ca làm việc
  - `getPayrollRecords()` - Lấy bảng lương

---

### 7️⃣ ĐĂNG XUẤT

**Luồng hoạt động**:
```
1. User click nút "Đăng xuất" (trong sidebar hoặc bottom nav)
   ↓
2. Gọi handleLogout() trong App.tsx
   ↓
3. Gọi signOut() từ services/auth.ts
   ↓
4. Xóa user khỏi state và localStorage
   ↓
5. Redirect về trang login (/)
   ↓
6. Reset view về 'dashboard'
```

**Chi tiết kỹ thuật**:
- Service: `services/auth.ts` → `signOut()`
- Action: Xóa `current_user` khỏi localStorage
- Redirect: `window.history.replaceState({}, '', '/')`

---

## 🔐 BẢO MẬT

### Rate Limiting
- **Client-side**: Tối thiểu 10 giây giữa các request gửi OTP
- **Server-side**: Supabase có thể rate limit (5 phút nếu vượt quá)

### OTP Security
- Mã OTP có hiệu lực **5 phút**
- Mỗi mã OTP chỉ sử dụng được **một lần**
- OTP được đánh dấu `used = true` sau khi xác thực thành công
- OTP hết hạn tự động được cleanup

### Authentication
- **KHÔNG** cho phép đăng ký tự động
- Chỉ cho phép đăng nhập nếu email đã được admin tạo trước đó
- Không sử dụng Supabase Auth OTP, tự quản lý OTP trong database

### Authorization
- Route protection: Kiểm tra role trước khi render view
- Admin routes chỉ accessible bởi ADMIN
- Employee routes accessible bởi EMPLOYEE/HR/MANAGER

---

## 📊 DATABASE SCHEMA

### Bảng chính:
1. **users** - Thông tin nhân viên
2. **otp_codes** - Mã OTP đăng nhập
3. **attendance_records** - Bản ghi chấm công
4. **leave_requests** - Đơn nghỉ phép
5. **shift_registrations** - Đăng ký ca làm việc
6. **payroll_records** - Bảng lương
7. **notifications** - Thông báo
8. **departments** - Phòng ban
9. **holidays** - Ngày lễ
10. **system_configs** - Cấu hình hệ thống

---

## 🔄 FLOW DIAGRAM TỔNG QUAN

```
┌─────────────────────────────────────────────────────────────┐
│                    KHỞI TẠO HỆ THỐNG                         │
│              (Tạo admin user tự động)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN ĐĂNG NHẬP                           │
│              (OTP qua email)                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              ADMIN TẠO NHÂN VIÊN                             │
│         (Qua UsersManagement)                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              NHÂN VIÊN ĐĂNG NHẬP                             │
│        1. Nhập email                                         │
│        2. Nhận OTP qua email                                 │
│        3. Nhập OTP                                           │
│        4. Xác thực thành công                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────┐          ┌──────────────────┐
│ ADMIN PANEL   │          │ EMPLOYEE DASHBOARD│
│ (/admin)      │          │ (/employee)       │
│               │          │                   │
│ - Users       │          │ - Dashboard       │
│ - Attendance  │          │ - Check-in        │
│ - Leave       │          │ - Shifts          │
│ - Shifts      │          │ - Payroll         │
│ - Payroll     │          │                   │
│ - Reports     │          │                   │
│ - ...         │          │                   │
└───────────────┘          └──────────────────┘
```

---

## 📝 GHI CHÚ QUAN TRỌNG

1. **Không có đăng ký tự động**: Chỉ admin mới có thể tạo user mới
2. **OTP tự quản lý**: Không sử dụng Supabase Auth OTP, tự quản lý trong database
3. **Custom routing**: Không dùng React Router, sử dụng `window.history` API
4. **Role-based access**: Mỗi role có views và routes riêng
5. **Mobile-first**: Employee dashboard được thiết kế cho mobile
6. **Desktop-first**: Admin panel được thiết kế cho desktop

---

**Tài liệu được tạo**: 02/02/2026  
**Phiên bản**: 1.0
