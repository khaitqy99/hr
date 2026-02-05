# Phân tích Liên kết Dữ liệu giữa các Tab Admin Panel

**Ngày tạo:** 2026-02-05  
**Mục đích:** Kiểm tra và phân tích mức độ liên kết dữ liệu giữa các tab trong Admin Panel

---

## Tổng quan các Tab

### Tab Quản lý (Main)
1. **USERS** - Quản lý nhân viên
2. **ATTENDANCE** - Quản lý chấm công
3. **LEAVE** - Quản lý nghỉ phép
4. **SHIFT** - Quản lý đăng ký ca
5. **PAYROLL** - Quản lý bảng lương
6. **REPORTS** - Thống kê tổng quan

### Tab Cấu hình (Config)
7. **DEPARTMENTS** - Quản lý phòng ban
8. **HOLIDAYS** - Quản lý ngày lễ
9. **CONFIG** - Cấu hình hệ thống
10. **NOTIFICATIONS** - Quản lý thông báo
11. **EXPORT** - Xuất/Nhập dữ liệu
12. **SETTINGS** - Thông tin hệ thống

---

## Phân tích Chi tiết từng Tab

### 1. USERS (UsersManagement)
**Dữ liệu sử dụng:**
- `getAllUsers()` - Danh sách nhân viên
- `getDepartments()` - Danh sách phòng ban (để dropdown)

**Liên kết với các tab khác:**
- ✅ **DEPARTMENTS**: Sử dụng dropdown phòng ban từ bảng departments
- ✅ **ATTENDANCE**: Hiển thị tên nhân viên trong bảng chấm công
- ✅ **LEAVE**: Hiển thị tên nhân viên trong đơn nghỉ phép
- ✅ **SHIFT**: Hiển thị tên nhân viên trong đăng ký ca
- ✅ **PAYROLL**: Hiển thị tên nhân viên trong bảng lương
- ✅ **REPORTS**: Thống kê số lượng nhân viên
- ✅ **NOTIFICATIONS**: Dropdown chọn nhân viên để gửi thông báo
- ✅ **EXPORT**: Filter theo nhân viên khi export

**Trạng thái:** ✅ Đã liên kết tốt

---

### 2. ATTENDANCE (AttendanceManagement)
**Dữ liệu sử dụng:**
- `getAllAttendance()` - Lịch sử chấm công
- `getAllUsers()` - Danh sách nhân viên (để hiển thị tên)

**Liên kết với các tab khác:**
- ✅ **USERS**: Hiển thị tên nhân viên từ bảng users
- ✅ **REPORTS**: Thống kê chấm công hôm nay
- ✅ **PAYROLL**: Được sử dụng để tính ngày công thực tế (qua `calculateAttendanceStats`)
- ✅ **EXPORT**: Có thể export với filter theo nhân viên và thời gian

**Trạng thái:** ✅ Đã liên kết tốt

**Lưu ý:** PayrollManagement chỉ hiển thị dữ liệu payroll đã tính, không tự động tính từ attendance. Việc tính toán được thực hiện trong SalaryManagement component (employee view).

---

### 3. LEAVE (LeaveManagement)
**Dữ liệu sử dụng:**
- `getLeaveRequests()` - Danh sách đơn nghỉ phép
- `getAllUsers()` - Danh sách nhân viên (để hiển thị tên)

**Liên kết với các tab khác:**
- ✅ **USERS**: Hiển thị tên nhân viên từ bảng users
- ✅ **REPORTS**: Thống kê số đơn nghỉ phép chờ duyệt
- ⚠️ **PAYROLL**: Có thể được sử dụng để tính ngày nghỉ (nhưng chưa thấy tích hợp trực tiếp)
- ✅ **EXPORT**: Có thể export với filter theo nhân viên và thời gian

**Trạng thái:** ✅ Đã liên kết tốt

**Cải thiện đề xuất:** 
- Payroll có thể tính ngày nghỉ từ leave requests để trừ vào ngày công

---

### 4. SHIFT (ShiftManagement)
**Dữ liệu sử dụng:**
- `getShiftRegistrations()` - Danh sách đăng ký ca
- `getAllUsers()` - Danh sách nhân viên
- `getHolidays()` - Danh sách ngày lễ (để highlight)
- `getDepartments()` - Danh sách phòng ban (để filter)

**Liên kết với các tab khác:**
- ✅ **USERS**: Hiển thị tên nhân viên từ bảng users
- ✅ **HOLIDAYS**: Highlight ngày lễ trong calendar, hiển thị tên ngày lễ
- ✅ **DEPARTMENTS**: Filter theo phòng ban
- ✅ **REPORTS**: Thống kê số đăng ký ca chờ duyệt
- ⚠️ **PAYROLL**: Có thể được sử dụng để tính ca làm việc (nhưng chưa thấy tích hợp trực tiếp)
- ✅ **EXPORT**: Có thể export với filter theo nhân viên, phòng ban và thời gian

**Trạng thái:** ✅ Đã liên kết tốt

**Cải thiện đề xuất:**
- Payroll có thể tính ca làm việc từ shift registrations

---

### 5. PAYROLL (PayrollManagement)
**Dữ liệu sử dụng:**
- `getAllPayrolls()` - Danh sách bảng lương theo tháng
- `getAllUsers()` - Danh sách nhân viên (để hiển thị tên)

**Liên kết với các tab khác:**
- ✅ **USERS**: Hiển thị tên nhân viên từ bảng users
- ⚠️ **ATTENDANCE**: Dữ liệu attendance được sử dụng để tính payroll (qua `calculateAttendanceStats`), nhưng chỉ trong SalaryManagement component, không phải trong PayrollManagement
- ⚠️ **LEAVE**: Chưa tích hợp trực tiếp để tính ngày nghỉ
- ⚠️ **SHIFT**: Chưa tích hợp trực tiếp để tính ca làm việc
- ✅ **EXPORT**: Có thể export với filter theo nhân viên và chọn tháng

**Trạng thái:** ⚠️ Liên kết một phần

**Vấn đề phát hiện:**
- PayrollManagement chỉ hiển thị dữ liệu payroll đã được tính toán trước đó
- Không có chức năng tự động tính toán payroll từ attendance/leave/shift trong admin panel
- Việc tính toán được thực hiện trong SalaryManagement (employee view), không phải admin view

**Cải thiện đề xuất:**
- Thêm nút "Tính lại lương" trong PayrollManagement để tự động tính từ attendance/leave/shift
- Tích hợp tính ngày nghỉ từ leave requests
- Tích hợp tính ca làm việc từ shift registrations

---

### 6. REPORTS (ReportsDashboard)
**Dữ liệu sử dụng:**
- `getAllUsers()` - Danh sách nhân viên
- `getLeaveRequests()` - Đơn nghỉ phép
- `getShiftRegistrations()` - Đăng ký ca
- `getAllAttendance()` - Lịch sử chấm công

**Liên kết với các tab khác:**
- ✅ **USERS**: Thống kê số lượng nhân viên, nhân viên đang làm việc
- ✅ **ATTENDANCE**: Thống kê chấm công hôm nay
- ✅ **LEAVE**: Thống kê đơn nghỉ phép chờ duyệt
- ✅ **SHIFT**: Thống kê đăng ký ca chờ duyệt
- ⚠️ **DEPARTMENTS**: Thống kê theo phòng ban nhưng dùng `Array.from(new Set(employees.map(e => e.department)))` thay vì lấy từ bảng departments

**Trạng thái:** ✅ Đã liên kết tốt

**Cải thiện đề xuất:**
- ReportsDashboard nên sử dụng `getDepartments()` để lấy danh sách phòng ban chính thức thay vì derive từ employees

---

### 7. DEPARTMENTS (DepartmentsManagement)
**Dữ liệu sử dụng:**
- `getDepartments()` - Danh sách phòng ban
- `getAllUsers()` - Danh sách nhân viên (để hiển thị số lượng nhân viên trong mỗi phòng ban)

**Liên kết với các tab khác:**
- ✅ **USERS**: Dropdown phòng ban trong form thêm/sửa nhân viên
- ✅ **SHIFT**: Filter theo phòng ban
- ✅ **EXPORT**: Filter theo phòng ban khi export
- ✅ **EMPLOYEE_PROFILE**: Dropdown phòng ban trong form sửa profile
- ⚠️ **REPORTS**: Chưa sử dụng bảng departments, chỉ derive từ employees

**Trạng thái:** ✅ Đã liên kết tốt

**Cải thiện đề xuất:**
- ReportsDashboard nên sử dụng `getDepartments()` để đảm bảo consistency

---

### 8. HOLIDAYS (HolidaysManagement)
**Dữ liệu sử dụng:**
- `getHolidays()` - Danh sách ngày lễ
- `createHoliday()`, `updateHoliday()`, `deleteHoliday()` - CRUD operations

**Liên kết với các tab khác:**
- ✅ **SHIFT**: Highlight ngày lễ trong calendar, hiển thị tên ngày lễ, tự động set OFF khi chọn ngày lễ
- ✅ **SHIFT_REGISTER** (employee view): Cảnh báo khi chọn ngày lễ, tự động set nghỉ lễ
- ✅ **EXPORT**: Có thể export holidays (nếu cần)

**Trạng thái:** ✅ Đã liên kết tốt

---

### 9. CONFIG (SystemConfigManagement)
**Dữ liệu sử dụng:**
- `getSystemConfigs()` - Danh sách cấu hình hệ thống
- `updateSystemConfig()` - Cập nhật cấu hình

**Liên kết với các tab khác:**
- ✅ **CHECK_IN** (employee view): Sử dụng `getOfficeLocation()` để lấy vị trí văn phòng và bán kính
- ✅ **PAYROLL**: Sử dụng các config như `standard_work_days`, `social_insurance_rate`, `overtime_rate`, `work_hours_per_day` để tính lương
- ✅ **SETTINGS**: Hiển thị các giá trị config hiện tại
- ✅ **ATTENDANCE**: Sử dụng `work_hours_per_day` để tính ngày công

**Trạng thái:** ✅ Đã liên kết tốt

---

### 10. NOTIFICATIONS (NotificationsManagement)
**Dữ liệu sử dụng:**
- `getAllNotifications()` - Danh sách thông báo
- `getAllUsers()` - Danh sách nhân viên (để dropdown chọn người nhận)
- `createNotification()`, `deleteNotification()` - CRUD operations

**Liên kết với các tab khác:**
- ✅ **USERS**: Dropdown chọn nhân viên để gửi thông báo
- ⚠️ **DEPARTMENTS**: Chưa có filter theo phòng ban khi gửi thông báo

**Trạng thái:** ✅ Đã liên kết tốt

**Cải thiện đề xuất:**
- Thêm tùy chọn gửi thông báo đến tất cả nhân viên trong một phòng ban

---

### 11. EXPORT (DataExportManagement)
**Dữ liệu sử dụng:**
- `getAllUsers()`, `getAllAttendance()`, `getLeaveRequests()`, `getShiftRegistrations()`, `getAllPayrolls()`, `getDepartments()` - Tất cả dữ liệu để export

**Liên kết với các tab khác:**
- ✅ **TẤT CẢ CÁC TAB**: Có thể export dữ liệu từ mọi tab với filter linh hoạt
- ✅ **USERS**: Filter theo phòng ban và nhân viên
- ✅ **ATTENDANCE**: Filter theo thời gian, phòng ban, nhân viên
- ✅ **LEAVE**: Filter theo thời gian, phòng ban, nhân viên
- ✅ **SHIFT**: Filter theo thời gian, phòng ban, nhân viên
- ✅ **PAYROLL**: Chọn tháng để export

**Trạng thái:** ✅ Đã liên kết tốt

---

### 12. SETTINGS (SettingsPanel)
**Dữ liệu sử dụng:**
- `getAllUsers()`, `getAllAttendance()`, `getLeaveRequests()`, `getShiftRegistrations()` - Thống kê tổng quan
- `getSystemConfigs()` - Hiển thị cấu hình hệ thống

**Liên kết với các tab khác:**
- ✅ **TẤT CẢ CÁC TAB**: Hiển thị thống kê tổng quan từ tất cả các tab
- ✅ **CONFIG**: Hiển thị giá trị config hiện tại

**Trạng thái:** ✅ Đã liên kết tốt

---

## Tổng kết Liên kết Dữ liệu

### ✅ Đã liên kết tốt:
1. **USERS** ↔ **DEPARTMENTS**: Dropdown phòng ban
2. **SHIFT** ↔ **HOLIDAYS**: Highlight và tự động set nghỉ lễ
3. **CONFIG** ↔ **CHECK_IN/PAYROLL/ATTENDANCE**: Sử dụng config để tính toán
4. **EXPORT** ↔ **TẤT CẢ**: Export với filter linh hoạt
5. **REPORTS/SETTINGS** ↔ **TẤT CẢ**: Thống kê tổng quan

### ⚠️ Liên kết một phần (cần cải thiện):

#### 1. PAYROLL không tự động tính từ Attendance/Leave/Shift
**Vấn đề:**
- PayrollManagement chỉ hiển thị dữ liệu payroll đã tính
- Không có chức năng tự động tính lại từ attendance/leave/shift trong admin panel
- Việc tính toán được thực hiện trong SalaryManagement (employee view)

**Đề xuất:**
- Thêm nút "Tính lại lương" trong PayrollManagement
- Tự động tính từ attendance (ngày công, OT)
- Tự động tính từ leave requests (ngày nghỉ)
- Tự động tính từ shift registrations (ca làm việc)

#### 2. REPORTS không sử dụng bảng Departments
**Vấn đề:**
- ReportsDashboard derive phòng ban từ `employees.map(e => e.department)` thay vì dùng `getDepartments()`
- Có thể không nhất quán nếu có phòng ban không có nhân viên

**Đề xuất:**
- Sử dụng `getDepartments()` để lấy danh sách phòng ban chính thức
- Hiển thị cả phòng ban không có nhân viên (với số lượng 0)

#### 3. NOTIFICATIONS không có filter theo phòng ban
**Vấn đề:**
- Chỉ có thể gửi đến tất cả nhân viên hoặc một nhân viên cụ thể
- Không thể gửi đến tất cả nhân viên trong một phòng ban

**Đề xuất:**
- Thêm tùy chọn "Gửi đến phòng ban" trong form gửi thông báo
- Dropdown chọn phòng ban từ `getDepartments()`

#### 4. LEAVE/SHIFT chưa tích hợp vào PAYROLL
**Vấn đề:**
- Payroll chỉ tính từ attendance
- Chưa trừ ngày nghỉ từ leave requests
- Chưa tính ca làm việc từ shift registrations

**Đề xuất:**
- Tích hợp leave requests để tính ngày nghỉ
- Tích hợp shift registrations để tính ca làm việc

---

## Đề xuất Ưu tiên

### 🔴 Ưu tiên cao:
1. **Cải thiện PayrollManagement**: Thêm chức năng tự động tính lại lương từ attendance/leave/shift
2. **Cải thiện ReportsDashboard**: Sử dụng `getDepartments()` thay vì derive từ employees

### 🟡 Ưu tiên trung bình:
3. **Cải thiện NotificationsManagement**: Thêm filter theo phòng ban
4. **Tích hợp Leave/Shift vào Payroll**: Tính ngày nghỉ và ca làm việc

### 🟢 Ưu tiên thấp:
5. Các cải thiện nhỏ khác để tăng tính nhất quán

---

## Kết luận

**Tổng thể:** Hệ thống đã có liên kết dữ liệu khá tốt giữa các tab. Hầu hết các tab đều sử dụng dữ liệu từ các tab khác một cách hợp lý.

**Điểm mạnh:**
- Liên kết tốt giữa USERS ↔ DEPARTMENTS
- Liên kết tốt giữa SHIFT ↔ HOLIDAYS
- Liên kết tốt giữa CONFIG với các tính năng tính toán
- Export có filter linh hoạt

**Điểm cần cải thiện:**
- PayrollManagement cần tự động tính từ attendance/leave/shift
- ReportsDashboard nên sử dụng bảng departments
- NotificationsManagement nên có filter theo phòng ban

**Đánh giá tổng thể:** ⭐⭐⭐⭐ (4/5) - Tốt, nhưng còn một số điểm cần cải thiện
