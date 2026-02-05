# Phân tích Liên kết Dữ liệu giữa các Tab Nhân viên (Employee View)

**Ngày tạo:** 2026-02-05  
**Mục đích:** Kiểm tra và phân tích mức độ liên kết dữ liệu giữa các tab trong Employee View

---

## Tổng quan các Tab Nhân viên

1. **DASHBOARD** - Trang tổng quan
2. **CHECKIN** - Chấm công
3. **SHIFTS** - Đăng ký ca
4. **PAYROLL** - Xem bảng lương
5. **NOTIFICATIONS** - Thông báo

---

## Phân tích Chi tiết từng Tab

### 1. DASHBOARD (Dashboard.tsx)
**Dữ liệu sử dụng:**
- `getAttendance(user.id)` - Lịch sử chấm công của nhân viên

**Chức năng:**
- Hiển thị giờ vào/ra hôm nay
- Hiển thị giờ làm hôm nay
- Tính tổng giờ làm tuần này
- Tính tỷ lệ đúng giờ
- Biểu đồ giờ làm 5 ngày gần nhất
- Nhật ký chấm công

**Liên kết với các tab khác:**
- ✅ **CHECKIN**: Dữ liệu attendance được cập nhật từ CheckIn
- ⚠️ **SHIFTS**: Không hiển thị thông tin về ca đăng ký hôm nay
- ⚠️ **PAYROLL**: Không có link hoặc thông tin về lương
- ❌ **NOTIFICATIONS**: Không hiển thị số thông báo chưa đọc
- ❌ **LEAVE**: Không có tab nghỉ phép trong employee view

**Trạng thái:** ⚠️ Liên kết một phần

**Vấn đề phát hiện:**
- Dashboard không hiển thị ca đăng ký hôm nay (nếu có)
- Dashboard không có link nhanh đến các tab khác
- Dashboard không hiển thị số thông báo chưa đọc
- Không có cách để xem đơn nghỉ phép từ employee view

**Cải thiện đề xuất:**
- Hiển thị ca đăng ký hôm nay từ ShiftRegister
- Thêm quick links đến các tab khác
- Hiển thị badge số thông báo chưa đọc
- Thêm tab hoặc section để xem đơn nghỉ phép

---

### 2. CHECKIN (CheckIn.tsx)
**Dữ liệu sử dụng:**
- `getShiftRegistrations(user.id)` - Lấy ca đăng ký để tính trạng thái
- `getOfficeLocation()` - Lấy vị trí văn phòng và bán kính
- `saveAttendance()` - Lưu chấm công
- `uploadAttendancePhoto()` - Upload ảnh chấm công

**Chức năng:**
- Chấm công vào/ra với GPS và camera
- Kiểm tra vị trí so với văn phòng
- Tính trạng thái dựa trên ca đăng ký (ON_TIME/LATE/EARLY_LEAVE/OVERTIME)
- Upload ảnh chấm công

**Liên kết với các tab khác:**
- ✅ **SHIFTS**: Sử dụng ca đăng ký để tính trạng thái chấm công
- ✅ **DASHBOARD**: Dữ liệu attendance được hiển thị trong Dashboard
- ✅ **CONFIG**: Sử dụng office location từ system config
- ⚠️ **PAYROLL**: Attendance được dùng để tính lương nhưng không hiển thị trong Payroll tab

**Trạng thái:** ✅ Đã liên kết tốt

**Cải thiện đề xuất:**
- Có thể hiển thị thông tin về ca đăng ký hôm nay trước khi chấm công
- Có thể hiển thị cảnh báo nếu chưa đăng ký ca

---

### 3. SHIFTS (ShiftRegister.tsx)
**Dữ liệu sử dụng:**
- `getShiftRegistrations(user.id)` - Lấy danh sách ca đã đăng ký
- `getHolidays()` - Lấy ngày lễ để cảnh báo
- `registerShift()` - Đăng ký ca mới

**Chức năng:**
- Đăng ký ca làm việc hoặc nghỉ
- Hiển thị calendar với các ca đã đăng ký
- Cảnh báo khi chọn ngày lễ
- Tự động set nghỉ lễ khi chọn ngày lễ

**Liên kết với các tab khác:**
- ✅ **CHECKIN**: Ca đăng ký được sử dụng để tính trạng thái chấm công
- ✅ **HOLIDAYS** (admin): Hiển thị và cảnh báo ngày lễ
- ⚠️ **DASHBOARD**: Không hiển thị ca đăng ký hôm nay
- ⚠️ **PAYROLL**: Ca đăng ký có thể được dùng để tính lương nhưng không hiển thị

**Trạng thái:** ✅ Đã liên kết tốt

**Cải thiện đề xuất:**
- Dashboard có thể hiển thị ca đăng ký hôm nay
- Payroll có thể hiển thị chi tiết về ca làm việc

---

### 4. PAYROLL (Payroll.tsx)
**Dữ liệu sử dụng:**
- `getPayroll(user.id, month)` - Lấy dữ liệu lương theo tháng

**Chức năng:**
- Hiển thị bảng lương theo tháng
- Hiển thị chi tiết các khoản thu/chi
- Biểu đồ phân bổ lương

**Liên kết với các tab khác:**
- ⚠️ **ATTENDANCE**: Lương được tính từ attendance nhưng không hiển thị chi tiết
- ⚠️ **SHIFTS**: Ca làm việc có thể ảnh hưởng đến lương nhưng không hiển thị
- ⚠️ **LEAVE**: Ngày nghỉ được trừ vào lương nhưng không hiển thị
- ❌ **DASHBOARD**: Không có link hoặc preview lương

**Trạng thái:** ⚠️ Liên kết một phần

**Vấn đề phát hiện:**
- Payroll chỉ hiển thị kết quả cuối cùng, không hiển thị cách tính
- Không hiển thị chi tiết về ngày công tính từ attendance
- Không hiển thị ngày nghỉ từ leave requests
- Không hiển thị ca làm việc từ shift registrations

**Cải thiện đề xuất:**
- Thêm section "Chi tiết tính lương" hiển thị:
  - Ngày công từ attendance
  - Ngày nghỉ từ leave requests
  - Ca làm việc từ shift registrations
  - Giờ OT từ attendance
- Thêm link đến Dashboard để xem chi tiết attendance
- Thêm link đến Shifts để xem ca đăng ký

---

### 5. NOTIFICATIONS (NotificationsPanel.tsx)
**Dữ liệu sử dụng:**
- `getNotifications(user.id)` - Lấy thông báo của nhân viên
- `markNotificationAsRead()` - Đánh dấu đã đọc

**Chức năng:**
- Hiển thị danh sách thông báo
- Đánh dấu đã đọc
- Phân loại theo loại (info/warning/success/error)

**Liên kết với các tab khác:**
- ❌ **DASHBOARD**: Không hiển thị badge số thông báo chưa đọc
- ❌ **TẤT CẢ**: Không có thông báo liên quan đến các tab khác (ví dụ: thông báo khi có đơn nghỉ phép được duyệt)

**Trạng thái:** ⚠️ Liên kết một phần

**Cải thiện đề xuất:**
- Dashboard nên hiển thị badge số thông báo chưa đọc
- Thêm thông báo khi:
  - Đơn nghỉ phép được duyệt/từ chối
  - Đăng ký ca được duyệt/từ chối
  - Có bảng lương mới
  - Có thay đổi về ca làm việc

---

## Tổng kết Liên kết Dữ liệu

### ✅ Đã liên kết tốt:
1. **CHECKIN** ↔ **SHIFTS**: Sử dụng ca đăng ký để tính trạng thái chấm công
2. **CHECKIN** ↔ **DASHBOARD**: Dữ liệu attendance được hiển thị trong Dashboard
3. **SHIFTS** ↔ **HOLIDAYS**: Cảnh báo và tự động set nghỉ lễ

### ⚠️ Liên kết một phần (cần cải thiện):

#### 1. Dashboard không hiển thị đầy đủ thông tin
**Vấn đề:**
- Không hiển thị ca đăng ký hôm nay
- Không có link nhanh đến các tab khác
- Không hiển thị số thông báo chưa đọc

**Đề xuất:**
- Thêm section hiển thị ca đăng ký hôm nay từ ShiftRegister
- Thêm quick links đến các tab khác
- Thêm badge số thông báo chưa đọc

#### 2. Payroll không hiển thị chi tiết tính lương
**Vấn đề:**
- Chỉ hiển thị kết quả cuối cùng
- Không hiển thị cách tính từ attendance/shift/leave
- Không có link đến các tab liên quan

**Đề xuất:**
- Thêm section "Chi tiết tính lương" với:
  - Ngày công từ attendance
  - Ngày nghỉ từ leave requests
  - Ca làm việc từ shift registrations
  - Giờ OT từ attendance
- Thêm links đến Dashboard và Shifts

#### 3. Notifications không tích hợp với các tab khác
**Vấn đề:**
- Dashboard không hiển thị badge số thông báo chưa đọc
- Không có thông báo liên quan đến các tab khác

**Đề xuất:**
- Dashboard hiển thị badge số thông báo chưa đọc
- Thêm thông báo khi có sự kiện liên quan đến các tab khác

#### 4. Không có tab Leave trong Employee View
**Vấn đề:**
- Nhân viên không thể xem đơn nghỉ phép của mình
- Không thể tạo đơn nghỉ phép từ employee view

**Đề xuất:**
- Thêm tab "Nghỉ phép" trong employee view
- Cho phép nhân viên xem và tạo đơn nghỉ phép
- Hiển thị trạng thái đơn nghỉ phép

---

## Đề xuất Ưu tiên

### 🔴 Ưu tiên cao:
1. **Dashboard**: Thêm hiển thị ca đăng ký hôm nay và badge thông báo
2. **Payroll**: Thêm section chi tiết tính lương từ attendance/shift/leave
3. **Thêm tab Leave**: Cho phép nhân viên xem và tạo đơn nghỉ phép

### 🟡 Ưu tiên trung bình:
4. **Dashboard**: Thêm quick links đến các tab khác
5. **Notifications**: Thêm thông báo liên quan đến các tab khác
6. **Payroll**: Thêm links đến Dashboard và Shifts

### 🟢 Ưu tiên thấp:
7. Các cải thiện nhỏ khác để tăng tính nhất quán

---

## Kết luận

**Tổng thể:** Employee view có liên kết dữ liệu cơ bản nhưng còn thiếu một số tích hợp quan trọng.

**Điểm mạnh:**
- Liên kết tốt giữa CHECKIN ↔ SHIFTS
- Liên kết tốt giữa CHECKIN ↔ DASHBOARD
- Liên kết tốt giữa SHIFTS ↔ HOLIDAYS

**Điểm cần cải thiện:**
- Dashboard không hiển thị đầy đủ thông tin (ca đăng ký, thông báo)
- Payroll không hiển thị chi tiết tính lương
- Không có tab Leave trong employee view
- Notifications không tích hợp với các tab khác

**Đánh giá tổng thể:** ⭐⭐⭐ (3/5) - Tốt cơ bản, nhưng cần cải thiện tích hợp
