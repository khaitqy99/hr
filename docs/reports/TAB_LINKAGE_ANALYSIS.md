# BÁO CÁO PHÂN TÍCH LIÊN KẾT GIỮA CÁC TAB

**Ngày tạo:** 05/02/2026  
**Mục đích:** Kiểm tra và phân tích luồng dữ liệu và liên kết giữa các tab/view trong ứng dụng HR Connect PWA

---

## 📋 TỔNG QUAN CÁC TAB/VIEW

### 1. **Employee Views (Nhân viên)**
- `dashboard` - Trang chủ nhân viên
- `checkin` - Chấm công vào/ra
- `shifts` - Đăng ký ca làm việc
- `payroll` - Xem bảng lương
- `notifications` - Thông báo

### 2. **Admin Views (Quản trị)**
- `admin` - Panel quản trị với các sub-tabs:
  - `users` - Quản lý nhân viên
  - `attendance` - Quản lý chấm công
  - `shift` - Quản lý đăng ký ca
  - `payroll` - Quản lý bảng lương
  - `reports` - Thống kê báo cáo
  - `departments` - Quản lý phòng ban
  - `holidays` - Quản lý ngày lễ
  - `config` - Cấu hình hệ thống
  - `export` - Xuất/Nhập dữ liệu
  - `notifications` - Quản lý thông báo
  - `settings` - Cài đặt hệ thống
- `salary-management` - Tính lương
- `employee-profile` - Hồ sơ nhân viên (chi tiết)

---

## 🔗 PHÂN TÍCH LIÊN KẾT GIỮA CÁC TAB

### ✅ **LIÊN KẾT ĐÃ ĐƯỢC THỰC HIỆN**

#### **1. Dashboard → Các tab khác**
- ✅ **Dashboard → CheckIn**: Có button "Chấm công" với `setView('checkin')`
- ✅ **Dashboard → Shifts**: Có button "Đăng ký ca" với `setView('shifts')`
- ✅ **Dashboard → Payroll**: Có button "Bảng lương" với `setView('payroll')`
- ✅ **Dashboard → Notifications**: Có button "Thông báo" với badge số lượng chưa đọc

**Dữ liệu được chia sẻ:**
- Dashboard hiển thị thông tin từ:
  - `getAttendance(user.id)` - Lịch sử chấm công
  - `getShiftRegistrations(user.id)` - Ca đăng ký hôm nay
  - `getNotifications(user.id)` - Số thông báo chưa đọc

#### **2. Payroll → Shifts**
- ✅ **Payroll → Shifts**: Có link "Xem đăng ký ca →" / "Xem chi tiết →" trong phần ngày công và ca đăng ký

**Dữ liệu được chia sẻ:**
- Payroll (tính lương theo **đăng ký ca**, không theo chấm công):
  - `calculateLeaveDays(user.id, month)` - Ngày nghỉ phép
  - `getShiftRegistrations(user.id)` - Ngày công từ ca đã duyệt (không OFF)

#### **3. AdminPanel → EmployeeProfile**
- ✅ **UsersManagement → EmployeeProfile**: Có function `handleEditUser` gọi `setView('employee-profile', { employeeId: emp.id })`

**Dữ liệu được chia sẻ:**
- EmployeeProfile nhận `employeeId` và load:
  - `getAllUsers()` - Lấy thông tin nhân viên
  - `getDepartments()` - Lấy danh sách phòng ban

#### **4. AdminPanel → PayrollManagement**
- ✅ **AttendanceManagement → PayrollManagement**: Có button "Tính lương" với `setView('admin', { adminPath: 'payroll' })`
- ✅ **ShiftManagement → PayrollManagement**: Có button "Tính lương" với `setView('admin', { adminPath: 'payroll' })`

**Dữ liệu được chia sẻ:**
- PayrollManagement sử dụng dữ liệu từ:
  - `getAllAttendance()` - Dữ liệu chấm công từ AttendanceManagement
  - `getShiftRegistrations()` - Dữ liệu đăng ký ca từ ShiftManagement

#### **5. EmployeeProfile → SalaryManagement**
- ✅ **EmployeeProfile → SalaryManagement**: Có button "Tính lương" với `setView('salary-management')`

#### **5. CheckIn → Shifts (Dữ liệu)**
- ✅ **CheckIn sử dụng dữ liệu từ Shifts**:
  - `getShiftRegistrations(user.id)` - Lấy ca đăng ký để tính trạng thái ON_TIME/LATE/EARLY_LEAVE/OVERTIME
  - `getOfficeLocation()` - Lấy vị trí văn phòng từ system config

#### **6. ShiftRegister → Holidays**
- ✅ **ShiftRegister sử dụng dữ liệu từ Holidays**:
  - `getHolidays()` - Hiển thị badge ngày lễ trên calendar
  - Tự động gợi ý chọn "Ngày off" với loại "LE" khi click vào ngày lễ

#### **9. Admin Components → Shared Data**
- ✅ **ReportsDashboard** sử dụng:
  - `getAllUsers()` - Tổng số nhân viên
  - `getShiftRegistrations(undefined, UserRole.ADMIN)` - Tất cả đăng ký ca
  - `getAllAttendance()` - Tất cả chấm công
  - `getDepartments()` - Danh sách phòng ban

- ✅ **PayrollManagement** sử dụng:
  - `getAllPayrolls(month)` - Bảng lương theo tháng
  - `getAllUsers()` - Danh sách nhân viên
  - `calculatePayroll()` - Tính toán lương

- ✅ **DataExportManagement** sử dụng:
  - `getAllUsers()` - Xuất danh sách nhân viên
  - `getAllAttendance()` - Xuất chấm công
  - `getShiftRegistrations()` - Xuất đăng ký ca
  - `getAllPayrolls()` - Xuất bảng lương
  - `getDepartments()` - Xuất phòng ban

---

## ⚠️ **CÁC LIÊN KẾT CHƯA ĐƯỢC THỰC HIỆN HOẶC THIẾU**

### **1. Dashboard → EmployeeProfile (Nhân viên)**
- ❌ **Thiếu**: Nhân viên không có cách xem hồ sơ của chính mình
- 💡 **Đề xuất**: Thêm button "Xem hồ sơ" trong Dashboard hoặc menu profile

### **3. PayrollManagement → EmployeeProfile**
- ❌ **Thiếu**: Không có link từ PayrollManagement đến EmployeeProfile để xem chi tiết nhân viên
- 💡 **Đề xuất**: Thêm link tên nhân viên trong PayrollManagement → EmployeeProfile

### **4. AttendanceManagement → EmployeeProfile**
- ❌ **Thiếu**: Không có link từ AttendanceManagement đến EmployeeProfile
- 💡 **Đề xuất**: Click vào tên nhân viên trong AttendanceManagement → EmployeeProfile

### **5. ShiftManagement → EmployeeProfile**
- ❌ **Thiếu**: Không có link từ ShiftManagement đến EmployeeProfile
- 💡 **Đề xuất**: Click vào tên nhân viên trong ShiftManagement → EmployeeProfile

### **6. ReportsDashboard → Chi tiết**
- ❌ **Thiếu**: Không có link từ các số liệu thống kê đến các trang chi tiết
- 💡 **Đề xuất**: 
  - Click vào "Tổng nhân viên" → UsersManagement
  - Click vào "Chấm công hôm nay" → AttendanceManagement
  - Click vào "Đăng ký ca" → ShiftManagement

### **7. NotificationsPanel → Các tab liên quan**
- ❌ **Thiếu**: Thông báo không có link đến các tab liên quan (ví dụ: thông báo về đăng ký ca → Shifts)
- 💡 **Đề xuất**: Thêm `actionUrl` hoặc `actionView` vào Notification type để có thể navigate

### **8. EmployeeProfile → Các tab khác**
- ❌ **Thiếu**: Không có link từ EmployeeProfile đến:
  - AttendanceManagement (xem lịch sử chấm công)
  - ShiftManagement (xem đăng ký ca)
  - PayrollManagement (xem bảng lương)
- 💡 **Đề xuất**: Thêm các tab hoặc button trong EmployeeProfile

---

## 📊 **LUỒNG DỮ LIỆU CHÍNH**

### **1. Luồng Chấm Công**
```
CheckIn → saveAttendance() → attendance_records (DB)
         ↓
Dashboard → getAttendance() → Hiển thị lịch sử
```
(Lương **không** tính từ chấm công; tính từ đăng ký ca.)

### **2. Luồng Đăng Ký Ca**
```
ShiftRegister → registerShift() → shift_registrations (DB)
             ↓
CheckIn → getShiftRegistrations() → Tính trạng thái ON_TIME/LATE
         ↓
Dashboard → getShiftRegistrations() → Hiển thị ca hôm nay
         ↓
Payroll / calculatePayroll() → calculateShiftWorkDays() → Ngày công (tính lương)
         ↓
ShiftManagement → getShiftRegistrations() → Quản lý đăng ký ca
```

### **3. Luồng Tính Lương**
```
PayrollManagement / SalaryManagement → calculatePayroll(useShift=true, useAttendance=false)
                 ↓
                 → calculateShiftWorkDays() → Ngày công từ đăng ký ca
                 → calculateLeaveDays() → Ngày nghỉ (trừ ra khỏi ngày công)
                 → getShiftRegistrations() → Ca làm việc (hiển thị chi tiết)
                 ↓
                 → createOrUpdatePayroll() → payroll_records (DB)
                 ↓
Payroll (Employee) → getPayroll() → Hiển thị bảng lương
```

### **4. Luồng Quản Lý Nhân Viên**
```
UsersManagement → createUser() → users (DB)
               ↓
               → handleEditUser() → EmployeeProfile
               ↓
EmployeeProfile → updateUser() → users (DB)
               ↓
               → setView('salary-management') → SalaryManagement
```

---

## 🔄 **ĐỒNG BỘ DỮ LIỆU**

### **✅ Đã có:**
1. **Offline Sync**: `syncAllOfflineData()` - Đồng bộ attendance records khi online
2. **Auto Reload**: Các component admin có `onRegisterReload` để reload dữ liệu
3. **Real-time Updates**: Dashboard và NotificationsPanel tự động reload mỗi 30 giây

### **⚠️ Cần cải thiện:**
1. **Cross-tab Updates**: Khi thay đổi dữ liệu ở một tab, các tab khác không tự động cập nhật
2. **Event System**: Chưa có hệ thống event để notify các component khi dữ liệu thay đổi
3. **Cache Invalidation**: Config cache có `invalidateConfigCache()` nhưng các cache khác chưa có

---

## 📝 **KẾT LUẬN**

### **Điểm mạnh:**
- ✅ Các liên kết cơ bản giữa Dashboard và các tab chính đã được thực hiện tốt
- ✅ Luồng dữ liệu từ CheckIn → Dashboard → Payroll hoạt động tốt
- ✅ AdminPanel có đầy đủ các sub-tabs và liên kết đến EmployeeProfile
- ✅ Đã thêm button "Tính lương" từ AttendanceManagement và ShiftManagement đến PayrollManagement
- ✅ Nhân viên có thể xem hồ sơ của mình từ menu profile với giao diện mobile
- ✅ Dữ liệu được chia sẻ tốt thông qua các service functions trong `db.ts`

### **Điểm cần cải thiện:**
- ⚠️ Thiếu liên kết từ AttendanceManagement và ShiftManagement đến EmployeeProfile (chỉ có từ UsersManagement)
- ⚠️ Thiếu liên kết từ PayrollManagement đến EmployeeProfile
- ⚠️ Thiếu liên kết từ ReportsDashboard đến các trang chi tiết
- ⚠️ NotificationsPanel chưa có link đến các tab liên quan
- ⚠️ EmployeeProfile chưa có link đến các tab quản lý khác (AttendanceManagement, ShiftManagement, PayrollManagement)

### **Đề xuất ưu tiên:**
1. ✅ **Hoàn thành**: Thêm button "Tính lương" từ AttendanceManagement và ShiftManagement đến PayrollManagement
2. **Cao**: Thêm link từ AttendanceManagement và ShiftManagement đến EmployeeProfile
3. **Cao**: Thêm link từ PayrollManagement đến EmployeeProfile
4. **Trung bình**: Thêm link từ ReportsDashboard đến các trang chi tiết
5. **Trung bình**: Thêm action links trong NotificationsPanel
6. **Thấp**: Thêm các tab trong EmployeeProfile để xem chi tiết chấm công, ca làm, lương

---

---

## ✅ **KIỂM TRA THỰC TẾ (05/02/2026)**

### **Các liên kết ĐÃ hoạt động đúng trong code:**

| Liên kết | File | Trạng thái |
|----------|------|------------|
| Dashboard → CheckIn, Shifts, Payroll, Notifications | Dashboard.tsx | ✅ setView() đúng |
| Payroll → Dashboard, Shifts | Payroll.tsx | ✅ Links "Xem chi tiết →" |
| Layout (nhân viên) → EmployeeProfile | Layout.tsx:280 | ✅ setView('employee-profile', {employeeId}) |
| UsersManagement → EmployeeProfile | AdminPanel.tsx:74 | ✅ handleEditUser |
| AttendanceManagement → PayrollManagement | AttendanceManagement.tsx:167 | ✅ Button "Tính lương" |
| AttendanceManagement → EmployeeProfile | AttendanceManagement.tsx:266 | ✅ Click tên nhân viên |
| ShiftManagement → PayrollManagement | ShiftManagement.tsx:325 | ✅ Button "Tính lương" |
| ShiftManagement → EmployeeProfile | ShiftManagement.tsx:406,565 | ✅ Click tên + modal |
| PayrollManagement → EmployeeProfile | PayrollManagement.tsx:246 | ✅ Click tên nhân viên |
| ReportsDashboard → users, shift, attendance | ReportsDashboard.tsx | ✅ Cards clickable |
| EmployeeProfile → SalaryManagement, admin tabs | EmployeeProfile.tsx | ✅ Quick actions |
| NotificationsPanel → shifts, checkin, payroll, admin | NotificationsPanel.tsx | ✅ getNotificationAction |

### **Event System – Đồng bộ dữ liệu:**
- ✅ `db.ts` emit events: users, attendance, shifts, payroll (created/updated/deleted)
- ✅ `AdminPanel` dùng `useDataEvents` – auto reload khi có thay đổi
- ⚠️ Chưa emit: departments, holidays, config, notifications (có helper nhưng chưa gọi trong db.ts)

### **Lỗi phát hiện:**
- ❌ **AdminPanel profile menu**: Button "Xem hồ sơ" (dòng 250-257) không gọi `setView` – click không có tác dụng → Đã sửa

---

## 📊 **KIỂM TRA HIỂN THỊ DỮ LIỆU (05/02/2026)**

### **1. PHẠM VI DỮ LIỆU – ĐÚNG VAI TRÒ**

| Tab | Nguồn dữ liệu | Scope | Trạng thái |
|-----|---------------|-------|------------|
| Dashboard | getAttendance(user.id), getShiftRegistrations(user.id), getNotifications(user.id) | Theo nhân viên | ✅ |
| CheckIn | getAttendance(user.id), getShiftRegistrations(user.id), getOfficeLocation() | Theo nhân viên | ✅ |
| ShiftRegister | getShiftRegistrations(user.id), getHolidays() | Theo nhân viên | ✅ |
| Payroll (NV) | getPayroll(user.id), calculateLeaveDays(), getShiftRegistrations(user.id) — ngày công từ đăng ký ca | Theo nhân viên | ✅ |
| NotificationsPanel | getNotifications(user.id) | Theo nhân viên | ✅ |
| AttendanceManagement | getAllAttendance(500), getAllUsers() | Toàn hệ thống | ✅ |
| ShiftManagement | getShiftRegistrations(undefined, UserRole.ADMIN), getAllUsers() | Toàn hệ thống | ✅ |
| PayrollManagement | getAllPayrolls(month), getAllUsers() | Toàn hệ thống | ✅ |
| ReportsDashboard | getAllUsers(), getShiftRegistrations(undefined, ADMIN), getAllAttendance() | Toàn hệ thống | ✅ |

### **2. ĐỊNH DẠNG VÀ LOGIC HIỂN THỊ**

| Tab | Mục kiểm tra | Trạng thái |
|-----|--------------|------------|
| Dashboard | Biểu đồ 5 ngày gần nhất, giờ làm = checkOut - checkIn | ✅ |
| Dashboard | Ca hôm nay: lọc shift APPROVED + cùng ngày | ✅ |
| Dashboard | Giờ tuần: Thứ 2–CN, tính từ cặp check-in/check-out | ✅ |
| Payroll (NV) | Ngày công từ đăng ký ca, ngày nghỉ phép, giờ OT (từ bản ghi lương) | ✅ |
| Payroll (NV) | Tháng: MM-YYYY, availableMonths từ getPayroll | ✅ |
| ShiftManagement | Lưới theo tuần, lọc phòng ban + tìm tên | ✅ |
| ShiftManagement | Ngày lễ hiển thị badge trên calendar | ✅ |
| AttendanceManagement | Lọc thời gian (Hôm nay/Tuần/Tháng/Tất cả) + nhân viên | ✅ |
| PayrollManagement | Tính lại: chỉ nhân viên ACTIVE, loại trừ ADMIN | ✅ |
| EmployeeProfile | Load từ getAllUsers rồi find theo employeeId | ⚠️ Tải tất cả users (có thể tối ưu) |

### **3. TRẠNG THÁI LOADING VÀ EMPTY**

| Tab | Loading | Empty state |
|-----|---------|-------------|
| Dashboard | Có (qua useEffect) | "Chưa có dữ liệu hôm nay" |
| Payroll (NV) | "Đang tải dữ liệu lương..." | "Chưa có dữ liệu lương" |
| AttendanceManagement | "Đang tải dữ liệu..." | "Chưa có dữ liệu chấm công" |
| ShiftManagement | Overlay "Đang tải..." | "Không có nhân viên nào" |
| PayrollManagement | "Đang tải dữ liệu" | "Chưa có dữ liệu bảng lương" |
| ReportsDashboard | Chưa có loading state | Có |
| NotificationsPanel | "Đang tải thông báo..." | "Chưa có thông báo nào" |

### **4. VẤN ĐỀ CẦN LƯU Ý**

1. **ReportsDashboard**: `getAllAttendance()` không dùng limit → có thể chậm khi dữ liệu lớn (AttendanceManagement dùng limit 500).
2. **EmployeeProfile**: Dùng `getAllUsers()` rồi `find` theo employeeId → nên thêm hàm `getUserById()` nếu cần tối ưu.
3. **ReportsDashboard**: Chưa có loading state riêng khi load dữ liệu.

---

**Tác giả:** AI Assistant  
**Phiên bản:** 1.2
