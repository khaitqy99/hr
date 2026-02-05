# BÁO CÁO PHÂN TÍCH PWA CACHE VÀ ĐỘ TƯƠNG ĐỒNG APP NATIVE

**Ngày tạo:** 05/02/2026  
**Mục đích:** Đánh giá hiện trạng cache PWA và đề xuất cải thiện để đạt trải nghiệm gần app native 100%

---

## 📋 TỔNG QUAN HIỆN TRẠNG

### ✅ **ĐÃ CÓ – Hoạt động ổn**

| Hạng mục | Chi tiết |
|----------|----------|
| **Service Worker** | VitePWA injectManifest, Workbox 7.x |
| **Precache** | `**/*.{js,css,html,ico,png,svg,woff2}` – bundle build |
| **Navigation** | NetworkFirst (3s timeout) → fallback cache |
| **Supabase API** | NetworkFirst (5s timeout), cache 5 phút, max 50 entries |
| **Fonts** | CacheFirst cho Google Fonts (1 năm) |
| **Manifest** | name, short_name, icons 192/512, display: standalone, orientation: portrait |
| **Meta PWA** | apple-mobile-web-app-capable, theme-color, viewport-fit=cover |
| **Offline Sync** | `syncAllOfflineData()` khi online – sync attendance từ localStorage |
| **UI Native-like** | safe-area, no pull-to-refresh browser, overscroll-behavior |

---

## ⚠️ **CHƯA ỔN / CẦN CẢI THIỆN**

### 1. **Offline-first cho Chấm công**

**Vấn đề:**
- `saveAttendance()` chỉ fallback localStorage khi `!isSupabaseAvailable()` (Supabase không cấu hình)
- Khi **Supabase có** nhưng **offline**: gọi `supabase.insert()` → fail → không lưu localStorage
- CheckIn cần `getShiftRegistrations()` và `uploadAttendancePhoto()` – cả hai đều cần mạng

**Đề xuất:**
- Trong `saveAttendance()`: nếu `!navigator.onLine` hoặc fetch fail → lưu vào localStorage với `synced: false`
- Khi offline: cho phép chấm công dùng base64 ảnh (không upload), lưu record tạm
- Khi online: sync lên Supabase + upload ảnh

---

### 2. **Offline fallback page**

**Vấn đề:**
- Không có trang "Bạn đang offline" khi mở app lần đầu offline
- NetworkFirst với timeout 3s có thể trả về trang trống nếu chưa từng cache

**Đề xuất:**
- Thêm `offline.html` đơn giản: icon, text "Không có kết nối mạng", nút "Thử lại"
- Trong SW: `NavigationFallback` hoặc custom handler trả về offline.html khi network fail

---

### 3. **Cache dữ liệu đọc (Read-through cache)**

**Vấn đề:**
- Khi offline, mọi API call (users, shifts, payroll…) đều fail
- Không có IndexedDB/local cache cho dữ liệu đã load
- User không xem lại Dashboard, Payroll… khi mất mạng

**Đề xuất:**
- Dùng IndexedDB (hoặc localStorage) cache dữ liệu gần đây:
  - `getAttendance`, `getShiftRegistrations`, `getPayroll`…
- Luồng: Online → fetch từ API → lưu cache → trả về. Offline → đọc từ cache (nếu có)
- Có thể dùng thư viện như idb, Dexie, hoặc tự wrap

---

### 4. **Tailwind CDN vs build**

**Vấn đề:**
- `index.html` dùng Tailwind CDN (`cdn.tailwindcss.com`) – phụ thuộc mạng
- SW cache route cho Tailwind CDN nhưng production thường dùng CSS bundle

**Đề xuất:**
- Build Tailwind vào bundle (postcss) thay vì CDN → precache CSS cùng app, không phụ thuộc CDN

---

### 5. **Cập nhật PWA (Update flow)**

**Vấn đề:**
- `registerType: 'autoUpdate'` – SW tự cập nhật
- Chưa có UI thông báo "Đã có phiên bản mới" / "Tải lại để cập nhật"

**Đề xuất:**
- Lắng nghe `workbox-window` / `sw.addEventListener('controllerchange')`
- Hiện snackbar/toast: "Đã có bản cập nhật" + nút "Tải lại"

---

### 6. **Add to Home Screen (A2HS)**

**Vấn đề:**
- Không có prompt/banner hướng dẫn user cài PWA
- Trên iOS Safari phải thủ công "Add to Home Screen"

**Đề xuất:**
- Kiểm tra `beforeinstallprompt` (Android/Chrome) → hiện banner "Cài đặt app"
- Trên iOS: hiện hướng dẫn "Chạm Share → Add to Home Screen" (không có API tự động)

---

### 7. **Splash screen & loading**

**Vấn đề:**
- Không có splash screen chuyên biệt khi PWA khởi động
- Màn trắng trước khi React hydrate

**Đề xuất:**
- Dùng `background_color` + `icons` trong manifest (đã có)
- Thêm inline CSS trong `index.html` cho splash: logo + spinner ngay trong HTML, ẩn khi `#root` có nội dung

---

### 8. **Background Sync**

**Vấn đề:**
- Chưa dùng Background Sync API cho request thất bại khi offline
- Chỉ sync khi user mở app lại và có mạng

**Đề xuất:**
- Đăng ký `sync` event trong SW cho attendance pending
- Khi online, SW tự retry gửi lên server mà không cần user mở app

---

### 9. **Push Notifications**

**Vấn đề:**
- Migration đã drop `push_subscriptions` – không còn push
- App native thường có thông báo đẩy

**Đề xuất:**
- Nếu cần gần native: thiết kế lại push (Web Push + Supabase hoặc FCM)
- Ưu tiên thấp nếu thông báo in-app đủ dùng

---

## 📊 **BẢNG SO SÁNH VỚI APP NATIVE**

| Tính năng | App Native | PWA hiện tại | Mức độ |
|-----------|------------|--------------|--------|
| Cài đặt (A2HS) | Từ store / link | Thiếu prompt | 60% |
| Chạy offline (shell) | Có | Có (precache) | 90% |
| Chạy offline (data) | Cache local | Chỉ attendance (một phần) | 40% |
| Chấm công offline | Lưu local, sync sau | Chưa đầy đủ | 50% |
| Splash screen | Có | Cơ bản (manifest) | 70% |
| Cập nhật thầm lặng | Có | Có (autoUpdate) | 85% |
| Thông báo cập nhật | Có | Chưa có UI | 50% |
| Push notifications | Có | Không | 0% |
| Fullscreen, safe area | Có | Có | 95% |
| Offline fallback page | Có | Chưa có | 0% |

---

## 🎯 **ĐỀ XUẤT ƯU TIÊN**

### Ưu tiên cao
1. **Offline chấm công:** Sửa `saveAttendance()` để lưu localStorage khi offline (kể cả có Supabase)
2. **Offline fallback page:** Tạo `offline.html` và cấu hình SW trả về khi mất mạng
3. **Cache dữ liệu đọc:** IndexedDB/local cache cho users, shifts, payroll… khi đã load

### Ưu tiên trung bình
4. **UI cập nhật PWA:** Toast "Đã có bản mới" + nút reload
5. **A2HS prompt:** Banner cài đặt trên Android/Chrome
6. **Build Tailwind:** Bỏ CDN, dùng CSS bundle

### Ưu tiên thấp
7. **Background Sync:** Retry request khi online
8. **Push Notifications:** Thiết kế lại nếu cần
9. **Splash screen:** Cải thiện màn hình loading

---

## 📝 **KẾT LUẬN**

- **Cache hiện tại ổn** cho app shell, fonts, một phần API.
- **Để gần app native 100%** cần:
  - Offline-first đúng nghĩa cho chấm công và xem dữ liệu
  - Trang offline fallback
  - Trải nghiệm cập nhật (toast + reload)
  - A2HS prompt
  - Tùy chọn: push, background sync, splash mạnh hơn

---

**Phiên bản:** 1.0
