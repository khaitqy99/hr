-- Cho phép chấm công ra/vào nghỉ trưa (LUNCH_OUT / LUNCH_IN)
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_type_check;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_type_check
  CHECK (type IN ('CHECK_IN', 'CHECK_OUT', 'LUNCH_OUT', 'LUNCH_IN'));

COMMENT ON COLUMN attendance_records.type IS 'CHECK_IN, CHECK_OUT, LUNCH_OUT (ra trưa), LUNCH_IN (vào sau trưa)';
