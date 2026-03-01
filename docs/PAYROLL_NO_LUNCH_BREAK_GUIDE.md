# Hướng dẫn sử dụng tính năng "Không nghỉ trưa" trong tính lương

## Tổng quan

Tính năng mới này cho phép admin điều chỉnh tính lương cho những ngày mà nhân viên không có nghỉ trưa (không trừ 1 giờ) trong dialog chi tiết lương.

## Cách sử dụng

### Bước 1: Mở dialog chi tiết lương

1. Truy cập vào `/admin/payroll`
2. Chọn tháng cần xem
3. Click vào tên nhân viên trong bảng lương để mở dialog chi tiết

### Bước 2: Xem danh sách ca làm việc

Trong dialog chi tiết lương, bạn sẽ thấy:
- Phần bên trái: Tổng quan lương (lương cơ bản, giờ làm việc, OT, thực nhận)
- Phần bên phải: Chi tiết từng ca làm việc

### Bước 3: Chọn ngày không nghỉ trưa

Với mỗi ca CUSTOM có thời gian >= 6 giờ, bạn sẽ thấy một checkbox "Không nghỉ trưa" bên dưới thông tin ca.

**Cách hoạt động:**
- Mặc định: Hệ thống tự động trừ 1 giờ nghỉ trưa cho các ca >= 6 giờ
- Khi check vào "Không nghỉ trưa": Hệ thống sẽ KHÔNG trừ 1 giờ nghỉ trưa cho ca đó

### Bước 4: Xem kết quả tính toán

Khi bạn check/uncheck checkbox, hệ thống sẽ tự động:
- Cập nhật số giờ làm việc của ca đó
- Tính lại tổng giờ làm việc trong tháng
- Tính lại lương tương ứng
- Cập nhật số tiền thực nhận

Tất cả các thay đổi được hiển thị real-time, không cần reload trang.

## Ví dụ minh họa

### Trường hợp 1: Ca làm việc bình thường

**Ca làm việc:** 08:00 - 18:00 (10 giờ)

- **Không check "Không nghỉ trưa":**
  - Giờ làm việc tính lương: 10h - 1h = 9h
  - Nhưng chỉ tính tối đa 8h (work_hours_per_day)
  - Lương = 8h × hourly_rate

- **Check "Không nghỉ trưa":**
  - Giờ làm việc tính lương: 10h (không trừ)
  - Nhưng chỉ tính tối đa 8h (work_hours_per_day)
  - Lương = 8h × hourly_rate

### Trường hợp 2: Ca làm việc ngắn hơn

**Ca làm việc:** 08:00 - 14:00 (6 giờ)

- **Không check "Không nghỉ trưa":**
  - Giờ làm việc tính lương: 6h - 1h = 5h
  - Lương = 5h × hourly_rate

- **Check "Không nghỉ trưa":**
  - Giờ làm việc tính lương: 6h (không trừ)
  - Lương = 6h × hourly_rate

## Lưu ý quan trọng

1. **Chỉ áp dụng cho ca CUSTOM:** Checkbox chỉ hiển thị với các ca CUSTOM có thời gian >= 6 giờ

2. **Không lưu vào database:** Các thay đổi này chỉ để xem và tính toán tạm thời. Nếu muốn lưu lại, cần có thêm tính năng lưu trữ

3. **Reset khi đóng dialog:** Khi đóng dialog và mở lại, tất cả các checkbox sẽ được reset về trạng thái mặc định

4. **Tính toán real-time:** Mọi thay đổi được cập nhật ngay lập tức, giúp admin dễ dàng so sánh và điều chỉnh

## Công thức tính lương

### Lương theo giờ

```
hourly_rate = (base_salary / standard_work_days) / work_hours_per_day
```

### Lương cho mỗi ca

```
Nếu ca CUSTOM:
  total_hours = end_time - start_time
  
  Nếu total_hours >= 6 VÀ KHÔNG check "Không nghỉ trưa":
    work_hours = total_hours - 1
  Ngược lại:
    work_hours = total_hours
  
  regular_hours = min(work_hours, work_hours_per_day)
  salary = hourly_rate × regular_hours
```

### Tổng lương tháng

```
total_salary = Σ(salary của từng ca) + OT_pay + allowance + bonus - deductions
```

## Câu hỏi thường gặp

**Q: Tại sao checkbox không hiển thị cho một số ca?**
A: Checkbox chỉ hiển thị cho ca CUSTOM có thời gian >= 6 giờ. Các ca cố định (MORNING, AFTERNOON, EVENING) hoặc ca OFF không có checkbox.

**Q: Làm sao để lưu lại các thay đổi?**
A: Hiện tại tính năng này chỉ để xem và tính toán tạm thời. Nếu cần lưu lại, vui lòng liên hệ với đội phát triển để thêm tính năng lưu trữ.

**Q: Tại sao số giờ vẫn là 8h dù tôi đã check "Không nghỉ trưa"?**
A: Hệ thống có giới hạn tối đa là work_hours_per_day (mặc định 8h). Nếu ca làm việc dài hơn, phần vượt quá sẽ được tính là OT.

**Q: Có thể áp dụng cho tất cả các ca trong tháng không?**
A: Hiện tại cần check từng ca một. Nếu cần tính năng "Áp dụng cho tất cả", vui lòng liên hệ với đội phát triển.
