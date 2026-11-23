-- Horizon：用数据库触发器直接调用 Edge Function（替代 Dashboard 的 Webhooks UI）
-- 作用：messages 表每新增一行，就异步 POST 给 push-message 函数。
-- 可重复执行（幂等）。
--
-- 前提：项目已启用 pg_net（Supabase 默认可用）。
-- 如果你的 Dashboard 里能找到 Webhooks UI，用 UI 也行；找不到就用这份 SQL。

create extension if not exists pg_net with schema extensions;

create or replace function public.horizon_push_on_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://osbjqvdzmqcztsxbsuyc.supabase.co/functions/v1/push-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-webhook-secret', '2o0C1ihRT6RlBUdx9Dx6GCfBwrJKRW1zutsiPR0Ugvah'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'messages',
      'schema', 'public',
      'record', to_jsonb(NEW)
    ),
    timeout_milliseconds := 10000
  );
  return NEW;
end;
$$;

drop trigger if exists horizon_push_on_message on public.messages;
create trigger horizon_push_on_message
  after insert on public.messages
  for each row
  execute function public.horizon_push_on_message();

-- 自检：应看到触发器 horizon_push_on_message
select tgname as trigger_name, tgrelid::regclass as on_table, tgenabled
  from pg_trigger
 where tgrelid = 'public.messages'::regclass
   and not tgisinternal;
