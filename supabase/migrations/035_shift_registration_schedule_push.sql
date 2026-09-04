-- Thông báo đẩy khi cửa sổ đăng ký ca mở, và trước khi đóng 30 phút.
-- Cron mỗi phút (Asia/Ho_Chi_Minh). INSERT notifications → trigger send-web-push có sẵn.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS private.shift_reg_schedule_push_log (
  kind text NOT NULL CHECK (kind IN ('open', 'close_warn')),
  occurrence_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, occurrence_key)
);

COMMENT ON TABLE private.shift_reg_schedule_push_log IS
  'Chống gửi trùng thông báo lịch đăng ký ca (mỗi lần mở / nhắc đóng).';

CREATE OR REPLACE FUNCTION private.claim_shift_reg_push(p_kind text, p_occurrence_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, pg_temp
AS $$
BEGIN
  INSERT INTO private.shift_reg_schedule_push_log (kind, occurrence_key)
  VALUES (p_kind, p_occurrence_key)
  ON CONFLICT DO NOTHING;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION private.fanout_shift_reg_push(
  p_title text,
  p_message text,
  p_type text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  inserted integer;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, read, timestamp, type)
  SELECT
    u.id,
    p_title,
    p_message,
    false,
    (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint,
    p_type
  FROM public.users u
  WHERE COALESCE(u.status, 'ACTIVE') = 'ACTIVE'
    AND u.role IN ('EMPLOYEE', 'MANAGER');

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

CREATE OR REPLACE FUNCTION private.dispatch_shift_registration_schedule_pushes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
DECLARE
  raw_schedule text;
  schedule jsonb;
  mode text;
  now_vn timestamp;
  week_start timestamp;
  start_day integer;
  end_day integer;
  start_time time;
  end_time time;
  open_ts timestamp;
  close_ts timestamp;
  warn_ts timestamp;
  enable_ms bigint;
  disable_ms bigint;
  close_label text;
BEGIN
  SELECT value INTO raw_schedule
  FROM public.system_configs
  WHERE key = 'shift_registration_schedule';

  IF raw_schedule IS NULL OR raw_schedule = '' THEN
    RETURN;
  END IF;

  BEGIN
    schedule := raw_schedule::jsonb;
  EXCEPTION WHEN others THEN
    RETURN;
  END;

  mode := COALESCE(schedule->>'mode', 'manual');
  now_vn := timezone('Asia/Ho_Chi_Minh', clock_timestamp());

  IF mode = 'weekly' THEN
    start_day := NULLIF(schedule #>> '{weekly,startDay}', '')::integer;
    end_day := NULLIF(schedule #>> '{weekly,endDay}', '')::integer;
    BEGIN
      start_time := NULLIF(schedule #>> '{weekly,startTime}', '')::time;
      end_time := NULLIF(schedule #>> '{weekly,endTime}', '')::time;
    EXCEPTION WHEN others THEN
      RETURN;
    END;

    IF start_day IS NULL OR end_day IS NULL OR start_time IS NULL OR end_time IS NULL THEN
      RETURN;
    END IF;
    IF start_day < 1 OR start_day > 7 OR end_day < 1 OR end_day > 7 THEN
      RETURN;
    END IF;

    week_start := date_trunc('week', now_vn);
    open_ts := week_start + make_interval(days => start_day - 1) + start_time;
    close_ts := week_start + make_interval(days => end_day - 1) + end_time;
    IF close_ts <= open_ts THEN
      close_ts := close_ts + interval '7 days';
    END IF;
    warn_ts := close_ts - interval '30 minutes';

    -- Cùng tuần hiện tại
    IF now_vn >= open_ts AND now_vn < open_ts + interval '2 minutes' THEN
      IF private.claim_shift_reg_push('open', to_char(open_ts, 'YYYY-MM-DD"T"HH24:MI')) THEN
        PERFORM private.fanout_shift_reg_push(
          'Đăng ký ca đã mở',
          'Cửa sổ đăng ký ca đang mở. Vào app để đăng ký hoặc sửa ca.',
          'info'
        );
      END IF;
    END IF;

    IF warn_ts > open_ts AND now_vn >= warn_ts AND now_vn < warn_ts + interval '2 minutes' THEN
      close_label := to_char(close_ts, 'HH24:MI ngày FMDD/FMMM');
      IF private.claim_shift_reg_push('close_warn', to_char(close_ts, 'YYYY-MM-DD"T"HH24:MI')) THEN
        PERFORM private.fanout_shift_reg_push(
          'Đăng ký ca sắp đóng',
          'Còn 30 phút nữa đăng ký ca sẽ khóa (' || close_label || '). Hãy đăng ký trước khi hết giờ.',
          'warning'
        );
      END IF;
    END IF;

    -- Cửa sổ tuần trước (khi đóng sang tuần mới, vd T6 → T2)
    open_ts := open_ts - interval '7 days';
    close_ts := close_ts - interval '7 days';
    warn_ts := close_ts - interval '30 minutes';

    IF now_vn >= open_ts AND now_vn < open_ts + interval '2 minutes' THEN
      IF private.claim_shift_reg_push('open', to_char(open_ts, 'YYYY-MM-DD"T"HH24:MI')) THEN
        PERFORM private.fanout_shift_reg_push(
          'Đăng ký ca đã mở',
          'Cửa sổ đăng ký ca đang mở. Vào app để đăng ký hoặc sửa ca.',
          'info'
        );
      END IF;
    END IF;

    IF warn_ts > open_ts AND now_vn >= warn_ts AND now_vn < warn_ts + interval '2 minutes' THEN
      close_label := to_char(close_ts, 'HH24:MI ngày FMDD/FMMM');
      IF private.claim_shift_reg_push('close_warn', to_char(close_ts, 'YYYY-MM-DD"T"HH24:MI')) THEN
        PERFORM private.fanout_shift_reg_push(
          'Đăng ký ca sắp đóng',
          'Còn 30 phút nữa đăng ký ca sẽ khóa (' || close_label || '). Hãy đăng ký trước khi hết giờ.',
          'warning'
        );
      END IF;
    END IF;

  ELSIF mode = 'window' THEN
    enable_ms := NULLIF(schedule->>'enableAt', '')::bigint;
    disable_ms := NULLIF(schedule->>'disableAt', '')::bigint;
    IF enable_ms IS NULL AND disable_ms IS NULL THEN
      RETURN;
    END IF;

    IF enable_ms IS NOT NULL THEN
      open_ts := timezone('Asia/Ho_Chi_Minh', to_timestamp(enable_ms / 1000.0));
      IF now_vn >= open_ts AND now_vn < open_ts + interval '2 minutes' THEN
        IF private.claim_shift_reg_push('open', to_char(open_ts, 'YYYY-MM-DD"T"HH24:MI')) THEN
          PERFORM private.fanout_shift_reg_push(
            'Đăng ký ca đã mở',
            'Cửa sổ đăng ký ca đang mở. Vào app để đăng ký hoặc sửa ca.',
            'info'
          );
        END IF;
      END IF;
    END IF;

    IF disable_ms IS NOT NULL THEN
      close_ts := timezone('Asia/Ho_Chi_Minh', to_timestamp(disable_ms / 1000.0));
      warn_ts := close_ts - interval '30 minutes';
      IF (enable_ms IS NULL OR warn_ts > timezone('Asia/Ho_Chi_Minh', to_timestamp(enable_ms / 1000.0)))
         AND now_vn >= warn_ts AND now_vn < warn_ts + interval '2 minutes' THEN
        close_label := to_char(close_ts, 'HH24:MI ngày FMDD/FMMM');
        IF private.claim_shift_reg_push('close_warn', to_char(close_ts, 'YYYY-MM-DD"T"HH24:MI')) THEN
          PERFORM private.fanout_shift_reg_push(
            'Đăng ký ca sắp đóng',
            'Còn 30 phút nữa đăng ký ca sẽ khóa (' || close_label || '). Hãy đăng ký trước khi hết giờ.',
            'warning'
          );
        END IF;
      END IF;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.claim_shift_reg_push(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.fanout_shift_reg_push(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.dispatch_shift_registration_schedule_pushes() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.claim_shift_reg_push(text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION private.fanout_shift_reg_push(text, text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION private.dispatch_shift_registration_schedule_pushes() FROM anon, authenticated;

SELECT cron.unschedule(j.jobid)
FROM cron.job j
WHERE j.jobname = 'shift-registration-schedule-push';

SELECT cron.schedule(
  'shift-registration-schedule-push',
  '* * * * *',
  $$SELECT private.dispatch_shift_registration_schedule_pushes();$$
);
