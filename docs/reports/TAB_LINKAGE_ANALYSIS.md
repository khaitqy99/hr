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

#### **2. Payroll → Dashboard & Shifts**
- ✅ **Payroll → Dashboard**: Có link "Xem chi tiết →" trong phần "Ngày công từ chấm công"
- ✅ **Payroll → Shifts**: Có link "Xem chi tiết →" trong phần "Ca làm việc đã đăng ký"

**Dữ liệu được chia sẻ:**
- Payroll sử dụng:
  - `calculateAttendanceStats(user.id, month)` - Tính ngày công từ chấm công
  - `calculateLeaveDays(user.id, month)` - Tính ngày nghỉ
  - `getShiftRegistrations(user.id)` - Lấy ca đăng ký để tính số ngày làm việc

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
         ↓
Payroll → calculateAttendanceStats() → Tính ngày công
         ↓
PayrollManagement → getAllPayrolls() → Hiển thị bảng lương
```

### **2. Luồng Đăng Ký Ca**
```
ShiftRegister → registerShift() → shift_registrations (DB)
             ↓
CheckIn → getShiftRegistrations() → Tính trạng thái ON_TIME/LATE
         ↓
Dashboard → getShiftRegistrations() → Hiển thị ca hôm nay
         ↓
Payroll → getShiftRegistrations() → Tính số ngày làm việc
         ↓
ShiftManagement → getShiftRegistrations() → Quản lý đăng ký ca
```

### **3. Luồng Tính Lương**
```
PayrollManagement → calculatePayroll() 
                 ↓
                 → calculateAttendanceStats() → Ngày công
                 → calculateLeaveDays() → Ngày nghỉ
                 → getShiftRegistrations() → Ca làm việc
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

**Tác giả:** AI Assistant  
**Phiên bản:** 1.0
