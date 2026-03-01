# Cập nhật hiển thị tổng lương đúng theo tính giờ

## Vấn đề
Hệ thống đã chuyển sang tính lương theo giờ (hours-based) thông qua hàm `calculateShiftWorkDays()`, nhưng các phần hiển thị tổng lương vẫn đang tính lại từ chi tiết các ca, dẫn đến sai số.

## Nguyên nhân
- `actualWorkDays` trong PayrollRecord đã là số công được tính từ tổng giờ làm việc (ví dụ: 4 giờ = 0.5 công)
- Các component đang tính lại `totalShiftMoney` từ từng ca shift, gây ra sai lệch với giá trị đã được tính chính xác trong backend

## Giải pháp
Đơn giản hóa logic hiển thị bằng cách sử dụng trực tiếp `actualWorkDays` từ PayrollRecord:

```typescript
// Công thức đúng
const dailyRate = baseSalary / standardWorkDays;
const basicSalary = dailyRate * actualWorkDays;
```

## Các file đã cập nhật

### 1. `components/admin/PayrollManagement.tsx`
- **Dòng 510-560**: Đơn giản hóa phần "Chi tiết tính lương" trong modal
- **Dòng 603-720**: Cập nhật phần "Chi tiết ca làm việc" để tính tổng từ `actualWorkDays`
- Loại bỏ logic `totalMoney += money` (tính từ từng ca)
- Sử dụng trực tiếp `totalMoney = dailyRate * actualWorkDays`

### 2. `components/Payroll.tsx`
- **Dòng 183**: Sửa công thức tính `basicSalary` từ hardcode `/27` sang `/data.standardWorkDays`
- **Dòng 270-310**: Đơn giản hóa phần hiển thị "Lương cơ bản"
- **Dòng 320-420**: Cập nhật phần "Chi tiết ca làm việc" để tính `totalMoney` từ `actualWorkDays`

## Kết quả
- ✅ Tổng lương hiển thị chính xác theo số công đã tính từ giờ
- ✅ Không còn sai lệch giữa tổng chi tiết và tổng lương
- ✅ Code đơn giản hơn, dễ maintain
- ✅ Nhất quán giữa admin view và employee view

## Công thức tính lương (sau khi fix)

### Lương cơ bản
```
Lương cơ bản = (Lương tổng / Số ngày công chuẩn) × Số công thực tế
             = (baseSalary / standardWorkDays) × actualWorkDays
```

Trong đó:
- `actualWorkDays` = Tổng giờ làm việc / Số giờ chuẩn mỗi ngày
- Ví dụ: 216 giờ / 8 giờ = 27 công

### Lương OT
```
Lương OT = (Lương tổng / Số ngày công chuẩn / Số giờ mỗi ngày) × Hệ số OT × Số giờ OT
         = (baseSalary / standardWorkDays / workHoursPerDay) × overtimeRate × otHours
```

### Tổng lương
```
Tổng lương = Lương cơ bản + Lương OT + Phụ cấp + Thưởng - Khấu trừ
```

## Lưu ý
- Phần export CSV đã đúng từ trước, không cần sửa
- Logic tính lương trong `services/db.ts` không thay đổi
- Chỉ cập nhật phần hiển thị (UI) để khớp với logic backend
