-- Recreate push_subscriptions for Web Push (PWA)
-- RLS mở giống các bảng hiện có (OTP + localStorage user, không dùng auth.uid())

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);

DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Push subscriptions are viewable by everyone" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Push subscriptions can be inserted by anyone" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Push subscriptions can be updated by anyone" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Push subscriptions can be deleted by anyone" ON public.push_subscriptions;

CREATE POLICY "Push subscriptions are viewable by everyone"
  ON public.push_subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Push subscriptions can be inserted by anyone"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Push subscriptions can be updated by anyone"
  ON public.push_subscriptions FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Push subscriptions can be deleted by anyone"
  ON public.push_subscriptions FOR DELETE
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
