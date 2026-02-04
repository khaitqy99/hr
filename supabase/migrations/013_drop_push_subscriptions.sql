-- Remove push notifications: drop push_subscriptions table (no longer used)
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
