-- Gọi Edge Function send-web-push mỗi khi INSERT vào public.notifications
-- (thay Database Webhook Dashboard khi CLI không tạo được webhook)

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_web_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  edge_url text := 'https://iliquxkalxyieenqliby.supabase.co/functions/v1/send-web-push';
  -- anon key (public) — đủ vì function verify_jwt = false; gateway vẫn cần apikey
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsaXF1eGthbHh5aWVlbnFsaWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5OTU5MzYsImV4cCI6MjA4NTU3MTkzNn0.dcldjV6_bBt2TxG7nOcS-j1o-5faPrd4TQLGiYs0Q_k';
begin
  perform net.http_post(
    url := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon_key,
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW)
    )
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notifications_web_push on public.notifications;

create trigger trg_notifications_web_push
after insert on public.notifications
for each row
execute function public.notify_web_push_on_notification();
