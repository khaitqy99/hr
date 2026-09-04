-- Khi duyệt ca đã đăng ký, không được lấy created_at làm giờ duyệt.
-- INSERT ca sẵn APPROVED vẫn được stamp cùng lúc tạo.

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
  ELSIF NEW.updated_at IS NOT NULL AND NEW.updated_at IS DISTINCT FROM NEW.created_at THEN
    NEW.reviewed_at := NEW.updated_at;
  ELSE
    NEW.reviewed_at := now_ms;
  END IF;

  RETURN NEW;
END;
$$;

-- Gỡ mốc giả: copy giờ đăng ký sang giờ duyệt khi không có updated_at
UPDATE public.shift_registrations
SET reviewed_at = NULL
WHERE status IN ('APPROVED', 'REJECTED')
  AND reviewed_at IS NOT DISTINCT FROM created_at
  AND updated_at IS NULL
  AND reviewed_by IS NULL;

NOTIFY pgrst, 'reload schema';
