# Báo Cáo Vấn Đề Upload Ảnh Check-In/Check-Out

**Ngày kiểm tra:** 04/02/2026

## 📋 Tổng Quan

Đã kiểm tra chi tiết chức năng upload ảnh trong check-in/check-out và phát hiện một số vấn đề tiềm ẩn.

---

## ⚠️ Vấn Đề Phát Hiện

### 1. **❌ Lỗi Nghiêm Trọng: `blobToDataUrl()` không được await khi fallback**

**File:** `services/storage.ts` (dòng 35-40, 44, 74, 86, 93)

**Vấn đề:**
```typescript
const blobToDataUrl = (b: Blob): Promise<string> =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(b);
  });

// ❌ VẤN ĐỀ: Không await khi fallback
if (!isSupabaseConfigured()) {
  return typeof photo === 'string' ? photo : blobToDataUrl(photo); // ❌ Trả về Promise<string> thay vì string
}

// ❌ VẤN ĐỀ: Không await khi error
if (error) {
  return typeof photo === 'string' ? photo : blobToDataUrl(photo); // ❌ Trả về Promise<string>
}
```

**Hậu quả:**
- Function `uploadAttendancePhoto()` có thể trả về `Promise<string>` thay vì `string`
- Code trong `CheckIn.tsx` dòng 242: `const photoUrl = await uploadAttendancePhoto(...)` sẽ nhận được `Promise<string>` nếu photo là Blob và fallback
- Điều này có thể gây lỗi runtime hoặc photoUrl sẽ là Promise object thay vì URL string

**Khuyến nghị:** 
- ✅ Cần await `blobToDataUrl(photo)` khi fallback
- ✅ Hoặc đảm bảo function luôn trả về string (không phải Promise)

### 2. **⚠️ Thiếu thông báo cho user khi upload ảnh thất bại**

**File:** `services/storage.ts` (dòng 66-74)

**Vấn đề:**
- Khi upload ảnh thất bại, code fallback về base64 nhưng không có thông báo cho user
- User không biết rằng ảnh không được upload lên server, chỉ lưu local (base64)
- Ảnh base64 sẽ không đồng bộ được giữa các thiết bị

**Khuyến nghị:**
- Thêm warning/notification cho user khi upload thất bại
- Hoặc ít nhất log warning rõ ràng hơn

### 3. **⚠️ Timestamp có thể không khớp với thời điểm chụp ảnh**

**File:** `components/CheckIn.tsx` (dòng 241-242)

**Vấn đề:**
```typescript
const timestamp = Date.now(); // Timestamp được tạo khi submit
const photoUrl = await uploadAttendancePhoto(photo, user.id, timestamp, type);
```

- Timestamp được tạo khi user click "Xác nhận vào/ra", không phải khi chụp ảnh
- Nếu user chụp ảnh rồi đợi một lúc mới submit, timestamp sẽ không khớp với thời điểm chụp ảnh
- Filename của ảnh sẽ dùng timestamp này, có thể gây nhầm lẫn

**Khuyến nghị:**
- Có thể lưu timestamp khi chụp ảnh và dùng timestamp đó
- Hoặc giữ nguyên như hiện tại (timestamp của lần chấm công)

### 4. **⚠️ Memory leak tiềm ẩn với photoUrlRef**

**File:** `components/CheckIn.tsx` (dòng 272-275)

**Vấn đề:**
- Khi upload thành công, `photoUrlRef.current` được revoke
- Nhưng nếu upload thất bại và fallback về base64, `photoUrlRef.current` vẫn giữ URL cũ
- URL này có thể không được revoke đúng cách

**Khuyến nghị:**
- Đảm bảo revoke URL trong mọi trường hợp (success hoặc error)

### 5. **⚠️ Error handling không đầy đủ**

**File:** `components/CheckIn.tsx` (dòng 278-280)

**Vấn đề:**
```typescript
} catch (error) {
  console.error('Error saving attendance:', error);
  setError('Lỗi khi lưu dữ liệu chấm công. Vui lòng thử lại.');
}
```

- Error message không phân biệt giữa lỗi upload ảnh và lỗi lưu attendance
- User không biết chính xác lỗi gì xảy ra

**Khuyến nghị:**
- Phân biệt các loại lỗi và hiển thị message phù hợp
- Hoặc ít nhất log chi tiết hơn để debug

### 6. **✅ Điểm tốt: Có fallback mechanism**

**File:** `services/storage.ts`

**Điểm tốt:**
- Code có fallback về base64 khi upload thất bại
- Đảm bảo chấm công vẫn hoạt động ngay cả khi không upload được ảnh
- Có kiểm tra `isSupabaseConfigured()` trước khi upload

---

## 🔧 Giải Pháp Đề Xuất

### 1. **Sửa lỗi `blobToDataUrl()` không được await**

```typescript
// ❌ Code hiện tại
if (!isSupabaseConfigured()) {
  return typeof photo === 'string' ? photo : blobToDataUrl(photo);
}

// ✅ Code đề xuất
if (!isSupabaseConfigured()) {
  return typeof photo === 'string' ? photo : await blobToDataUrl(photo);
}

// Tương tự cho các chỗ khác
if (error) {
  return typeof photo === 'string' ? photo : await blobToDataUrl(photo);
}
```

### 2. **Thêm thông báo khi upload thất bại**

```typescript
if (error) {
  console.warn('⚠️ Falling back to base64 data URL');
  // Có thể emit event hoặc callback để UI hiển thị warning
  return typeof photo === 'string' ? photo : await blobToDataUrl(photo);
}
```

### 3. **Cải thiện error handling**

```typescript
try {
  const photoUrl = await uploadAttendancePhoto(photo, user.id, timestamp, type);
  // ...
} catch (uploadError) {
  console.error('Error uploading photo:', uploadError);
  setError('Lỗi khi upload ảnh. Ảnh sẽ được lưu local.');
  // Vẫn tiếp tục với base64 fallback
  const photoUrl = typeof photo === 'string' ? photo : await blobToDataUrl(photo);
  // ...
}
```

---

## 📊 Tổng Kết

| Loại Vấn Đề | Mức Độ | Số Lượng | Trạng Thái |
|-------------|--------|----------|------------|
| **Lỗi nghiêm trọng** | 🔴 Cao | 1 | ✅ Đã sửa |
| **Cảnh báo** | 🟡 Trung bình | 4 | ⚠️ Còn lại |
| **Điểm tốt** | 🟢 Tốt | 1 | Giữ nguyên |

---

## 🎯 Khuyến Nghị Ưu Tiên

### ✅ Đã sửa
1. ✅ **Sửa lỗi `blobToDataUrl()` không được await** - Đã sửa tất cả 4 chỗ trong `storage.ts`

### Ưu tiên trung bình (Nên sửa)
2. ⚠️ **Thêm thông báo khi upload thất bại** - Cải thiện UX
3. ⚠️ **Cải thiện error handling** - Dễ debug hơn
4. ⚠️ **Đảm bảo revoke URL đúng cách** - Tránh memory leak

### Ưu tiên thấp (Tùy chọn)
5. 📝 **Xem xét timestamp** - Có thể giữ nguyên như hiện tại

---

## 📝 Ghi Chú

- ✅ Chức năng upload ảnh về cơ bản hoạt động tốt
- ✅ Có fallback mechanism đảm bảo chấm công vẫn hoạt động khi upload thất bại
- ✅ Đã sửa lỗi async/await - tất cả các chỗ gọi `blobToDataUrl()` đã được await đúng cách

## 🔄 Lịch Sử Thay Đổi

- **04/02/2026**: Kiểm tra chức năng upload ảnh và phát hiện các vấn đề
- **04/02/2026**: ✅ Đã sửa lỗi `blobToDataUrl()` không được await (4 chỗ trong `storage.ts`)
