-- Horizon：让 ID 可见性开关对 100001 也生效
-- （之前的版本里 100001 永远可被搜到；现在改成所有人一视同仁）
-- 可重复执行。

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

-- 自检：看看每个账号的开关状态
select horizon_id, username, id_searchable
  from public.profiles
 order by horizon_id
 limit 20;
