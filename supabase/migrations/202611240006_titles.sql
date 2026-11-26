-- Horizon：ID 可见性 + 称号系统
-- 规则：
--   * profiles.id_searchable：是否允许别人通过 HorizonID 找到自己（默认 true）
--     —— horizon_id = 100001 的用户不受此开关限制（永远可被找到）
--   * user_titles：称号表，一个人可以有多个称号；只有 100001 可以授予
--   * profiles.shown_title：本人选择「显示哪个称号」（null = 不显示）
-- 可重复执行。

-- ---------- 1. ID 可见性 ----------
alter table public.profiles
  add column if not exists id_searchable boolean not null default true;

-- 按 ID 查人：尊重对方的开关，但 100001 例外
create or replace function public.find_by_horizon_id(hid bigint)
returns table (id uuid, username text, avatar_url text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.username, p.avatar_url
    from public.profiles p
   where p.horizon_id = hid
     and (p.id_searchable = true or p.horizon_id = 100001)
   limit 1;
$$;

grant execute on function public.find_by_horizon_id(bigint) to authenticated;

-- ---------- 2. 称号表 ----------
create table if not exists public.user_titles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 10),
  gradient boolean not null default false,
  gradient_from text,
  gradient_to text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists user_titles_user_idx on public.user_titles (user_id);

alter table public.profiles
  add column if not exists shown_title uuid references public.user_titles (id) on delete set null;

-- ---------- 3. 权限 ----------
alter table public.user_titles enable row level security;

drop policy if exists "titles read all" on public.user_titles;
create policy "titles read all"
  on public.user_titles for select to authenticated
  using (true);

-- 只有 100001 能发称号
create or replace function public.is_owner()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and horizon_id = 100001
  );
$$;
grant execute on function public.is_owner() to authenticated;

drop policy if exists "titles insert owner" on public.user_titles;
create policy "titles insert owner"
  on public.user_titles for insert to authenticated
  with check (public.is_owner());

drop policy if exists "titles delete owner" on public.user_titles;
create policy "titles delete owner"
  on public.user_titles for delete to authenticated
  using (public.is_owner());

grant select, insert, delete on public.user_titles to authenticated;
grant update (shown_title, id_searchable) on public.profiles to authenticated;

-- ---------- 4. 授予称号（按对方 HorizonID） ----------
create or replace function public.grant_title(
  target_horizon_id bigint,
  new_title text,
  use_gradient boolean default false,
  from_hex text default null,
  to_hex text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  new_id uuid;
begin
  if not public.is_owner() then
    raise exception 'not_allowed';
  end if;
  if new_title is null or char_length(trim(new_title)) = 0 or char_length(new_title) > 10 then
    raise exception 'invalid_title';
  end if;

  select id into target_id from public.profiles where horizon_id = target_horizon_id;
  if target_id is null then
    raise exception 'user_not_found';
  end if;

  insert into public.user_titles (user_id, title, gradient, gradient_from, gradient_to, created_by)
  values (target_id, trim(new_title), use_gradient, from_hex, to_hex, auth.uid())
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.grant_title(bigint, text, boolean, text, text) to authenticated;

-- ---------- 5. 读取用视图（谁显示了哪个称号） ----------
-- 0.5.1：只在视图还不存在时建。0009 已经把它换成了新的列，
-- 以前这里用 create or replace，0009 之后再执行本文件会报「cannot drop columns from view」
do $$
begin
  if to_regclass('public.profile_titles') is null then
    create view public.profile_titles with (security_invoker = true) as
    select p.id as user_id,
           p.username,
           p.horizon_id,
           t.title,
           t.gradient,
           t.gradient_from,
           t.gradient_to,
           p.shown_title
      from public.profiles p
      left join public.user_titles t on t.id = p.shown_title;
  end if;
end
$$;

revoke all on public.profile_titles from anon;
grant select on public.profile_titles to authenticated;

-- ---------- 6. 自检 ----------
select count(*) as profiles,
       count(*) filter (where id_searchable) as searchable,
       (select count(*) from public.user_titles) as titles
  from public.profiles;
