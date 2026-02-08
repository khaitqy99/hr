-- Bật Realtime cho tất cả bảng cần sync real-time
-- Chạy trong Supabase Dashboard → SQL Editor, hoặc: supabase db push
-- Idempotent: bỏ qua nếu bảng đã có trong publication

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_registrations;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payroll_records;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.departments;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.holidays;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.system_configs;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL;
END $$;

-- REPLICA IDENTITY FULL: payload đầy đủ old/new row trên UPDATE/DELETE
ALTER TABLE public.attendance_records REPLICA IDENTITY FULL;
ALTER TABLE public.shift_registrations REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.payroll_records REPLICA IDENTITY FULL;
ALTER TABLE public.departments REPLICA IDENTITY FULL;
ALTER TABLE public.holidays REPLICA IDENTITY FULL;
ALTER TABLE public.system_configs REPLICA IDENTITY FULL;
