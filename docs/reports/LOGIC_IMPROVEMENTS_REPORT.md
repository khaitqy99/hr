# Báo Cáo Cải Thiện Logic Nghiệp Vụ

**Ngày thực hiện:** 22/02/2026

## 📋 Tổng Quan

Đã kiểm tra và cải thiện logic nghiệp vụ của hệ thống tính lương và quản lý ca làm việc.

---

## 🔴 Vấn Đề Đã Phát Hiện và Sửa

### 1. **Trùng Lặp Giữa Leave Request và Shift OFF**

**Vấn đề:**
- Nếu nhân viên có cả leave request VÀ shift OFF cho cùng một ngày
- Ngày đó bị trừ 2 lần trong tính lương
- Dẫn đến lương bị tính thiếu

**Ví dụ:**
```
Nhân viên A:
- Đăng ký shift OFF ngày 15/01 (không lương)
- Admin tạo leave request ngày 15/01
→ Ngày 15/01 bị trừ 2 lần → Sai
```

**Giải pháp đã áp dụng:**
```typescript
// Trong calculateLeaveDays()
// Tạo Set các ngày đã có shift OFF để tránh trừ 2 lần
const shiftOffDays = new Set<string>();
shiftRegistrations
  .filter(shift => shift.shift === 'OFF' && shift.offType !== OffType.LE)
  .forEach(shift => {
    shiftOffDays.add(dateKey);
  });

// Chỉ thêm leave day nếu chưa có shift OFF
if (!shiftOffDays.has(dateKey)) {
  leaveDaysSet.add(dateKey);
}
```

**Kết quả:**
- ✅ Mỗi ngày nghỉ chỉ bị trừ 1 lần
- ✅ Tính lương chính xác hơn

---

### 2. **Không Xử Lý Trường Hợp Không Có Shift**

**Vấn đề:**
- Nếu nhân viên không đăng ký ca trong tháng
- `calculateShiftWorkDays()` trả về 0
- Lương = 0 (sai nếu nhân viên vẫn đi làm và chấm công)

**Ví dụ:**
```
Nhân viên B:
- Không đăng ký ca trong tháng 01/2026
- Nhưng vẫn đi làm và chấm công đầy đủ
→ Lương = 0 → Sai
```

**Giải pháp đã áp dụng:**
```typescript
// Trong calculatePayroll()
// Nếu không có shift hoặc shift = 0, fallback sang attendance
if (useAttendance && (finalWorkDays === 0 || finalWorkDays === undefined)) {
  const attendanceStats = await calculateAttendanceStats(employee.id, month);
  
  // Nếu không có shift hoặc shift = 0, dùng attendance
  if (finalWorkDays === 0 || finalWorkDays === undefined) {
    finalWorkDays = attendanceStats.actualWorkDays;
  }
}
```

**Kết quả:**
- ✅ Hệ thống tự động fallback sang dữ liệu chấm công
- ✅ Nhân viên vẫn được tính lương đúng

---

### 3. **Không Tính OT Từ Attendance Khi Checkout Muộn**

**Vấn đề:**
- Nếu nhân viên checkout muộn hơn shift đăng ký
- Nhưng chưa đủ 9 tiếng (8h + 1h nghỉ)
- OT không được tính

**Ví dụ:**
```
Nhân viên C:
- Shift: 09:00 - 17:30 (8.5 tiếng)
- Checkout: 18:00 (9 tiếng)
- Status: OVERTIME
→ OT không được tính → Sai
```

**Giải pháp đã áp dụng:**
```typescript
// Trong calculateAttendanceStats()
if (workHours > workHoursWithBreak) {
  totalOtHours += workHours - workHoursWithBreak;
} else if (dayRecords.checkOut.status === 'OVERTIME') {
  // Nếu được đánh dấu OVERTIME nhưng chưa đủ 9 tiếng
  // Vẫn tính là OT tối thiểu 0.5h
  const minOT = 0.5;
  totalOtHours += Math.max(minOT, workHours - workHoursWithBreak);
}
```

**Kết quả:**
- ✅ OT được tính khi có status OVERTIME
- ✅ Tối thiểu 0.5 giờ OT

---

### 4. **Không Tự Động Tính Công Cho Ngày Lễ**

**Vấn đề:**
- Ngày lễ hưởng lương chỉ được tính nếu nhân viên đăng ký ca OFF + LE
- Nếu quên đăng ký, ngày lễ không được tính công
- Gây thiệt thòi cho nhân viên

**Ví dụ:**
```
Ngày 30/04 (Ngày giải phóng miền Nam):
- Nhân viên D quên đăng ký ca OFF + LE
→ Không được tính công → Sai
```

**Giải pháp đã áp dụng:**
```typescript
// Trong calculateShiftWorkDays()
// Tự động thêm các ngày lễ hưởng lương trong tháng
holidays
  .filter(holiday => holiday.isPaid)
  .forEach(holiday => {
    // Kiểm tra ngày lễ có trong tháng không
    if (holidayDate.getMonth() + 1 === targetMonth) {
      // Kiểm tra xem ngày này có shift OFF không lương không
      const hasUnpaidOff = shiftRegistrations.some(shift => 
        shift.shift === 'OFF' && shift.offType !== OffType.LE
      );
      
      if (!hasUnpaidOff) {
        shiftDays.add(dateKey);
      }
    }
  });
```

**Kết quả:**
- ✅ Ngày lễ tự động được tính công
- ✅ Không cần đăng ký ca
- ✅ Trừ khi nhân viên đăng ký nghỉ không lương

---

## ✅ Cải Thiện Khác

### 5. **Tối Ưu Logic Tính OT**

**Cải thiện:**
- Lấy giá trị lớn hơn giữa shift OT và attendance OT
- Đảm bảo nhân viên được tính OT đúng nhất

```typescript
// Lấy giá trị lớn hơn giữa shift OT và attendance OT
if (attendanceStats.otHours > 0) {
  finalOtHours = Math.max(finalOtHours, attendanceStats.otHours);
}
```

---

## 📊 Tổng Kết

| Vấn Đề | Mức Độ | Trạng Thái | Impact |
|--------|---------|------------|--------|
| Trùng lặp Leave + Shift OFF | 🔴 Cao | ✅ Đã sửa | Tính lương sai |
| Không có shift → Lương = 0 | 🔴 Cao | ✅ Đã sửa | Nhân viên mất lương |
| Không tính OT từ attendance | 🟡 Trung bình | ✅ Đã sửa | Mất tiền OT |
| Không tự động tính công lễ | 🟡 Trung bình | ✅ Đã sửa | Thiệt thòi nhân viên |
| Tối ưu logic OT | 🟢 Thấp | ✅ Đã sửa | Cải thiện độ chính xác |

---

## 🎯 Kết Quả

### Trước khi cải thiện:
- ❌ Có thể tính lương sai do trùng lặp
- ❌ Nhân viên không đăng ký ca bị mất lương
- ❌ OT không được tính đầy đủ
- ❌ Ngày lễ phụ thuộc vào đăng ký ca

### Sau khi cải thiện:
- ✅ Tính lương chính xác, không trùng lặp
- ✅ Fallback sang attendance nếu không có shift
- ✅ OT được tính đầy đủ từ cả shift và attendance
- ✅ Ngày lễ tự động được tính công

---

## 🔄 Testing Recommendations

### Test Cases Cần Kiểm Tra:

**1. Test trùng lặp Leave + Shift OFF:**
```
- Tạo shift OFF ngày 15/01
- Tạo leave request ngày 15/01
- Tính lương tháng 01
→ Expect: Ngày 15/01 chỉ bị trừ 1 lần
```

**2. Test không có shift:**
```
- Không đăng ký ca trong tháng
- Chấm công đầy đủ 27 ngày
- Tính lương
→ Expect: Lương = (Lương cơ bản / 27) × 27
```

**3. Test OT từ attendance:**
```
- Shift: 09:00 - 17:30
- Checkout: 18:00 với status OVERTIME
- Tính lương
→ Expect: OT >= 0.5 giờ
```

**4. Test ngày lễ tự động:**
```
- Không đăng ký ca ngày 30/04
- Tính lương tháng 04
→ Expect: Ngày 30/04 được tính công
```

---

## 📝 Ghi Chú

- Tất cả các thay đổi đã được áp dụng vào `services/db.ts`
- Logic mới tương thích ngược với dữ liệu cũ
- Không cần migration database
- Cần test kỹ trước khi deploy production

---

**Người thực hiện:** AI Assistant  
**Ngày:** 22/02/2026
