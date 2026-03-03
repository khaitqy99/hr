-- Migration: Thêm cột reason vào bảng shift_registrations
-- Mục đích: Cho phép nhân viên nhập lý do khi đăng ký/đổi lịch ca làm

-- Thêm cột reason (lý do đăng ký/đổi lịch)
ALTER TABLE shift_registrations
ADD COLUMN IF NOT EXISTS reason TEXT;

-- Thêm comment cho cột
COMMENT ON COLUMN shift_registrations.reason IS 'Lý do đăng ký hoặc đổi lịch ca làm (nhân viên nhập)';
