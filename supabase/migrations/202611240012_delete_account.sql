-- Horizon：注销账号 + HorizonID 回收复用
-- 规则：账号注销后，它的 HorizonID 进入回收池；下一个注册的人优先占用池里最小的那个 ID。
-- 可重复执行。

-- ---------- 1. 回收池 ----------
create table if not exists public.id_recycle_pool (
  horizon_id bigint primary key,
  freed_at timestamptz not null default now()
);

alter table public.id_recycle_pool enable row level security;
-- 只给 service_role 用，不开放给普通用户
revoke all on public.id_recycle_pool from anon, authenticated;

-- ---------- 2. 删除资料时自动回收 ID ----------
create or replace function public.reclaim_horizon_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.horizon_id is not null then
    insert into public.id_recycle_pool (horizon_id)
    values (old.horizon_id)
    on conflict (horizon_id) do nothing;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_reclaim_horizon_id on public.profiles;
create trigger trg_reclaim_horizon_id
  after delete on public.profiles
  for each row
  execute function public.reclaim_horizon_id();

-- ---------- 3. 注册时优先用回收池 ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reusable bigint;
  uname text;
begin
  uname := new.raw_user_meta_data ->> 'username';

  -- 先看有没有被注销后空出来的 ID（取最小的一个）
  select horizon_id into reusable
    from public.id_recycle_pool
   order by horizon_id
   limit 1
   for update skip locked;

  if reusable is not null then
    delete from public.id_recycle_pool where horizon_id = reusable;
    insert into public.profiles (id, username, id_searchable, horizon_id)
    values (new.id, uname, false, reusable);
  else
    insert into public.profiles (id, username, id_searchable)
    values (new.id, uname, false);
  end if;

  return new;
end;
$$;

-- ---------- 4. 查看回收池（自检） ----------
select count(*) as recycled_ids from public.id_recycle_pool;

-- ---------- 5. 当前 ID 分布（自检） ----------
select min(horizon_id) as min_id, max(horizon_id) as max_id, count(*) as users
  from public.profiles;
