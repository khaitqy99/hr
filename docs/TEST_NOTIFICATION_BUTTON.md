# Nút Test Notification - Hướng dẫn sử dụng

## Mục đích

Nút **"🔔 Test Notification"** được thêm vào trang **Notifications** của nhân viên để:

1. ✅ Kiểm tra xem push notifications có hoạt động không
2. ✅ Yêu cầu quyền thông báo nếu chưa được cấp
3. ✅ Debug các vấn đề về notifications
4. ✅ Xác nhận Service Worker đã được cài đặt đúng

## Vị trí

Nút này xuất hiện ở **góc phải** của header trong trang **Notifications** (chỉ dành cho nhân viên).

📍 Đường dẫn: `/employee/notifications`

## Cách sử dụng

### Bước 1: Mở trang Notifications

1. Đăng nhập với tài khoản **nhân viên**
2. Click vào tab **"Thông báo"** ở bottom bar
3. Bạn sẽ thấy nút **"🔔 Test Notification"** ở góc phải trên cùng

### Bước 2: Click nút Test Notification

Khi click vào nút này, sẽ có 3 trường hợp:

#### Trường hợp 1: Quyền thông báo đã bị từ chối ❌

**Hiển thị:**
```
❌ Quyền thông báo đã bị từ chối.

Vui lòng:
1. Mở Settings trình duyệt
2. Tìm Notifications/Thông báo
3. Cho phép thông báo cho trang này
```

**Cách khắc phục:**

**Chrome:**
1. Click biểu tượng 🔒 bên trái URL bar
2. Tìm "Notifications"
3. Chọn "Allow"
4. Reload trang và thử lại

**Firefox:**
1. Click biểu tượng 🛡️ bên trái URL bar
2. Click "⚙️" → Permissions
3. Tìm "Receive Notifications"
4. Chọn "Allow"
5. Reload trang và thử lại

**Edge:**
1. Click biểu tượng 🔒 bên trái URL bar
2. Tìm "Notifications"
3. Chọn "Allow"
4. Reload trang và thử lại

#### Trường hợp 2: Chưa cấp quyền thông báo 🔔

**Hiển thị:**
- Popup của trình duyệt: "localhost wants to show notifications" (hoặc domain của bạn)
- Nút: **Allow** / **Block**

**Hành động:**
1. Click **Allow** để cấp quyền
2. Nếu cấp thành công → Chuyển sang Trường hợp 3
3. Nếu block → Quay lại Trường hợp 1

#### Trường hợp 3: Đã có quyền - Gửi test notification ✅

**Hiển thị alert:**
```
✅ Đã gửi test notification!

Nếu bạn thấy thông báo hiện lên, nghĩa là push notifications đang hoạt động bình thường.
```

**Kết quả mong đợi:**
- Một **push notification** hiện lên ở góc màn hình
- Tiêu đề: **"🎉 Test Notification"**
- Nội dung: **"Chúc mừng! Push notifications đang hoạt động tốt. Bạn sẽ nhận được thông báo từ admin."**

**Nếu thấy notification:**
- ✅ Push notifications **ĐANG HOẠT ĐỘNG**
- ✅ Bạn sẽ nhận được thông báo từ admin

**Nếu KHÔNG thấy notification:**
- ❌ Có vấn đề với Service Worker hoặc trình duyệt
- Xem phần **Troubleshooting** bên dưới

## Console Logs

### Khi click nút test thành công:

```
🔔 Đang yêu cầu quyền thông báo...    (nếu chưa có permission)
📨 Đang gửi test notification...
✅ [Push] Notification sent via Service Worker (mobile optimized)
```

### Nếu có lỗi:

```
❌ Lỗi test notification: <error message>
```

## Troubleshooting

### Vấn đề: Không thấy notification sau khi click nút

#### Kiểm tra 1: Service Worker có đang active không?

1. Mở DevTools (F12)
2. Tab **Application** → **Service Workers**
3. Kiểm tra xem có "sw.js" không
4. Status phải là **"activated"**

**Nếu không có hoặc status là "redundant":**
- Reload trang (Ctrl+Shift+R / Cmd+Shift+R)
- Xóa cache và reload lại

#### Kiểm tra 2: Notification permission

```javascript
// Paste vào Console (F12)
console.log('Permission:', Notification.permission);
// Kết quả mong đợi: "granted"
```

**Nếu là "denied":**
- Xem hướng dẫn ở Trường hợp 1

**Nếu là "default":**
- Click nút test lại để request permission

#### Kiểm tra 3: Trình duyệt có hỗ trợ không?

```javascript
// Paste vào Console (F12)
console.log('Service Worker:', 'serviceWorker' in navigator);
console.log('Notifications:', 'Notification' in window);
// Cả 2 phải là true
```

**Nếu false:**
- Update trình duyệt lên version mới nhất
- Dùng Chrome/Firefox/Edge (Safari cũ không hỗ trợ tốt)

#### Kiểm tra 4: HTTPS/Localhost

Push notifications CHỈ hoạt động trên:
- ✅ `https://` (production)
- ✅ `localhost` hoặc `127.0.0.1` (development)
- ❌ `http://` (không hoạt động)

### Vấn đề: Nút test gửi thành công nhưng admin gửi không nhận được

Nếu nút test hoạt động OK nhưng khi admin gửi thông báo vẫn không nhận được:

#### Debug 1: Kiểm tra admin có gửi không

**Trong console của admin** sau khi gửi:
```
📨 Gửi push notification đến X nhân viên...
✅ Đã broadcast thông báo qua BroadcastChannel
✅ Đã gửi thông báo đến Service Worker
```

**Nếu không thấy logs này:**
- Admin panel có vấn đề, cần check code `NotificationsManagement.tsx`

#### Debug 2: Kiểm tra Service Worker nhận message

**Trong Service Worker console** (DevTools → Application → Service Workers):
```
📨 [SW] Nhận yêu cầu gửi notifications từ admin: [...]
✅ [SW] Đã gửi notification: <title>
```

**Nếu không thấy:**
- Service Worker không nhận được message từ admin
- Check xem Service Worker có đang active không

#### Debug 3: Kiểm tra BroadcastChannel

**Trong console của nhân viên**:
```
📨 [BC] Nhận thông báo từ BroadcastChannel: {...}
```

**Nếu không thấy:**
- BroadcastChannel không hoạt động (trình duyệt cũ?)
- Kiểm tra xem 2 tabs có cùng origin không

## Best Practices

### Khi nào nên dùng nút Test?

1. ✅ **Lần đầu** đăng nhập vào app (để cấp quyền)
2. ✅ **Sau khi cài PWA** trên mobile (Add to Home Screen)
3. ✅ **Khi nghi ngờ** không nhận được thông báo từ admin
4. ✅ **Sau khi update** trình duyệt/app
5. ✅ **Khi thay đổi** settings thông báo trong trình duyệt

### Tips cho Mobile

**Android (Chrome/Edge):**
- Install app như PWA (Add to Home Screen)
- Notifications hoạt động tốt nhất khi app được install

**iOS (Safari):**
- iOS 16.4+ hỗ trợ push notifications cho PWA
- **BẮT BUỘC** phải install app (Add to Home Screen)
- Notifications KHÔNG hoạt động nếu chỉ dùng Safari browser

## Tóm tắt

Nút **"🔔 Test Notification"** giúp bạn:

1. ✅ Kiểm tra nhanh push notifications có hoạt động không
2. ✅ Request permission nếu cần
3. ✅ Debug các vấn đề về notifications
4. ✅ Đảm bảo Service Worker đang hoạt động

**Nếu test notification hoạt động → Bạn SẼ nhận được thông báo từ admin!**

---

Nếu vẫn gặp vấn đề sau khi làm theo hướng dẫn, vui lòng liên hệ IT support với thông tin:
- Trình duyệt và version
- Screenshot của console logs (DevTools → Console)
- Screenshot của Service Worker status (DevTools → Application → Service Workers)
