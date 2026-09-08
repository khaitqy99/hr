-- Ngày (timestamp) được đánh dấu "tăng ca không hệ số": giờ vượt chuẩn trả theo đơn giá giờ thường, không nhân overtime_rate
ALTER TABLE payroll_records
ADD COLUMN IF NOT EXISTS no_ot_rate_dates JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN payroll_records.no_ot_rate_dates IS 'Mảng timestamp (BIGINT) các ngày tăng ca trả theo đơn giá giờ thường (không nhân hệ số OT)';
