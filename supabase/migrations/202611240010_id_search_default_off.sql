-- Horizon：ID 查找默认关闭
-- 之前是默认开启；改成默认关闭，并把现有账号也统一关掉（用户可在「好友」页自己打开）。
-- 可重复执行。

alter table public.profiles
  alter column id_searchable set default false;

update public.profiles
   set id_searchable = false
 where id_searchable is distinct from false;

-- 按 ID 查人：开关关闭时查不到（100001 也一样，开关对所有人有效）
create or replace function public.find_by_horizon_id(hid bigint)
returns table (id uuid, username text, avatar_url text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.username, p.avatar_url
    from public.profiles p
   where p.horizon_id = hid
     and p.id_searchable = true
   limit 1;
$$;

grant execute on function public.find_by_horizon_id(bigint) to authenticated;

-- 自检
select count(*) as total,
       count(*) filter (where id_searchable) as searchable
  from public.profiles;
