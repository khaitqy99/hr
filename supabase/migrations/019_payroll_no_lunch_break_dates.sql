-- Ngày (timestamp shift.date) được đánh dấu "không nghỉ trưa" khi tính lương theo giờ
ALTER TABLE payroll_records
ADD COLUMN IF NOT EXISTS no_lunch_break_dates JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN payroll_records.no_lunch_break_dates IS 'Mảng timestamp (BIGINT) các ngày ca CUSTOM không trừ 1h nghỉ trưa';
