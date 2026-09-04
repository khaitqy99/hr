-- Cập nhật nội dung thông báo mở / sắp đóng đăng ký ca (thủ công + một lần + hàng tuần dùng chung copy).

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
  open_title text := 'Đăng ký ca đã mở';
  open_body text := 'Đăng ký ca đang mở. Vào app để đăng ký hoặc sửa ca làm việc.';
  close_title text := 'Đăng ký ca sắp đóng';
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

    IF now_vn >= open_ts AND now_vn < open_ts + interval '2 minutes' THEN
      IF private.claim_shift_reg_push('open', to_char(open_ts, 'YYYY-MM-DD"T"HH24:MI')) THEN
        PERFORM private.fanout_shift_reg_push(open_title, open_body, 'info');
      END IF;
    END IF;

    IF warn_ts > open_ts AND now_vn >= warn_ts AND now_vn < warn_ts + interval '2 minutes' THEN
      close_label := to_char(close_ts, 'HH24:MI ngày FMDD/FMMM');
      IF private.claim_shift_reg_push('close_warn', to_char(close_ts, 'YYYY-MM-DD"T"HH24:MI')) THEN
        PERFORM private.fanout_shift_reg_push(
          close_title,
          'Còn 30 phút nữa đăng ký ca sẽ khóa (' || close_label || '). Hãy đăng ký hoặc sửa ca trước khi hết giờ.',
          'warning'
        );
      END IF;
    END IF;

    open_ts := open_ts - interval '7 days';
    close_ts := close_ts - interval '7 days';
    warn_ts := close_ts - interval '30 minutes';

    IF now_vn >= open_ts AND now_vn < open_ts + interval '2 minutes' THEN
      IF private.claim_shift_reg_push('open', to_char(open_ts, 'YYYY-MM-DD"T"HH24:MI')) THEN
        PERFORM private.fanout_shift_reg_push(open_title, open_body, 'info');
      END IF;
    END IF;

    IF warn_ts > open_ts AND now_vn >= warn_ts AND now_vn < warn_ts + interval '2 minutes' THEN
      close_label := to_char(close_ts, 'HH24:MI ngày FMDD/FMMM');
      IF private.claim_shift_reg_push('close_warn', to_char(close_ts, 'YYYY-MM-DD"T"HH24:MI')) THEN
        PERFORM private.fanout_shift_reg_push(
          close_title,
          'Còn 30 phút nữa đăng ký ca sẽ khóa (' || close_label || '). Hãy đăng ký hoặc sửa ca trước khi hết giờ.',
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
          PERFORM private.fanout_shift_reg_push(open_title, open_body, 'info');
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
            close_title,
            'Còn 30 phút nữa đăng ký ca sẽ khóa (' || close_label || '). Hãy đăng ký hoặc sửa ca trước khi hết giờ.',
            'warning'
          );
        END IF;
      END IF;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.dispatch_shift_registration_schedule_pushes() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.dispatch_shift_registration_schedule_pushes() FROM anon, authenticated;
