-- Push subscriptions table for Web Push notifications
-- Idempotent: safe to re-run (drops existing policies/trigger first)
-- App uses OTP login (no Supabase Auth), so anon can manage subscriptions like other tables

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  platform text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS set_push_subscriptions_updated_at ON public.push_subscriptions;

CREATE TRIGGER set_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can select own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;

-- Allow anon to manage subscriptions (app uses OTP, no Supabase Auth session)
-- Same pattern as users/notifications in migration 006
CREATE POLICY "push_subscriptions_select"
  ON public.push_subscriptions
  FOR SELECT
  USING (true);

CREATE POLICY "push_subscriptions_insert"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "push_subscriptions_update"
  ON public.push_subscriptions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "push_subscriptions_delete"
  ON public.push_subscriptions
  FOR DELETE
  USING (true);
