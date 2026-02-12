# Hướng dẫn Test Push Notifications Admin → Employee

## ✅ Setup hoàn tất!

Hệ thống push notifications đã được cấu hình đầy đủ. Bây giờ hãy test xem admin gửi thông báo đến nhân viên có hoạt động không.

## 🧪 Các bước test

### Bước 1: Chuẩn bị 2 tabs/windows

**Tab 1: ADMIN**
1. Mở trình duyệt (Chrome/Firefox/Edge)
2. Đăng nhập với tài khoản **Admin**
3. Vào **Admin Panel → Notifications**

**Tab 2: EMPLOYEE**
1. Mở tab/window mới (hoặc dùng trình duyệt khác)
2. Đăng nhập với tài khoản **Nhân viên**
3. Vào tab **"Thông báo"**
4. **QUAN TRỌNG**: Click nút **"🔔 Test Notification"** và cho phép khi trình duyệt hỏi
5. Nếu thấy test notification hiện lên → OK, tiếp tục bước 2

### Bước 2: Mở DevTools Console (cả 2 tabs)

**Để xem logs debug:**

1. Nhấn `F12` (hoặc `Ctrl+Shift+I` / `Cmd+Option+I`)
2. Chọn tab **Console**
3. Giữ console mở trong suốt quá trình test

### Bước 3: Admin gửi thông báo

**Ở tab ADMIN:**

1. Vào **Admin → Notifications**
2. Click **"+ Gửi thông báo"**
3. Điền form:
   - **Gửi đến**: Chọn nhân viên cụ thể (employee đang test)
   - **Loại thông báo**: Info
   - **Tiêu đề**: "Test từ Admin"
   - **Nội dung**: "Đây là test notification từ admin"
4. Click **"Gửi thông báo"**

**Xem console của Admin**, sẽ thấy:
```
📋 [Admin] Danh sách nhân viên sẽ nhận thông báo: [{id: "...", name: "...", email: "..."}]
💾 [Admin] Đang tạo notification cho: Tên NV (email@example.com)
✅ [Admin] Đã lưu notification vào database: {id: "...", userId: "...", title: "Test từ Admin", ...}
✅ [Admin] Đã tạo 1 notifications trong database
📨 Gửi push notification đến 1 nhân viên...
✅ Đã broadcast thông báo qua BroadcastChannel
✅ Đã gửi thông báo đến Service Worker
```

### Bước 4: Employee nhận thông báo

**Chuyển sang tab EMPLOYEE**, xem console:

```
📨 [Realtime] Nhận notification mới từ database: {title: "Test từ Admin", message: "Đây là test notification từ admin", ...}
🔔 [Realtime] Notification permission: granted
📤 [Realtime] Đang gửi push notification...
✅ [Realtime] Đã gửi push notification thành công!
✅ [Push] Notification sent via Service Worker (mobile optimized)
```

**Kết quả mong đợi:**
1. ✅ **Push notification hiện lên** ở góc màn hình
2. ✅ **Tiêu đề**: "Test từ Admin"
3. ✅ **Nội dung**: "Đây là test notification từ admin"
4. ✅ Notification xuất hiện trong **danh sách thông báo** của employee

## 📊 Debug flow hoàn chỉnh

### Luồng hoạt động

```
ADMIN                          SUPABASE                        EMPLOYEE
  |                                |                               |
  |--[1. Create notification]----->|                               |
  |                                |                               |
  |                                |--[2. Database INSERT]-------->|
  |                                |                               |
  |                                |                               |--[3. Realtime trigger]
  |                                |                               |
  |                                |                               |--[4. Check permission]
  |                                |                               |
  |                                |                               |--[5. Send push notification]
  |                                |                               |
  |                                |                               |--[6. Show notification ✅]
```

### Console logs theo từng bước

| Bước | Tab | Console Log |
|------|-----|-------------|
| 1 | Admin | `📋 [Admin] Danh sách nhân viên sẽ nhận thông báo` |
| 2 | Admin | `💾 [Admin] Đang tạo notification cho: ...` |
| 3 | Admin | `✅ [Admin] Đã lưu notification vào database` |
| 4 | Employee | `📨 [Realtime] Nhận notification mới từ database` |
| 5 | Employee | `🔔 [Realtime] Notification permission: granted` |
| 6 | Employee | `📤 [Realtime] Đang gửi push notification...` |
| 7 | Employee | `✅ [Realtime] Đã gửi push notification thành công!` |

## ❌ Troubleshooting

### Vấn đề 1: Employee không thấy logs trong console

**Nguyên nhân**: Supabase Realtime chưa kết nối

**Kiểm tra**: Sau khi employee mở tab Notifications, trong console phải thấy:
```
🔌 [Notifications] Đăng ký Supabase Realtime cho user: <user_id>
📡 [Realtime] Channel subscription status: SUBSCRIBED
```

**Nếu không thấy**:
1. Reload trang employee
2. Kiểm tra kết nối internet
3. Kiểm tra Supabase URL và Key trong `.env`

### Vấn đề 2: Thấy logs nhưng không có push notification

**Kiểm tra permission trong console employee**:
```javascript
console.log(Notification.permission);
// Phải là "granted"
```

**Nếu không phải "granted"**:
1. Click nút "🔔 Test Notification"
2. Cho phép khi trình duyệt hỏi
3. Test lại

### Vấn đề 3: Console employee hiển thị warning

```
⚠️ [Realtime] Không có quyền notification, không thể gửi push notification
💡 [Realtime] Vui lòng click nút "Test Notification" để cấp quyền
```

**Giải pháp**: Click nút "🔔 Test Notification" và cho phép

### Vấn đề 4: Admin console không có logs

**Nguyên nhân**: Code không được update hoặc cache

**Giải pháp**:
1. Hard reload admin page: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)
2. Xóa cache: `Ctrl+Shift+Delete` → Clear cache
3. Reload lại trang

### Vấn đề 5: Notification xuất hiện nhiều lần

**Nguyên nhân**: Bình thường! Có nhiều channels gửi:
- Supabase Realtime
- BroadcastChannel (nếu cùng origin)
- Service Worker

**Giải pháp**: Không cần sửa, trình duyệt sẽ merge notifications có cùng `tag`

## ✅ Test scenarios khác

### Test 2: Gửi đến tất cả nhân viên

1. Admin: Chọn **"Gửi đến" → "Tất cả nhân viên"**
2. Điền tiêu đề và nội dung
3. Gửi
4. **Tất cả nhân viên đang online** sẽ nhận được notification

### Test 3: Gửi đến 1 phòng ban

1. Admin: Chọn **"Gửi đến" → "Tất cả nhân viên"**
2. Chọn **Phòng ban** cụ thể
3. Gửi
4. **Tất cả nhân viên trong phòng ban đó** sẽ nhận được

### Test 4: Các loại thông báo khác nhau

Test với các loại:
- ✅ **Success** (màu xanh lá)
- ℹ️ **Info** (màu xanh dương) 
- ⚠️ **Warning** (màu vàng)
- ❌ **Error** (màu đỏ)

## 📱 Test trên Mobile

### Android (Chrome/Edge)

1. Install app: Menu → "Add to Home Screen"
2. Mở app từ home screen
3. Vào tab Notifications
4. Click "🔔 Test Notification" và cho phép
5. **Đóng app hoàn toàn** (swipe away)
6. Admin gửi notification từ máy tính
7. **Notification sẽ hiện trên thanh notification của Android**

### iOS (Safari - iOS 16.4+)

1. **BẮT BUỘC**: Add to Home Screen
   - Safari → Share → "Add to Home Screen"
2. Mở app từ home screen (KHÔNG dùng Safari)
3. Vào tab Notifications
4. Click "🔔 Test Notification" và cho phép
5. Admin gửi notification
6. **Notification sẽ hiện trên thanh notification của iOS**

**Lưu ý iOS**: Push notifications CHỈ hoạt động khi app được install như PWA, KHÔNG hoạt động trong Safari browser thông thường.

## 🎯 Kết luận

Nếu test thành công:
- ✅ Admin gửi notification → Console admin hiển thị logs
- ✅ Employee nhận notification → Console employee hiển thị logs
- ✅ Push notification hiện lên ở góc màn hình
- ✅ Notification xuất hiện trong danh sách

→ **Hệ thống hoạt động bình thường!** 🎉

Nếu vẫn có vấn đề, cung cấp:
1. Screenshot console của Admin
2. Screenshot console của Employee
3. Thông tin trình duyệt và version
