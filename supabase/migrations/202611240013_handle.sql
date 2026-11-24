-- Horizon：账号名（handle，不可修改）+ 账号页改造
-- 账号名用于登录（账号名 / HorizonID / 邮箱三者之一），设置一次后不可更改。
-- 可重复执行。

alter table public.profiles
  add column if not exists handle text,
  add column if not exists handle_set_at timestamptz;

create unique index if not exists profiles_handle_key on public.profiles (lower(handle));

alter table public.profiles drop constraint if exists profiles_handle_check;
alter table public.profiles
  add constraint profiles_handle_check
  check (handle is null or handle ~ '^[A-Za-z0-9_]{3,20}$');

-- 设置账号名：只能设置一次
create or replace function public.set_handle(new_handle text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur text;
begin
  if auth.uid() is null then raise exception 'not_logged_in'; end if;
  if new_handle !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'invalid_handle'; end if;

  select handle into cur from public.profiles where id = auth.uid();
  if cur is not null then raise exception 'handle_locked'; end if;

  begin
    update public.profiles
       set handle = lower(new_handle),
           handle_set_at = now()
     where id = auth.uid();
  exception when unique_violation then
    raise exception 'handle_taken';
  end;
end;
$$;

grant execute on function public.set_handle(text) to authenticated;

-- 登录用：按账号名或 HorizonID 查人（邮箱由客户端直接走 Auth）
create or replace function public.find_for_login(identifier text)
returns table (id uuid, username text, handle text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.username, p.handle
    from public.profiles p
   where (identifier ~ '^[0-9]{5,}$' and p.horizon_id = identifier::bigint)
      or (identifier !~ '^[0-9]{5,}$' and lower(p.handle) = lower(identifier))
   limit 1;
$$;

grant execute on function public.find_for_login(text) to authenticated;

-- 自检
select horizon_id, username, handle, id_searchable
  from public.profiles
 order by horizon_id
 limit 10;
