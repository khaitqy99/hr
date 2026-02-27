# Sửa lỗi tính lương ngày không tròn công

## Vấn đề hiện tại

Hệ thống hiện tại tính lương theo **số ngày** thay vì **số giờ làm việc thực tế**. Điều này dẫn đến:

- Nhân viên làm 4 tiếng vẫn được tính là 1 công (sai)
- Không có cách nào tính lương chính xác cho ngày làm việc không tròn

### Ví dụ thực tế
- Nhân viên đi làm 4 tiếng (nửa ngày)
- Hệ thống tính: 1 công đầy đủ
- Đúng phải là: 0.5 công (4 giờ / 8 giờ)

## Công thức đúng

### Công thức hiện tại (SAI)
```
Lương = (LCB / 27) × số ngày công
```

### Công thức mới (ĐÚNG)
```
Lương = (LCB / 27 / 8) × số giờ làm việc
```

Hoặc tương đương:
```
Lương = (LCB / 216) × số giờ làm việc
```
Trong đó: 216 = 27 ngày × 8 giờ/ngày = tổng số giờ chuẩn trong tháng

## Giải pháp thiết kế

### 1. Thay đổi cách tính công

Thay vì đếm số ngày (1 ngày = 1 công), chuyển sang tính theo giờ:

```typescript
// CŨ: Đếm ngày
const workDays = shiftDays.size; // 1, 2, 3...

// MỚI: Tính tổng giờ và chuyển thành công
const totalHours = calculateTotalWorkHours(shifts);
const workDays = totalHours / workHoursPerDay; // Ví dụ: 4 giờ / 8 = 0.5 công
```

### 2. Cập nhật hàm `calculateShiftWorkDays`

Đổi tên và logic:
- Tên mới: `calculateShiftWorkDays` (giữ nguyên để tương thích)
- Logic mới: Tính tổng giờ → chuyển thành số công (decimal)

```typescript
export const calculateShiftWorkDays = async (
  userId: string, 
  month: string
): Promise<number> => {
  const workHoursPerDay = await getConfigNumber('work_hours_per_day', 8);
  
  // Tính tổng giờ làm việc
  const totalHours = await calculateTotalWorkHours(userId, month);
  
  // Chuyển giờ thành công: 4 giờ = 0.5 công, 8 giờ = 1 công
  const workDays = totalHours / workHoursPerDay;
  
  return parseFloat(workDays.toFixed(2)); // Làm tròn 2 chữ số thập phân
};
```

### 3. Tạo hàm mới `calculateTotalWorkHours`

Hàm này sẽ:
- Tính tổng số giờ từ shift registrations
- Xử lý các loại ca: CUSTOM (có giờ cụ thể), ngày lễ, OFF có lương

```typescript
const calculateTotalWorkHours = async (
  userId: string,
  month: string
): Promise<number> => {
  const [shifts, holidays] = await Promise.all([
    getShiftRegistrations(userId),
    getHolidays()
  ]);
  
  const workHoursPerDay = await getConfigNumber('work_hours_per_day', 8);
  let totalHours = 0;
  
  // Lọc shifts trong tháng
  const monthShifts = shifts.filter(shift => {
    const shiftDate = new Date(shift.date);
    return shift.status === RequestStatus.APPROVED &&
           shiftDate.getMonth() + 1 === targetMonth &&
           shiftDate.getFullYear() === targetYear;
  });
  
  // Tính giờ cho từng shift
  for (const shift of monthShifts) {
    if (shift.shift === 'CUSTOM' && shift.startTime && shift.endTime) {
      // Ca CUSTOM: Tính giờ từ startTime → endTime
      const hours = calculateHoursBetween(shift.startTime, shift.endTime);
      totalHours += Math.min(hours, workHoursPerDay); // Tối đa 8 giờ/ngày (phần thừa là OT)
    } else if (shift.shift === 'OFF') {
      // OFF có lương: Tính 8 giờ
      if (shift.offType === OffType.OFF_PN || shift.offType === OffType.LE) {
        totalHours += workHoursPerDay;
      }
      // OFF không lương: Không tính
    } else {
      // Các ca khác (nếu có): Tính 8 giờ
      totalHours += workHoursPerDay;
    }
  }
  
  // Thêm giờ cho ngày lễ hưởng lương (tự động)
  // ... (logic tương tự như hiện tại)
  
  return totalHours;
};
```

### 4. Hàm helper tính giờ

```typescript
const calculateHoursBetween = (startTime: string, endTime: string): number => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  return totalMinutes / 60;
};
```

## Ví dụ tính toán

### Trường hợp 1: Làm 4 tiếng
```
- Shift: 09:00 - 13:00 (4 giờ)
- Số công: 4 / 8 = 0.5 công
- Lương: (5,000,000 / 27) × 0.5 = 92,593 VNĐ
```

### Trường hợp 2: Làm 6 tiếng
```
- Shift: 09:00 - 15:00 (6 giờ)
- Số công: 6 / 8 = 0.75 công
- Lương: (5,000,000 / 27) × 0.75 = 138,889 VNĐ
```

### Trường hợp 3: Làm 10 tiếng (có OT)
```
- Shift: 09:00 - 19:00 (10 giờ)
- Số công: 8 / 8 = 1 công (giờ thường)
- OT: 2 giờ
- Lương cơ bản: (5,000,000 / 27) × 1 = 185,185 VNĐ
- Lương OT: (5,000,000 / 27 / 8) × 1.5 × 2 = 69,444 VNĐ
- Tổng: 254,629 VNĐ
```

## Tác động

### Ưu điểm
- Tính lương chính xác cho ngày không tròn công
- Linh hoạt hơn với các ca làm việc ngắn
- Công bằng cho nhân viên

### Lưu ý
- Cần cập nhật UI để hiển thị số công dạng decimal (0.5, 0.75...)
- Cần test kỹ với các trường hợp edge case
- Có thể cần migration data nếu có dữ liệu cũ

## Files cần sửa

1. `services/db.ts`
   - Sửa `calculateShiftWorkDays()` 
   - Thêm `calculateTotalWorkHours()`
   - Thêm `calculateHoursBetween()`

2. `components/admin/PayrollManagement.tsx`
   - Cập nhật hiển thị số công (cho phép decimal)

3. `components/Payroll.tsx`
   - Cập nhật hiển thị số công cho nhân viên

## Testing

Cần test các trường hợp:
- [ ] Làm 4 tiếng → 0.5 công
- [ ] Làm 6 tiếng → 0.75 công
- [ ] Làm 8 tiếng → 1 công
- [ ] Làm 10 tiếng → 1 công + 2 giờ OT
- [ ] OFF có lương → 1 công (8 giờ)
- [ ] OFF không lương → 0 công
- [ ] Ngày lễ → 1 công (8 giờ)
