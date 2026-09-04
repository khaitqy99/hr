-- Chỉ tự stamp reviewed_at khi INSERT ca đã duyệt, hoặc khi status đổi sang duyệt/từ chối.
-- Sửa nhầm: UPDATE reviewed_at = NULL bị trigger ghi lại giờ hiện tại.

CREATE OR REPLACE FUNCTION public.tg_shift_registrations_reviewed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  now_ms bigint := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
BEGIN
  IF NEW.status NOT IN ('APPROVED', 'REJECTED') THEN
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
    RETURN NEW;
  END IF;

  IF NEW.reviewed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.reviewed_at := COALESCE(NEW.updated_at, NEW.created_at, now_ms);
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.updated_at IS NOT NULL AND NEW.updated_at IS DISTINCT FROM NEW.created_at THEN
      NEW.reviewed_at := NEW.updated_at;
    ELSE
      NEW.reviewed_at := now_ms;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shift_registrations_reviewed_at ON public.shift_registrations;

-- Gỡ 14 mốc giả do migration trước stamp lại lúc sửa dữ liệu (~15:08:56 VN 04/09/2026)
UPDATE public.shift_registrations
SET reviewed_at = NULL
WHERE updated_at IS NULL
  AND reviewed_by IS NULL
  AND reviewed_at >= (EXTRACT(EPOCH FROM timestamptz '2026-09-04 15:08:50+07') * 1000)::bigint
  AND reviewed_at <  (EXTRACT(EPOCH FROM timestamptz '2026-09-04 15:09:10+07') * 1000)::bigint;

CREATE TRIGGER trg_shift_registrations_reviewed_at
BEFORE INSERT OR UPDATE OF status, reviewed_at, updated_at ON public.shift_registrations
FOR EACH ROW
EXECUTE FUNCTION public.tg_shift_registrations_reviewed_at();

NOTIFY pgrst, 'reload schema';
