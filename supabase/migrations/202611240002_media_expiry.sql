-- Horizon：多媒体消息 24 小时自动过期（阶段二 · 数据库部分）
-- 触发器：媒体消息插入时自动写 expires_at = created_at + 24h
-- 清理：由 Edge Function cleanup-media 负责（见 supabase/functions/cleanup-media）
-- 可重复执行。

-- ---------- 1. 触发器：自动写入过期时间 ----------
create or replace function public.set_media_expiry()
returns trigger
language plpgsql
as $$
begin
  if new.media_type is not null and new.media_type <> 'text' and new.expires_at is null then
    new.expires_at := coalesce(new.created_at, now()) + interval '24 hours';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_media_expiry on public.messages;
create trigger trg_set_media_expiry
  before insert on public.messages
  for each row
  execute function public.set_media_expiry();

-- ---------- 2. 待清理的行（给 Edge Function 用，也方便手动排查） ----------
create or replace view public.media_pending_cleanup as
select id, conversation_id, media_path, expires_at
  from public.messages
 where media_type <> 'text'
   and is_expired = false
   and media_path is not null
   and expires_at is not null
   and expires_at <= now()
 order by expires_at
 limit 500;

-- 只有 service_role 需要读这个视图；普通用户不需要
revoke all on public.media_pending_cleanup from anon, authenticated;

-- ---------- 3. 自检 ----------
select tgname, tgrelid::regclass as table_name
  from pg_trigger
 where tgname = 'trg_set_media_expiry';
