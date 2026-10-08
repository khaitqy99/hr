-- Phiên đăng nhập theo thiết bị (OTP + localStorage, không dùng auth.uid()).
-- RLS mở giống push_subscriptions: client anon tự quản phiên của user trong bảng users.

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_label TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_last_seen
  ON public.user_sessions (user_id, last_seen_at DESC);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User sessions are viewable by everyone" ON public.user_sessions;
DROP POLICY IF EXISTS "User sessions can be inserted by anyone" ON public.user_sessions;
DROP POLICY IF EXISTS "User sessions can be updated by anyone" ON public.user_sessions;
DROP POLICY IF EXISTS "User sessions can be deleted by anyone" ON public.user_sessions;

CREATE POLICY "User sessions are viewable by everyone"
  ON public.user_sessions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "User sessions can be inserted by anyone"
  ON public.user_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "User sessions can be updated by anyone"
  ON public.user_sessions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "User sessions can be deleted by anyone"
  ON public.user_sessions FOR DELETE
  TO anon, authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sessions TO anon, authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
EXCEPTION WHEN SQLSTATE '42710' THEN NULL;
END $$;

ALTER TABLE public.user_sessions REPLICA IDENTITY FULL;
