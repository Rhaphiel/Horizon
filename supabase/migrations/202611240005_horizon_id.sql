-- Horizon：HorizonID（按注册顺序分配，可用于登录 / 搜索 / 加好友）
-- 规则：从 100001 开始自增；注册时由触发器自动分配；已有用户按 created_at 顺序回填。
-- 可重复执行。

-- ---------- 1. 序列 + 字段 ----------
create sequence if not exists public.horizon_id_seq start with 100001;

alter table public.profiles
  add column if not exists horizon_id bigint;

-- ---------- 2. 回填老用户（按注册顺序） ----------
with ordered as (
  select id, row_number() over (order by created_at, id) as rn
    from public.profiles
   where horizon_id is null
)
update public.profiles p
   set horizon_id = 100000 + ordered.rn
  from ordered
 where p.id = ordered.id;

-- ---------- 3. 默认值 / 序列对齐 / 唯一约束 ----------
alter table public.profiles
  alter column horizon_id set default nextval('public.horizon_id_seq');

select setval('public.horizon_id_seq',
              coalesce((select max(horizon_id) from public.profiles), 100000) + 1,
              false);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_horizon_id_key') then
    alter table public.profiles add constraint profiles_horizon_id_key unique (horizon_id);
  end if;
end $$;

-- ---------- 4. 注册时自动分配 ----------
create or replace function public.assign_horizon_id()
returns trigger
language plpgsql
as $$
begin
  if new.horizon_id is null then
    new.horizon_id := nextval('public.horizon_id_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_horizon_id on public.profiles;
create trigger trg_assign_horizon_id
  before insert on public.profiles
  for each row
  execute function public.assign_horizon_id();

-- ---------- 5. 按 ID 查人（好友搜索用，只暴露必要字段） ----------
create or replace function public.find_by_horizon_id(hid bigint)
returns table (id uuid, username text, avatar_url text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.username, p.avatar_url
    from public.profiles p
   where p.horizon_id = hid
   limit 1;
$$;

grant execute on function public.find_by_horizon_id(bigint) to authenticated;

-- ---------- 6. 自检 ----------
select count(*) as total,
       count(horizon_id) as with_id,
       min(horizon_id) as min_id,
       max(horizon_id) as max_id
  from public.profiles;
