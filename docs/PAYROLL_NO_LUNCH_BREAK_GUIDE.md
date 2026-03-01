# Hướng dẫn sử dụng tính năng "Không nghỉ trưa" trong tính lương

## Tổng quan

Tính năng mới này cho phép admin:
1. Chọn những ngày mà nhân viên không có nghỉ trưa (không trừ 1 giờ) trong dialog chi tiết lương
2. Xem chi tiết giờ OT cho từng ngày làm việc
3. Theo dõi tổng OT trong tháng

## Cách sử dụng

### Bước 1: Mở dialog chi tiết lương

1. Truy cập vào `/admin/payroll`
2. Chọn tháng cần xem
3. Click vào tên nhân viên trong bảng lương để mở dialog chi tiết

### Bước 2: Xem danh sách ca làm việc

Trong dialog chi tiết lương, bạn sẽ thấy:
- Phần bên trái: Tổng quan lương (lương cơ bản, giờ làm việc, OT, thực nhận)
- Phần bên phải: Chi tiết từng ca làm việc với:
  - Ngày làm việc
  - Giờ vào - giờ ra
  - Loại ca (Làm việc, OFF, Phép năm, v.v.)
  - Số giờ làm việc thường
  - Số tiền lương thường
  - **Số giờ OT (nếu có)** - màu tím
  - **Số tiền OT (nếu có)** - màu tím

### Bước 3: Chọn ngày không nghỉ trưa

Với mỗi ca CUSTOM có thời gian >= 6 giờ, bạn sẽ thấy một checkbox "Không nghỉ trưa" bên dưới thông tin ca.

**Cách hoạt động:**
- Mặc định: Hệ thống tự động trừ 1 giờ nghỉ trưa cho các ca >= 6 giờ
- Khi check vào "Không nghỉ trưa": Hệ thống sẽ KHÔNG trừ 1 giờ nghỉ trưa cho ca đó

### Bước 4: Xem kết quả tính toán

Khi bạn check/uncheck checkbox, hệ thống sẽ tự động:
- Cập nhật số giờ làm việc của ca đó
- Tính lại số giờ OT (nếu vượt quá 8h)
- Tính lại tổng giờ làm việc trong tháng
- Tính lại tổng OT trong tháng
- Tính lại lương tương ứng
- Cập nhật số tiền thực nhận

Tất cả các thay đổi được hiển thị real-time, không cần reload trang.

## Hiển thị OT trong chi tiết ca

### Tiêu đề bảng
Ở đầu bảng chi tiết ca làm việc, bạn sẽ thấy:
```
Chi tiết ca làm việc (176.0h)
5 ngày có OT  ← Số ngày có OT trong tháng (màu tím)
```

### Chi tiết từng ca
Với mỗi ca làm việc, nếu có OT (làm việc > 8 giờ), hệ thống sẽ hiển thị:

```
15/01 [OT]    ← Badge OT màu tím
08:00 - 18:00
Làm việc

8.0h              ← Giờ thường
500,000đ          ← Lương thường

OT: 2.0h          ← Giờ OT (màu tím)
+150,000đ         ← Lương OT (màu tím)
```

### Các ngày KHÔNG có OT
```
10/01
08:00 - 16:00
Làm việc

7.0h              ← Giờ thường (< 8h)
437,500đ          ← Lương thường
                  ← Không có OT
```

### Phần tổng cộng
Phần tổng cộng cũng sẽ hiển thị:
```
Tổng cộng
22.50 công
+ 5.0h OT         ← Tổng OT trong tháng

176.0h
14,080,000đ

OT: 5.0h          ← Chi tiết OT
+750,000đ         ← Tiền OT
```

## Ví dụ minh họa

### Trường hợp 1: Ca làm việc bình thường

**Ca làm việc:** 08:00 - 18:00 (10 giờ)

- **Không check "Không nghỉ trưa":**
  - Giờ làm việc tính lương: 10h - 1h = 9h
  - Giờ thường: 8h → Lương = 8h × hourly_rate
  - Giờ OT: 1h → Lương OT = 1h × hourly_rate × 1.5
  - **Hiển thị:** 8.0h + OT: 1.0h

- **Check "Không nghỉ trưa":**
  - Giờ làm việc tính lương: 10h (không trừ)
  - Giờ thường: 8h → Lương = 8h × hourly_rate
  - Giờ OT: 2h → Lương OT = 2h × hourly_rate × 1.5 ✅ **+1 giờ OT**
  - **Hiển thị:** 8.0h + OT: 2.0h

### Trường hợp 2: Ca làm việc ngắn hơn

**Ca làm việc:** 08:00 - 14:00 (6 giờ)

- **Không check "Không nghỉ trưa":**
  - Giờ làm việc tính lương: 6h - 1h = 5h
  - Giờ thường: 5h → Lương = 5h × hourly_rate
  - Giờ OT: 0h (không có OT)
  - **Hiển thị:** 5.0h

- **Check "Không nghỉ trưa":**
  - Giờ làm việc tính lương: 6h (không trừ)
  - Giờ thường: 6h → Lương = 6h × hourly_rate ✅ **+1 giờ**
  - Giờ OT: 0h (vẫn chưa đủ 8h để có OT)
  - **Hiển thị:** 6.0h

### Trường hợp 3: Ca làm việc dài

**Ca làm việc:** 08:00 - 20:00 (12 giờ)

- **Không check "Không nghỉ trưa":**
  - Giờ làm việc tính lương: 12h - 1h = 11h
  - Giờ thường: 8h → Lương = 8h × hourly_rate
  - Giờ OT: 3h → Lương OT = 3h × hourly_rate × 1.5
  - **Hiển thị:** 8.0h + OT: 3.0h

- **Check "Không nghỉ trưa":**
  - Giờ làm việc tính lương: 12h (không trừ)
  - Giờ thường: 8h → Lương = 8h × hourly_rate
  - Giờ OT: 4h → Lương OT = 4h × hourly_rate × 1.5 ✅ **+1 giờ OT**
  - **Hiển thị:** 8.0h + OT: 4.0h

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

**Q: OT được tính như thế nào?**
A: OT được tính khi số giờ làm việc vượt quá 8h (work_hours_per_day). Công thức: OT_hours = total_hours - 8h. Lương OT = OT_hours × hourly_rate × 1.5

**Q: Tại sao khi tick "Không nghỉ trưa" thì OT tăng thêm 1 giờ?**
A: Vì khi không trừ 1 giờ nghỉ trưa, tổng giờ làm việc tăng lên 1 giờ. Nếu ca đã vượt quá 8h, giờ tăng thêm này sẽ được tính vào OT.

**Q: Có thể áp dụng cho tất cả các ca trong tháng không?**
A: Hiện tại cần check từng ca một. Nếu cần tính năng "Áp dụng cho tất cả", vui lòng liên hệ với đội phát triển.

**Q: Làm sao biết ngày nào có OT?**
A: Các ngày có OT sẽ được đánh dấu bằng badge màu tím [OT] bên cạnh ngày tháng. Ở đầu bảng cũng hiển thị tổng số ngày có OT trong tháng.

**Q: Màu tím trong bảng chi tiết là gì?**
A: Màu tím được dùng để hiển thị thông tin OT (badge OT, số giờ OT, tiền OT), giúp dễ phân biệt với giờ làm việc thường (màu xanh).
