# Báo Cáo Các Chức Năng Không Được Sử Dụng

**Ngày kiểm tra:** 04/02/2026

## 📋 Tổng Quan

Sau khi kiểm tra toàn bộ codebase, đã phát hiện một số chức năng và functions không được sử dụng trong hệ thống.

---

## ❌ Chức Năng Đã Bị Gỡ Bỏ Nhưng Vẫn Còn Code

### 1. **Push Notifications (Web Push)**
- **Trạng thái:** ❌ Đã bị gỡ bỏ hoàn toàn
- **Migrations liên quan:**
  - `010_drop_push_subscriptions.sql` - DROP bảng push_subscriptions
  - `012_create_push_subscriptions.sql` - CREATE lại bảng (có vẻ như đã thử implement lại)
  - `013_drop_push_subscriptions.sql` - DROP lại bảng (quyết định cuối cùng là gỡ bỏ)
- **Code liên quan:** Không có code nào trong app sử dụng push subscriptions
- **Khuyến nghị:** 
  - ✅ Migration 013 đã DROP bảng, không cần làm gì thêm
  - ⚠️ Có thể xóa migration 012 nếu không cần giữ lại lịch sử

---

## 🔧 Functions Không Được Sử Dụng

### 1. **`cleanupExpiredOTPs()`**
- **File:** `services/db.ts` (dòng 1727)
- **Mô tả:** Xóa các mã OTP đã hết hạn
- **Trạng thái:** ❌ Không được gọi ở đâu trong codebase
- **Lý do:** Có thể cleanup được xử lý tự động bởi Supabase hoặc không cần thiết
- **Khuyến nghị:** 
  - Nếu Supabase tự động cleanup → Có thể xóa function này
  - Nếu cần cleanup thủ công → Nên thêm scheduled job hoặc gọi trong App.tsx khi app khởi động

### 2. **`createSystemConfig()`**
- **File:** `services/db.ts` (dòng 1525)
- **Mô tả:** Tạo cấu hình hệ thống mới
- **Trạng thái:** ❌ Không được gọi ở đâu
- **Component liên quan:** `components/admin/SystemConfigManagement.tsx` chỉ sử dụng `updateSystemConfig()`
- **Khuyến nghị:**
  - Nếu admin không cần tạo config mới → Có thể xóa function này
  - Nếu cần tạo config mới → Nên thêm UI trong SystemConfigManagement để tạo config mới

### 3. **`getSession()`**
- **File:** `services/auth.ts` (dòng 168)
- **Mô tả:** Lấy session hiện tại từ Supabase Auth
- **Trạng thái:** ❌ Không được gọi ở đâu
- **Lý do:** App sử dụng OTP-based login, không dùng Supabase Auth session
- **Khuyến nghị:** 
  - ✅ Có thể xóa function này vì app không sử dụng Supabase Auth session

### 4. **`onAuthStateChange()`**
- **File:** `services/auth.ts` (dòng 181)
- **Mô tả:** Lắng nghe thay đổi trạng thái auth từ Supabase
- **Trạng thái:** ❌ Không được gọi ở đâu
- **Lý do:** App sử dụng OTP-based login, không dùng Supabase Auth state
- **Khuyến nghị:** 
  - ✅ Có thể xóa function này vì app không sử dụng Supabase Auth

### 5. **`checkSupabaseConnection()`**
- **File:** `services/supabase.ts` (dòng 55)
- **Mô tả:** Kiểm tra kết nối Supabase
- **Trạng thái:** ❌ Không được gọi ở đâu
- **Khuyến nghị:**
  - Có thể sử dụng trong EnvError component để kiểm tra connection
  - Hoặc có thể xóa nếu không cần thiết

### 6. **`ensureBucketExists()`**
- **File:** `services/storage.ts` (dòng 130)
- **Mô tả:** Đảm bảo storage bucket tồn tại
- **Trạng thái:** ❌ Không được gọi ở đâu
- **Khuyến nghị:**
  - Có thể gọi khi app khởi động để đảm bảo bucket tồn tại
  - Hoặc gọi trước khi upload ảnh chấm công
  - Hoặc có thể xóa nếu bucket đã được tạo thủ công và không cần kiểm tra

---

## 📊 Tổng Kết

| Loại | Số Lượng | Chi Tiết | Trạng Thái |
|------|----------|----------|------------|
| **Chức năng đã gỡ bỏ** | 1 | Push Notifications | ✅ Đã xử lý qua migrations |
| **Functions không dùng** | 6 | cleanupExpiredOTPs, createSystemConfig, getSession, onAuthStateChange, checkSupabaseConnection, ensureBucketExists | ✅ Đã xóa |
| **TỔNG CỘNG** | **7** | | ✅ **Đã xử lý hoàn tất** |

---

## ✅ Đã Xử Lý

### Đã xóa các functions không cần thiết (04/02/2026)
1. ✅ **`getSession()`** - Đã xóa từ `services/auth.ts`
2. ✅ **`onAuthStateChange()`** - Đã xóa từ `services/auth.ts`
3. ✅ **`checkSupabaseConnection()`** - Đã xóa từ `services/supabase.ts`
4. ✅ **`ensureBucketExists()`** - Đã xóa từ `services/storage.ts`
5. ✅ **`cleanupExpiredOTPs()`** - Đã xóa từ `services/db.ts`
6. ✅ **`createSystemConfig()`** - Đã xóa từ `services/db.ts`

**Tổng cộng:** Đã xóa 6 functions không được sử dụng

## 🎯 Khuyến Nghị Hành Động

### ✅ Đã hoàn thành
- Tất cả các functions không được sử dụng đã được xóa khỏi codebase

### Ưu tiên thấp (Tùy chọn)
3. 📝 **Dọn dẹp migrations:**
   - Xem xét xóa migration 012 nếu không cần giữ lịch sử
   - Migration 010 và 013 đã DROP push_subscriptions, có thể giữ lại để ghi nhận lịch sử

---

## 📝 Ghi Chú

- ✅ Tất cả các functions không được sử dụng đã được xóa khỏi codebase
- ✅ Push Notifications đã được gỡ bỏ hoàn toàn qua migrations
- ✅ App sử dụng OTP-based login nên không cần các functions liên quan đến Supabase Auth session
- ✅ Codebase đã được làm sạch và tối ưu hóa

## 🔄 Lịch Sử Thay Đổi

- **04/02/2026**: Đã xóa 6 functions không được sử dụng khỏi codebase
