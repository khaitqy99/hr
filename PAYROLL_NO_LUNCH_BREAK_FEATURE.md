# Tính năng: Chọn ngày không nghỉ trưa trong chi tiết lương

## Mô tả
Thêm tính năng cho phép admin chọn những ngày mà nhân viên không có nghỉ trưa (không trừ 1 giờ) trong dialog chi tiết lương để tính lương chính xác hơn.

## Thay đổi cần thực hiện

### 1. Thêm state mới trong PayrollManagement component

```typescript
const [noLunchBreakDates, setNoLunchBreakDates] = useState<Set<number>>(new Set());
const [isRecalculatingDetail, setIsRecalculatingDetail] = useState(false);
```

### 2. Thêm hàm toggle cho checkbox

```typescript
const toggleNoLunchBreak = (shiftDate: number) => {
  setNoLunchBreakDates(prev => {
    const newSet = new Set(prev);
    if (newSet.has(shiftDate)) {
      newSet.delete(shiftDate);
    } else {
      newSet.add(shiftDate);
    }
    return newSet;
  });
};
```

### 3. Thêm hàm tính giờ có xét đến không nghỉ trưa

```typescript
const calculateTotalHoursWithNoLunchBreak = (shifts: ShiftRegistration[], noLunchDates: Set<number>): number => {
  let totalHours = 0;
  shifts.forEach(shift => {
    let hours = workHoursPerDay;
    if (shift.shift === 'CUSTOM' && shift.startTime && shift.endTime) {
      const [startHour, startMin] = shift.startTime.split(':').map(Number);
      const [endHour, endMin] = shift.endTime.split(':').map(Number);
      hours = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) / 60;
      // Chỉ trừ 1h nghỉ trưa nếu ca >= 6 giờ VÀ ngày này KHÔNG được đánh dấu "không nghỉ trưa"
      if (hours >= 6 && !noLunchDates.has(shift.date)) {
        hours = hours - 1;
      }
    } else if (shift.shift === 'OFF' && shift.offType !== OffType.OFF_PN && shift.offType !== OffType.LE) {
      hours = 0;
    }
    if (hours > 0) totalHours += Math.min(hours, workHoursPerDay);
  });
  return totalHours;
};
```

### 4. Cập nhật handleViewPayrollDetail để reset state

```typescript
const handleViewPayrollDetail = async (payroll: PayrollRecord, employee: User) => {
  setSelectedPayrollDetail({ payroll, employee });
  setDetailLoading(true);
  setNoLunchBreakDates(new Set()); // Reset khi mở dialog mới
  // ... rest of the code
};
```

### 5. Thêm checkbox vào mỗi ca CUSTOM trong bảng chi tiết

Trong phần render của mỗi shift row, thêm:

```typescript
{isCustomShift && hours >= 6 && (
  <div className="mt-2">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={noLunchBreakDates.has(shift.date)}
        onChange={() => toggleNoLunchBreak(shift.date)}
        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-xs text-slate-600">Không nghỉ trưa</span>
    </label>
  </div>
)}
```

### 6. Cập nhật tính toán trong dialog

Thay thế tất cả các chỗ tính `totalActualHours` bằng:

```typescript
const totalActualHours = calculateTotalHoursWithNoLunchBreak(shiftDetails, noLunchBreakDates);
```

## Cách hoạt động

1. Khi admin mở dialog chi tiết lương, hệ thống hiển thị danh sách các ca làm việc
2. Với mỗi ca CUSTOM có thời gian >= 6 giờ, hiển thị checkbox "Không nghỉ trưa"
3. Khi admin check vào checkbox, hệ thống sẽ:
   - Không trừ 1 giờ nghỉ trưa cho ca đó
   - Tính lại tổng giờ làm việc
   - Cập nhật lại số tiền lương tương ứng
4. Tất cả các số liệu (giờ làm việc, lương) sẽ được cập nhật real-time khi checkbox thay đổi

## Lợi ích

- Linh hoạt hơn trong việc tính lương cho các trường hợp đặc biệt
- Admin có thể điều chỉnh chính xác cho từng ngày cụ thể
- Không cần thay đổi dữ liệu gốc trong database
- Tính toán real-time, trực quan
