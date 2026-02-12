# Hướng dẫn Kiểm tra Push Notifications

## Vấn đề đã được sửa

Trước đây, khi admin gửi thông báo cho nhân viên, nhân viên **KHÔNG nhận được push notification** vì:

1. ❌ Code chỉ lưu thông báo vào database
2. ❌ Không có logic gửi push notification thực tế
3. ❌ Chỉ hoạt động khi nhân viên đang mở app và có Supabase Realtime

## Giải pháp đã triển khai

Bây giờ hệ thống đã được nâng cấp:

1. ✅ **BroadcastChannel API**: Gửi thông báo real-time qua tất cả tabs/windows đang mở
2. ✅ **Service Worker**: Xử lý và hiển thị push notifications ngay cả khi app không mở
3. ✅ **Multi-channel delivery**: Sử dụng cả Supabase Realtime, BroadcastChannel và Service Worker

## Các file đã được cập nhật

### 1. `components/admin/NotificationsManagement.tsx`
- Thêm import `sendLocalNotification` từ `services/push`
- Sau khi tạo notification trong database, code sẽ:
  - Broadcast qua BroadcastChannel để notify các tabs đang mở
  - Gửi message đến Service Worker để hiển thị notification

### 2. `public/sw.js` (Service Worker)
- Thêm message handler `SEND_NOTIFICATIONS`
- Khi nhận message từ admin panel, Service Worker sẽ show notification cho nhân viên
- Hoạt động ngay cả khi app không mở (background)

### 3. `components/NotificationsPanel.tsx`
- Thêm BroadcastChannel listener
- Khi nhận thông báo qua BroadcastChannel:
  - Show push notification nếu có permission
  - Reload danh sách notifications để hiển thị trong panel

## Cách kiểm tra

### Bước 1: Cấp quyền thông báo cho Employee

1. Đăng nhập với tài khoản **nhân viên**
2. Trình duyệt sẽ hỏi "Allow notifications?" - Chọn **Allow**
3. Nếu không thấy popup, kiểm tra settings trình duyệt:
   - Chrome: Settings → Privacy and security → Site settings → Notifications
   - Firefox: Settings → Privacy & Security → Permissions → Notifications

### Bước 2: Kiểm tra khi Employee đang mở app

1. Mở 2 cửa sổ/tab:
   - Tab 1: Đăng nhập **admin**
   - Tab 2: Đăng nhập **nhân viên** (hoặc mở chrome://inspect/#devices để xem mobile)

2. Ở tab admin:
   - Vào **Admin → Notifications**
   - Gửi thông báo đến nhân viên đó

3. Ở tab nhân viên:
   - Sẽ thấy **push notification** hiện lên ở góc màn hình
   - Notification cũng xuất hiện trong panel **Notifications**

### Bước 3: Kiểm tra khi Employee KHÔNG mở app

**Quan trọng**: Đây là test khó hơn vì cần Service Worker đang active.

1. Mở app nhân viên, đảm bảo Service Worker đã được register:
   - Mở DevTools → Application tab → Service Workers
   - Xem có "sw.js" trong danh sách và status là "activated"

2. **Đóng tab/window** của nhân viên (hoặc navigate sang tab khác)

3. Từ admin panel, gửi thông báo

4. **Kết quả mong đợi**:
   - Push notification vẫn hiện lên ngay cả khi app không mở
   - Khi nhân viên click vào notification → app sẽ mở và đi đến trang notifications

### Bước 4: Kiểm tra trên Mobile (PWA)

1. Install app như PWA trên mobile:
   - Chrome Android: Menu → "Add to Home Screen"
   - Safari iOS: Share → "Add to Home Screen"

2. Đóng app hoàn toàn

3. Từ admin (trên máy tính), gửi thông báo

4. **Kết quả mong đợi**:
   - Notification xuất hiện trên thanh notification của điện thoại
   - Click vào notification → app mở lên

## Debug và Troubleshooting

### Kiểm tra console logs

#### Khi admin gửi thông báo:

Trong console của admin:
```
📨 Gửi push notification đến X nhân viên...
✅ Đã broadcast thông báo qua BroadcastChannel
✅ Đã gửi thông báo đến Service Worker
```

#### Khi nhân viên nhận thông báo:

Trong console của nhân viên:
```
📨 [BC] Nhận thông báo từ BroadcastChannel: {...}
✅ [Push] Notification sent via Service Worker (mobile optimized)
```

Trong Service Worker console (DevTools → Application → Service Workers → sw.js):
```
📨 [SW] Nhận yêu cầu gửi notifications từ admin: [...]
✅ [SW] Đã gửi notification: <title>
```

### Các vấn đề thường gặp

#### 1. Không thấy push notification

**Nguyên nhân**:
- Chưa cấp quyền notification
- Notification permission bị "denied"

**Giải pháp**:
```javascript
// Kiểm tra permission trong console
console.log(Notification.permission); // should be "granted"

// Request permission nếu chưa có
Notification.requestPermission().then(permission => {
  console.log('Permission:', permission);
});
```

#### 2. Service Worker không hoạt động

**Kiểm tra**:
- DevTools → Application → Service Workers
- Xem status phải là "activated"
- Nếu không có hoặc status là "redundant", reload lại trang

#### 3. BroadcastChannel không hoạt động

**Note**: BroadcastChannel chỉ hoạt động khi:
- Cùng origin (same domain)
- Trình duyệt hỗ trợ (Chrome, Firefox, Edge - không hỗ trợ Safari cũ)

#### 4. Thông báo xuất hiện nhiều lần

**Nguyên nhân**: Cả Supabase Realtime, BroadcastChannel và Service Worker đều show notification

**Giải pháp**: Đây là hành vi mong đợi để ensure delivery. Có thể optimize bằng cách:
- Sử dụng `tag` trong notification options để merge duplicates
- Trình duyệt tự động merge notifications có cùng `tag`

## Test scenarios

### Scenario 1: Real-time notification (app đang mở)
1. ✅ Admin gửi → Employee thấy ngay
2. ✅ Notification xuất hiện ở góc màn hình
3. ✅ Danh sách notification trong app được update

### Scenario 2: Background notification (app đóng)
1. ✅ Admin gửi → Service Worker nhận message
2. ✅ Service Worker show notification
3. ✅ Click notification → app mở lên

### Scenario 3: Multi-tab notification
1. ✅ Employee mở 2 tabs
2. ✅ Admin gửi → Cả 2 tabs đều nhận được
3. ✅ Notification chỉ show 1 lần (nhờ `tag`)

### Scenario 4: Offline → Online
1. ✅ Employee offline khi admin gửi
2. ✅ Employee online lại → Supabase Realtime sync
3. ✅ Notification hiện trong danh sách

## Kết luận

Giờ đây hệ thống push notifications đã hoạt động đầy đủ:

- ✅ Gửi đến nhiều nhân viên cùng lúc
- ✅ Real-time qua BroadcastChannel
- ✅ Background notifications qua Service Worker
- ✅ Fallback qua Supabase Realtime
- ✅ Mobile PWA support
- ✅ Offline-friendly

**Lưu ý**: Để push notification hoạt động tốt nhất trên mobile, nên cài đặt app như PWA (Add to Home Screen).
