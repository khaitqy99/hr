# Tài Liệu Hệ Thống Y99 HR

## 1. Tổng Quan Hệ Thống

**Y99 HR** là hệ thống quản lý nhân sự 4.0 được thiết kế dưới dạng **Progressive Web App (PWA)**, tập trung vào trải nghiệm di động mượt mà. Hệ thống giúp tự động hóa các quy trình nhân sự cốt lõi như chấm công, quản lý lịch làm việc, nghỉ phép và tính lương.

- **Tên dự án:** Y99 HR Connect PWA
- **Khẩu hiệu:** Chốt công nhanh - Quản trị hiệu quả
- **Đối tượng sử dụng:** Nhân viên, Quản lý, Nhân sự (HR), Admin.

---

## 2. Kiến Trúc Kỹ Thuật

Hệ thống được xây dựng trên nền tảng Serverless, tối ưu hóa tốc độ và khả năng mở rộng.

### 2.1. Frontend
- **Framework:** React 19 (Sử dụng lazy loading để tối ưu bundle).
- **Build Tool:** Vite 6.
- **Ngôn ngữ:** TypeScript.
- **PWA:** `vite-plugin-pwa` (Chiến lược `injectManifest` để tùy biến Service Worker).
- **UI:** Tailwind CSS (Custom components) + Recharts (Biểu đồ dashboard).

### 2.2. Backend & Database (BaaS)
- **Supabase:**
  - **Auth:** Xác thực qua OTP Email (passwordless).
  - **Database:** PostgreSQL.
  - **Storage:** Lưu trữ hình ảnh chấm công và hóa đơn.
  - **Realtime:** Đồng bộ thông báo và trạng thái hệ thống.

### 2.3. Quy Trình Đồng Bộ Offline
Hệ thống hỗ trợ làm việc ngoại tuyến (Offline-first):
1. Dữ liệu chấm công/đăng ký ca được lưu vào `localStorage` khi mất mạng.
2. Tự động đồng bộ (Background Sync) khi thiết bị có kết nối internet trở lại.

---

## 3. Các Tính Năng Chính

### 3.1. Chấm Công (Attendance)
- **Check-in/Check-out:** Xác thực vị trí qua GPS (bán kính 200m quanh văn phòng).
- **Xác thực hình ảnh:** Chụp ảnh tại thời điểm chấm công để tăng tính minh bạch.
- **Trạng thái:** Đi trễ, về sớm, tăng ca được tự động phân loại.

### 3.2. Quản Lý Lịch Làm Việc (Shift Management)
- **Đăng ký ca:** Hỗ trợ ca linh hoạt (vào lúc nào làm đủ 9 tiếng lúc đó).
- **Đăng ký nghỉ (Off):** Nghỉ định kỳ, phép năm, không lương, công tác, lễ.
- **Phê duyệt:** Quy trình phê duyệt nhanh chóng ngay trên ứng dụng mobile.

### 3.3. Quản Lý Lương (Payroll)
- **Bảng lương tháng:** Tự động tính toán dựa trên dữ liệu chấm công thực tế.
- **Thanh toán:** Theo dõi trạng thái đã thanh toán/chờ thanh toán.
- **Phiếu lương:** Nhân viên có thể xem chi tiết lương thực nhận, phụ cấp và các khoản khấu trừ (BHXH, thuế...).

### 3.4. Quản Trị Hệ Thống (Admin Panel)
- **Quản lý người dùng:** Thêm/sửa/xóa và phân quyền nhân viên.
- **Quản lý phòng ban:** Tổ chức sơ đồ nhân sự.
- **Cấu hình hệ thống:** Tùy chỉnh giờ làm việc, bán kính chấm công, các tham số tính lương.
- **Xuất báo cáo:** Xuất dữ liệu ra Excel để phục vụ lưu trữ.

---

## 4. Phân Quyền Người Dùng (RBAC)

| Chức năng | EMPLOYEE | MANAGER | HR | ADMIN |
| :--- | :---: | :---: | :---: | :---: |
| Chấm công / Xem lịch cá nhân | ✅ | ✅ | ✅ | ✅ |
| Xem bảng lương cá nhân | ✅ | ✅ | ✅ | ✅ |
| Phê duyệt ca/nghỉ cấp dưới | ❌ | ✅ | ✅ | ✅ |
| Quản lý nhân sự toàn công ty | ❌ | ❌ | ✅ | ✅ |
| Cấu hình hệ thống / Lương | ❌ | ❌ | ❌ | ✅ |

---

## 5. Cấu Trúc Thư Mục Dự Án

```text
d:/hr-connect-pwa/
├── components/          # Các component UI (Dashboard, Admin, CheckIn...)
├── services/            # Logic kết nối API & Database (Supabase, Auth, DB sync)
├── utils/               # Các hàm tiện ích (PWA, định dạng, tọa độ GPS)
├── types/               # Định nghĩa TypeScript interfaces & enums
├── supabase/            # Cấu hình & Migrations database
├── public/              # Tài sản tĩnh (Logo, Service Worker src)
├── docs/                # Tài liệu & Báo cáo hệ thống
├── App.tsx              # Component chính & Điều hướng (Routing)
├── types.ts             # Định nghĩa data model toàn cục
└── vite.config.ts       # Cấu hình PWA & Build tool
```

---

## 6. Hướng Dẫn Cài Đặt (Dành cho Dev)

### 6.1. Yêu cầu hệ thống
- Node.js >= 18.0.0
- Tài khoản Supabase (URL & Anon Key)

### 6.2. Các bước thiết lập
1. Clone dự án.
2. Cài đặt thư viện: `npm install`.
3. Tạo file `.env.local` và điền thông tin:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Chạy chế độ phát triển: `npm run dev`.

---

## 7. Triển Khai (Deployment)

Dự án được cấu hình để triển khai trên **Vercel**:
- Framework Preset: `Vite`.
- Build Command: `npm run build`.
- Output Directory: `dist`.

*Lưu ý: Cần thêm các biến môi trường (Environment Variables) trên Vercel tương tự file `.env.local`.*
