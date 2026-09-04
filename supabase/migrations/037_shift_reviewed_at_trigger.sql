-- Tự ghi reviewed_at khi ca được duyệt/từ chối, và bổ sung mốc cho ca đã duyệt từ khi có cột tracking.

CREATE OR REPLACE FUNCTION public.tg_shift_registrations_reviewed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  now_ms bigint := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
BEGIN
  IF NEW.status IN ('APPROVED', 'REJECTED') THEN
    IF NEW.reviewed_at IS NULL THEN
      NEW.reviewed_at := COALESCE(NEW.updated_at, NEW.created_at, now_ms);
    END IF;
  ELSE
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shift_registrations_reviewed_at ON public.shift_registrations;
CREATE TRIGGER trg_shift_registrations_reviewed_at
BEFORE INSERT OR UPDATE OF status, reviewed_at, updated_at ON public.shift_registrations
FOR EACH ROW
EXECUTE FUNCTION public.tg_shift_registrations_reviewed_at();

-- Ca duyệt/từ chối từ khi bắt đầu lưu lịch sử mà client chưa ghi mốc
UPDATE public.shift_registrations
SET reviewed_at = COALESCE(updated_at, created_at)
WHERE status IN ('APPROVED', 'REJECTED')
  AND reviewed_at IS NULL
  AND created_at >= (EXTRACT(EPOCH FROM timestamptz '2026-09-01 00:00:00+07') * 1000)::bigint;

NOTIFY pgrst, 'reload schema';
