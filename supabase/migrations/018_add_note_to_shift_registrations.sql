-- Migration: Add note column to shift_registrations table
-- Purpose: Allow admin to add notes for each work shift day
-- Thêm cột note để lưu ghi chú cho từng ca làm việc

ALTER TABLE shift_registrations 
ADD COLUMN IF NOT EXISTS note TEXT;

COMMENT ON COLUMN shift_registrations.note IS 'Ghi chú cho ca làm việc (admin có thể thêm ghi chú cho từng ngày)';
