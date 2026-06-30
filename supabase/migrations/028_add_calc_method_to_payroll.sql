-- Thêm cột calc_method vào bảng payroll_records để lưu phương thức tính lương
ALTER TABLE payroll_records
ADD COLUMN IF NOT EXISTS calc_method VARCHAR(20) DEFAULT 'SHIFT' CHECK (calc_method IN ('SHIFT', 'ATTENDANCE', 'MANUAL'));

COMMENT ON COLUMN payroll_records.calc_method IS 'Phương thức tính lương: SHIFT (đăng ký ca), ATTENDANCE (chấm công check-in/out), MANUAL (nhập tay)';
