# Implementation: Sửa lỗi tính lương ngày không tròn công

## Tóm tắt

Đã sửa logic tính lương từ **đếm ngày** sang **tính theo giờ**, cho phép tính lương chính xác cho ngày làm việc không tròn.

## Thay đổi chính

### 1. services/db.ts

#### Thêm hàm helper mới

**`calculateHoursBetween(startTime, endTime)`**
- Tính số giờ giữa 2 thời điểm
- Input: "09:00", "13:00"
- Output: 4 (giờ)

**`calculateTotalWorkHours(userId, month, shifts, holidays)`**
- Tính tổng số giờ làm việc trong tháng
- Xử lý các loại ca:
  - Ca CUSTOM: Tính giờ từ startTime → endTime (tối đa 8 giờ, phần thừa là OT)
  - Ca OFF có lương (OFF_PN, LE): Tính 8 giờ
  - Ca OFF không lương (OFF_DK, OFF_KL): Không tính
  - Các ca khác: Tính 8 giờ
- Tự động thêm giờ cho ngày lễ hưởng lương
- Tránh tính trùng ngày bằng Set

#### Cập nhật hàm `calculateShiftWorkDays()`

**Logic cũ:**
```typescript
const shiftDays = new Set<string>();
// ... thêm ngày vào Set
return shiftDays.size; // Trả về số ngày (1, 2, 3...)
```

**Logic mới:**
```typescript
const totalHours = await calculateTotalWorkHours(...);
const workDays = totalHours / workHoursPerDay;
return parseFloat(workDays.toFixed(2)); // Trả về số công (0.5, 0.75, 1.0...)
```

### 2. UI Components

Cập nhật hiển thị số công từ integer sang decimal (2 chữ số thập phân):

#### components/admin/PayrollManagement.tsx
- Thêm state `workHoursPerDay` để lưu config số giờ/ngày
- Thêm cột "Giờ làm việc" vào bảng:
  - Header: "Giờ làm việc"
  - Hiển thị: `{(item.actualWorkDays * workHoursPerDay).toFixed(1)}h`
  - Dòng phụ: `({item.actualWorkDays.toFixed(2)} công)`
- Hiển thị ngày công: `{item.actualWorkDays.toFixed(2)}/{item.standardWorkDays}`
- Export CSV: 
  - Thêm cột "Giờ làm việc"
  - Giá trị: `(payroll.actualWorkDays * workHoursPerDay).toFixed(1) + 'h'`
  - Cột "Ngày công": `payroll.actualWorkDays.toFixed(2)`

#### components/Payroll.tsx
- Hiển thị ngày công: `{data.actualWorkDays.toFixed(2)} ngày`
- Chi tiết: `{data.actualWorkDays.toFixed(2)}/{data.standardWorkDays}`

#### components/SalaryManagement.tsx
- Form input: Thêm `step={0.01}` để cho phép nhập số thập phân
- Hiển thị từ shift: `{shiftWorkDays.toFixed(2)}`
- Hiển thị trong danh sách: `{record.actualWorkDays.toFixed(2)} ngày công`
- Hiển thị payroll hiện tại: `{getCurrentMonthPayroll()!.actualWorkDays.toFixed(2)}`

## Công thức tính lương

### Trước khi sửa
```
Lương = (LCB / 27) × số ngày
```
Vấn đề: 4 tiếng = 1 ngày = lương đầy đủ

### Sau khi sửa
```
Lương = (LCB / 27 / 8) × số giờ
```
Hoặc:
```
Lương = (LCB / 27) × (số giờ / 8)
```

## Ví dụ hiển thị trong bảng

### Trường hợp 1: Làm 4 tiếng
```
Giờ làm việc: 4.0h (0.50 công)
Ngày công: 0.50/27
```

### Trường hợp 2: Làm 6 tiếng
```
Giờ làm việc: 6.0h (0.75 công)
Ngày công: 0.75/27
```

### Trường hợp 3: Làm 8 tiếng
```
Giờ làm việc: 8.0h (1.00 công)
Ngày công: 1.00/27
```

### Trường hợp 4: Tháng có nhiều ca
```
Giờ làm việc: 26.0h (3.25 công)
Ngày công: 3.25/27
```

## Ví dụ tính toán

### Trường hợp 1: Làm 4 tiếng
```
Shift: 09:00 - 13:00
Tổng giờ: 4 giờ
Số công: 4 / 8 = 0.5 công
Lương (LCB 5M): (5,000,000 / 27) × 0.5 = 92,593 VNĐ
```

### Trường hợp 2: Làm 6 tiếng
```
Shift: 09:00 - 15:00
Tổng giờ: 6 giờ
Số công: 6 / 8 = 0.75 công
Lương (LCB 5M): (5,000,000 / 27) × 0.75 = 138,889 VNĐ
```

### Trường hợp 3: Làm 10 tiếng (có OT)
```
Shift: 09:00 - 19:00
Tổng giờ: 10 giờ
Giờ thường: 8 giờ → 1 công
Giờ OT: 2 giờ
Lương cơ bản: (5,000,000 / 27) × 1 = 185,185 VNĐ
Lương OT: (5,000,000 / 27 / 8) × 1.5 × 2 = 69,444 VNĐ
Tổng: 254,629 VNĐ
```

### Trường hợp 4: Tháng có nhiều ca khác nhau
```
- Ngày 1: 09:00-17:00 (8 giờ) → 1 công
- Ngày 2: 09:00-13:00 (4 giờ) → 0.5 công
- Ngày 3: OFF_PN → 1 công (8 giờ)
- Ngày 4: 09:00-15:00 (6 giờ) → 0.75 công
- Ngày 5: OFF_KL → 0 công

Tổng: 1 + 0.5 + 1 + 0.75 + 0 = 3.25 công
Lương (LCB 5M): (5,000,000 / 27) × 3.25 = 601,852 VNĐ
```

## Testing checklist

- [x] Syntax check: Không có lỗi
- [ ] Test làm 4 tiếng → 0.5 công
- [ ] Test làm 6 tiếng → 0.75 công
- [ ] Test làm 8 tiếng → 1 công
- [ ] Test làm 10 tiếng → 1 công + 2 giờ OT
- [ ] Test OFF có lương → 1 công
- [ ] Test OFF không lương → 0 công
- [ ] Test ngày lễ → 1 công
- [ ] Test tháng có nhiều ca khác nhau
- [ ] Test UI hiển thị đúng số thập phân
- [ ] Test form input cho phép nhập số thập phân
- [ ] Test export CSV hiển thị đúng

## Lưu ý

1. **Backward compatibility**: Hàm `calculateShiftWorkDays` vẫn giữ nguyên tên và signature, chỉ thay đổi logic bên trong
2. **Decimal precision**: Làm tròn 2 chữ số thập phân (0.01 công)
3. **OT calculation**: Logic tính OT không thay đổi, vẫn tính riêng từ giờ vượt quá 8 giờ/ngày
4. **UI updates**: Tất cả nơi hiển thị `actualWorkDays` đã được cập nhật để hiển thị decimal
5. **Form input**: Thêm `step={0.01}` để cho phép nhập số thập phân khi tính lương thủ công

## Files đã sửa

1. ✅ `services/db.ts` - Logic tính công
2. ✅ `components/admin/PayrollManagement.tsx` - UI admin + Modal chi tiết lương
3. ✅ `components/Payroll.tsx` - UI nhân viên
4. ✅ `components/SalaryManagement.tsx` - Form tính lương
5. ✅ `.kiro/specs/payroll-partial-day-calculation-fix/design.md` - Thiết kế
6. ✅ `.kiro/specs/payroll-partial-day-calculation-fix/implementation.md` - Tài liệu này

## Tính năng mới: Modal chi tiết lương

### Khi nhấn vào tên nhân viên trong bảng payroll:

**Hiển thị modal với các thông tin:**

1. **Summary Cards (4 cards)**
   - Lương cơ bản
   - Giờ làm việc (tổng giờ + số công)
   - Giờ OT (số giờ + tiền OT)
   - Thực nhận

2. **Chi tiết tính lương**
   - Lương theo ngày công với công thức
   - Lương OT với công thức (nếu có)
   - Phụ cấp (nếu có)
   - Thưởng (nếu có)
   - Khấu trừ (nếu có)
   - Tổng thực nhận (highlight)

3. **Chi tiết ca làm việc (Layout 2 cột)**
   - Hiển thị dạng card, chia thành 2 cột để dễ nhìn
   - Mỗi card hiển thị:
     - Ngày và loại ca (badge màu)
     - Thông tin ca và số giờ
     - Số tiền
   - Tính tiền theo công thức:
     - Ca thường: `(LCB / 27 / 8) × số giờ`
     - Phép năm/Nghỉ lễ: `LCB / 27` (lương đầy đủ)
     - OFF không lương: 0 VNĐ
   - Phân loại màu sắc:
     - Làm việc: Xanh lá
     - Phép năm: Xanh dương
     - Nghỉ lễ: Tím
     - OFF định kỳ: Xám
     - OFF không lương: Đỏ
   - Sắp xếp theo ngày
   - **Tổng cộng (3 ô)**: Tổng giờ | Tổng công | Tổng tiền

4. **Actions**
   - Nút "Đóng" để đóng modal
   - Nút "Xem hồ sơ nhân viên" để chuyển sang trang profile

### Ví dụ hiển thị:

```
┌─────────────────────────────────────────────────────────┐
│ Nguyễn Văn A - Chi tiết lương tháng 02-2025            │
├─────────────────────────────────────────────────────────┤
│ [Lương CB]  [Giờ LV]    [Giờ OT]   [Thực nhận]         │
│ 5,000,000   32.0h       2.0h        4,850,000           │
│             (4.00 công) +69,444                         │
├─────────────────────────────────────────────────────────┤
│ Chi tiết tính lương:                                    │
│ Lương theo ngày công        740,741 VNĐ                 │
│ Công thức: (5M/27) × 4.00                               │
│ Lương OT (2h × 1.5)        +69,444 VNĐ                  │
│ Công thức: (5M/27/8) × 1.5 × 2                          │
│ Khấu trừ (BHXH)            -150,000 VNĐ                 │
│ ─────────────────────────────────────────               │
│ Tổng thực nhận              4,850,000 VNĐ               │
├─────────────────────────────────────────────────────────┤
│ Chi tiết ca làm việc (10 ca):                           │
│ ┌──────┬──────────────┬──────┬────────────┬──────────┐ │
│ │ Ngày │ Ca           │ Giờ  │ Loại       │ Tiền     │ │
│ ├──────┼──────────────┼──────┼────────────┼──────────┤ │
│ │ 01/02│ 09:00-17:00  │ 8.0h │ Làm việc   │ 185,185₫ │ │
│ │ 02/02│ 09:00-13:00  │ 4.0h │ Làm việc   │  92,593₫ │ │
│ │ 03/02│ OFF_PN       │ 8.0h │ Phép năm   │ 185,185₫ │ │
│ │ 04/02│ 09:00-19:00  │ 8.0h │ Làm việc   │ 185,185₫ │ │
│ │ 05/02│ OFF_DK       │ -    │ OFF định kỳ│    -     │ │
│ ├──────┴──────────────┴──────┴────────────┴──────────┤ │
│ │ Tổng                 32.0h  4.00 công    740,741₫   │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│              [Đóng]  [Xem hồ sơ nhân viên]             │
└─────────────────────────────────────────────────────────┘
```


## Layout mới: Chi tiết ca làm việc (2 cột)

Thay vì hiển thị dạng bảng, giờ hiển thị dạng card layout 2 cột:

```
┌─────────────────────────┐  ┌─────────────────────────┐
│ 01/02    [Làm việc]     │  │ 06/02    [Làm việc]     │
│ 09:00-17:00      8.0h   │  │ 09:00-17:00      8.0h   │
│              185,185 ₫  │  │              185,185 ₫  │
└─────────────────────────┘  └─────────────────────────┘

┌─────────────────────────┐  ┌─────────────────────────┐
│ 02/02    [Làm việc]     │  │ 07/02    [Phép năm]     │
│ 09:00-13:00      4.0h   │  │ OFF_PN           8.0h   │
│               92,593 ₫  │  │              185,185 ₫  │
└─────────────────────────┘  └─────────────────────────┘

┌───────────────────────────────────────────────────────┐
│  Tổng giờ: 32.0h  │  Tổng công: 4.00  │  Tổng: 740,741₫│
└───────────────────────────────────────────────────────┘
```

### Ưu điểm:
- Tiết kiệm không gian, hiển thị nhiều ca hơn trên 1 màn hình
- Dễ đọc hơn với layout card
- Màu sắc phân loại rõ ràng
- Responsive tốt (mobile sẽ hiển thị 1 cột)
