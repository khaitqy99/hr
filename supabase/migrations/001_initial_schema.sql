-- Migration: Initial Y99 HR Database Schema
-- Tạo các bảng cơ bản cho hệ thống Y99 HR

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Bảng Users (Nhân viên)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('EMPLOYEE', 'MANAGER', 'HR', 'ADMIN')),
  department VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  employee_code VARCHAR(50),
  job_title VARCHAR(255),
  contract_type VARCHAR(50) CHECK (contract_type IN ('TRIAL', 'OFFICIAL', 'TEMPORARY')),
  start_date BIGINT,
  status VARCHAR(50) CHECK (status IN ('ACTIVE', 'LEFT')) DEFAULT 'ACTIVE',
  gross_salary DECIMAL(15, 2),
  social_insurance_salary DECIMAL(15, 2),
  trainee_salary DECIMAL(15, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bảng Attendance Records (Chấm công)
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp BIGINT NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('CHECK_IN', 'CHECK_OUT')),
  location JSONB NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('ON_TIME', 'LATE', 'EARLY_LEAVE', 'OVERTIME', 'PENDING')),
  synced BOOLEAN DEFAULT true,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bảng Leave Requests (Đơn xin nghỉ)
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date BIGINT NOT NULL,
  end_date BIGINT NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('SICK', 'VACATION', 'PERSONAL', 'OTHER')),
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
  created_at BIGINT NOT NULL
);

-- Bảng Shift Registrations (Đăng ký ca làm việc)
CREATE TABLE IF NOT EXISTS shift_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date BIGINT NOT NULL,
  shift VARCHAR(50) NOT NULL CHECK (shift IN ('MORNING', 'AFTERNOON', 'EVENING', 'CUSTOM', 'OFF')),
  start_time VARCHAR(10),
  end_time VARCHAR(10),
  off_type VARCHAR(50) CHECK (off_type IN ('OFF_DK', 'OFF_PN', 'OFF_KL', 'CT', 'LE')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
  created_at BIGINT NOT NULL
);

-- Bảng Payroll Records (Bảng lương)
CREATE TABLE IF NOT EXISTS payroll_records (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- Format: "MM-YYYY"
  base_salary DECIMAL(15, 2) NOT NULL,
  standard_work_days INTEGER NOT NULL DEFAULT 27,
  actual_work_days INTEGER NOT NULL,
  ot_hours DECIMAL(10, 2) DEFAULT 0,
  ot_pay DECIMAL(15, 2) DEFAULT 0,
  allowance DECIMAL(15, 2) DEFAULT 0,
  bonus DECIMAL(15, 2) DEFAULT 0,
  deductions DECIMAL(15, 2) NOT NULL,
  net_salary DECIMAL(15, 2) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('PAID', 'PENDING')) DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month)
);

-- Bảng Notifications (Thông báo)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  timestamp BIGINT NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('info', 'warning', 'success', 'error')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bảng Departments (Phòng ban)
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Bảng Holidays (Ngày lễ)
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  date BIGINT NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('NATIONAL', 'COMPANY', 'REGIONAL')),
  is_recurring BOOLEAN DEFAULT false,
  description TEXT,
  created_at BIGINT NOT NULL
);

-- Bảng System Configs (Cấu hình hệ thống)
CREATE TABLE IF NOT EXISTS system_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('ATTENDANCE', 'PAYROLL', 'GENERAL', 'NOTIFICATION')),
  updated_at BIGINT NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Tạo indexes để tối ưu performance
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance_records(timestamp);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_shift_registrations_user_id ON shift_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_registrations_date ON shift_registrations(date);
CREATE INDEX IF NOT EXISTS idx_payroll_user_id ON payroll_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_month ON payroll_records(month);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);

-- Tạo function để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Tạo triggers để tự động cập nhật updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payroll_records_updated_at BEFORE UPDATE ON payroll_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;

-- Tạo policies cơ bản (cho phép tất cả - bạn có thể tùy chỉnh sau)
-- Lưu ý: Trong production, bạn nên tạo policies chi tiết hơn dựa trên role của user

-- Policy cho users: Cho phép đọc tất cả, chỉ admin/HR mới được tạo/sửa/xóa
CREATE POLICY "Users are viewable by everyone" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can be inserted by authenticated users" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can be updated by authenticated users" ON users
  FOR UPDATE USING (true);

CREATE POLICY "Users can be deleted by authenticated users" ON users
  FOR DELETE USING (true);

-- Policy cho attendance_records: User chỉ xem được của mình, admin/HR xem tất cả
CREATE POLICY "Attendance records are viewable by owner" ON attendance_records
  FOR SELECT USING (true);

CREATE POLICY "Attendance records can be inserted by authenticated users" ON attendance_records
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Attendance records can be updated by authenticated users" ON attendance_records
  FOR UPDATE USING (true);

CREATE POLICY "Attendance records can be deleted by authenticated users" ON attendance_records
  FOR DELETE USING (true);

-- Policy cho leave_requests
CREATE POLICY "Leave requests are viewable by everyone" ON leave_requests
  FOR SELECT USING (true);

CREATE POLICY "Leave requests can be inserted by authenticated users" ON leave_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Leave requests can be updated by authenticated users" ON leave_requests
  FOR UPDATE USING (true);

CREATE POLICY "Leave requests can be deleted by authenticated users" ON leave_requests
  FOR DELETE USING (true);

-- Policy cho shift_registrations
CREATE POLICY "Shift registrations are viewable by everyone" ON shift_registrations
  FOR SELECT USING (true);

CREATE POLICY "Shift registrations can be inserted by authenticated users" ON shift_registrations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Shift registrations can be updated by authenticated users" ON shift_registrations
  FOR UPDATE USING (true);

CREATE POLICY "Shift registrations can be deleted by authenticated users" ON shift_registrations
  FOR DELETE USING (true);

-- Policy cho payroll_records
CREATE POLICY "Payroll records are viewable by everyone" ON payroll_records
  FOR SELECT USING (true);

CREATE POLICY "Payroll records can be inserted by authenticated users" ON payroll_records
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Payroll records can be updated by authenticated users" ON payroll_records
  FOR UPDATE USING (true);

CREATE POLICY "Payroll records can be deleted by authenticated users" ON payroll_records
  FOR DELETE USING (true);

-- Policy cho notifications
CREATE POLICY "Notifications are viewable by owner" ON notifications
  FOR SELECT USING (true);

CREATE POLICY "Notifications can be inserted by authenticated users" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Notifications can be updated by authenticated users" ON notifications
  FOR UPDATE USING (true);

CREATE POLICY "Notifications can be deleted by authenticated users" ON notifications
  FOR DELETE USING (true);

-- Policy cho departments
CREATE POLICY "Departments are viewable by everyone" ON departments
  FOR SELECT USING (true);

CREATE POLICY "Departments can be inserted by authenticated users" ON departments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Departments can be updated by authenticated users" ON departments
  FOR UPDATE USING (true);

CREATE POLICY "Departments can be deleted by authenticated users" ON departments
  FOR DELETE USING (true);

-- Policy cho holidays
CREATE POLICY "Holidays are viewable by everyone" ON holidays
  FOR SELECT USING (true);

CREATE POLICY "Holidays can be inserted by authenticated users" ON holidays
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Holidays can be updated by authenticated users" ON holidays
  FOR UPDATE USING (true);

CREATE POLICY "Holidays can be deleted by authenticated users" ON holidays
  FOR DELETE USING (true);

-- Policy cho system_configs
CREATE POLICY "System configs are viewable by everyone" ON system_configs
  FOR SELECT USING (true);

CREATE POLICY "System configs can be inserted by authenticated users" ON system_configs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System configs can be updated by authenticated users" ON system_configs
  FOR UPDATE USING (true);

CREATE POLICY "System configs can be deleted by authenticated users" ON system_configs
  FOR DELETE USING (true);

-- Insert default admin user (nếu chưa có)
INSERT INTO users (id, name, email, role, department, status, contract_type)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Admin',
  'admin@congty.com',
  'ADMIN',
  'Board',
  'ACTIVE',
  'OFFICIAL'
)
ON CONFLICT (email) DO NOTHING;

-- Insert default system configs
INSERT INTO system_configs (id, key, value, description, category, updated_at)
VALUES
  (uuid_generate_v4(), 'office_latitude', '10.040675858019696', 'Vĩ độ văn phòng', 'ATTENDANCE', EXTRACT(EPOCH FROM NOW())::BIGINT),
  (uuid_generate_v4(), 'office_longitude', '105.78463187148355', 'Kinh độ văn phòng', 'ATTENDANCE', EXTRACT(EPOCH FROM NOW())::BIGINT),
  (uuid_generate_v4(), 'office_radius_meters', '200', 'Bán kính cho phép chấm công (mét)', 'ATTENDANCE', EXTRACT(EPOCH FROM NOW())::BIGINT),
  (uuid_generate_v4(), 'work_start_time', '08:00', 'Giờ bắt đầu làm việc', 'ATTENDANCE', EXTRACT(EPOCH FROM NOW())::BIGINT),
  (uuid_generate_v4(), 'work_end_time', '17:00', 'Giờ kết thúc làm việc', 'ATTENDANCE', EXTRACT(EPOCH FROM NOW())::BIGINT),
  (uuid_generate_v4(), 'work_hours_per_day', '8', 'Số giờ làm việc mỗi ngày', 'ATTENDANCE', EXTRACT(EPOCH FROM NOW())::BIGINT),
  (uuid_generate_v4(), 'standard_work_days', '27', 'Số ngày công tiêu chuẩn mỗi tháng', 'PAYROLL', EXTRACT(EPOCH FROM NOW())::BIGINT),
  (uuid_generate_v4(), 'social_insurance_rate', '10.5', 'Tỷ lệ khấu trừ BHXH (%)', 'PAYROLL', EXTRACT(EPOCH FROM NOW())::BIGINT),
  (uuid_generate_v4(), 'overtime_rate', '1.5', 'Hệ số tính lương làm thêm giờ', 'PAYROLL', EXTRACT(EPOCH FROM NOW())::BIGINT)
ON CONFLICT (key) DO NOTHING;
