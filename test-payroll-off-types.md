# Test Payroll với các loại nghỉ phép

## Quy tắc tính lương đã áp dụng:

### ✅ Các loại nghỉ ĐƯỢC HƯỞNG LƯƠNG (tính công):
1. **OFF_PN (Phép năm)**: Nghỉ phép năm - Được hưởng lương đầy đủ
2. **OFF_LE (Nghỉ lễ)**: Nghỉ lễ - Được hưởng lương đầy đủ
3. **CT (Công tác)**: Đi công tác - Được hưởng lương đầy đủ

### ❌ Các loại nghỉ KHÔNG ĐƯỢC HƯỞNG LƯƠNG (không tính công):
1. **OFF_DK (Định kỳ)**: Nghỉ định kỳ - Không lương
2. **OFF_KL (Không lương)**: Nghỉ không lương - Không lương

## Thay đổi trong code:

### 1. File `services/db.ts` - Hàm `calculateShiftWorkDays`:
```typescript
// Đếm: ngày đi làm (shift !== OFF) HOẶC ngày nghỉ có lương (OFF_PN, OFF_LE)
// Không tính: OFF_DK (định kỳ), OFF_KL (không lương)
if (shift.shift !== 'OFF') {
  return true; // Tất cả các ca làm việc đều được tính
}
// Với ca OFF, chỉ tính những loại nghỉ có lương
return shift.offType === OffType.OFF_PN || shift.offType === OffType.LE;
```

### 2. File `types.ts` - Cập nhật labels:
```typescript
export const OFF_TYPE_LABELS: Record<OffType, string> = {
  [OffType.OFF_DK]: 'OFF DK - Định kỳ (Không lương)',
  [OffType.OFF_PN]: 'OFF PN - Phép năm (Có lương)',
  [OffType.OFF_KL]: 'OFF KL - Không lương',
  [OffType.CT]: 'CT - Công tác (Có lương)',
  [OffType.LE]: 'LỄ - Nghỉ lễ (Có lương)'
}
```

## Ví dụ tính lương:

### Trường hợp 1: Nhân viên có lương cơ bản 27,000,000 VNĐ
- Ngày công chuẩn: 27 ngày
- Tháng 2/2026:
  - Đi làm: 20 ngày
  - OFF_PN (Phép năm): 2 ngày → **Tính công** ✅
  - OFF_DK (Định kỳ): 3 ngày → **Không tính công** ❌
  - OFF_LE (Nghỉ lễ): 2 ngày → **Tính công** ✅

**Tính toán:**
- Tổng ngày công = 20 (đi làm) + 2 (OFF_PN) + 2 (OFF_LE) = 24 ngày
- Lương = (27,000,000 / 27) × 24 = 24,000,000 VNĐ

### Trường hợp 2: Nhân viên có lương cơ bản 27,000,000 VNĐ
- Ngày công chuẩn: 27 ngày
- Tháng 2/2026:
  - Đi làm: 20 ngày
  - OFF_KL (Không lương): 5 ngày → **Không tính công** ❌
  - OFF_LE (Nghỉ lễ): 2 ngày → **Tính công** ✅

**Tính toán:**
- Tổng ngày công = 20 (đi làm) + 2 (OFF_LE) = 22 ngày
- Lương = (27,000,000 / 27) × 22 = 22,000,000 VNĐ

## Cách test:

1. Vào Admin Panel → Shift Management
2. Đăng ký các ca nghỉ với các loại khác nhau (OFF_PN, OFF_DK, OFF_KL, OFF_LE)
3. Approve các ca nghỉ
4. Vào Payroll Management
5. Tính lương cho tháng đó
6. Kiểm tra số ngày công:
   - OFF_PN và OFF_LE phải được tính vào ngày công
   - OFF_DK và OFF_KL không được tính vào ngày công
