-- Horizon：ID 查找默认关闭（加固）+ 允许改用户名（每天一次）
-- 可重复执行。

-- ---------- 1. 注册时显式写入 id_searchable = false ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, id_searchable)
  values (new.id, new.raw_user_meta_data ->> 'username', false);
  return new;
end;
$$;

-- ---------- 2. 用户名规则：字母 / 汉字 / 假名，不含符号与空格 ----------
create or replace function public.is_username_ok(u text)
returns boolean
language plpgsql
as $$
declare
  i int;
  ch text;
  cp int;
begin
  if u is null then return false; end if;
  if char_length(u) < 2 or char_length(u) > 20 then return false; end if;

  for i in 1..char_length(u) loop
    ch := substr(u, i, 1);
    cp := ascii(ch);

    -- 空格 / ASCII 标点
    if ch ~ '[\s!-/:-@\[-`{-~]' then return false; end if;
    -- 常见符号、箭头、emoji、变体选择符、零宽连接符
    if (cp between 8203 and 8205)
       or (cp between 8592 and 8703)
       or (cp between 9728 and 10175)
       or (cp between 65024 and 65039)
       or (cp between 127744 and 129791) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles
  add constraint profiles_username_check check (public.is_username_ok(username));

-- ---------- 3. 改名：每天一次（按 UTC+8 的自然日） ----------
alter table public.profiles
  add column if not exists username_changed_at timestamptz;

create or replace function public.change_username(new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  last_day date;
begin
  if auth.uid() is null then raise exception 'not_logged_in'; end if;
  if not public.is_username_ok(new_name) then raise exception 'invalid_username'; end if;

  select (username_changed_at at time zone 'Asia/Shanghai')::date
    into last_day
    from public.profiles where id = auth.uid();

  if last_day = (now() at time zone 'Asia/Shanghai')::date then
    raise exception 'once_per_day';
  end if;

  begin
    update public.profiles
       set username = new_name,
           username_changed_at = now()
     where id = auth.uid();
  exception when unique_violation then
    raise exception 'name_taken';
  end;
end;
$$;

grant execute on function public.change_username(text) to authenticated;
grant execute on function public.is_username_ok(text) to authenticated;

-- ---------- 4. 自检 ----------
select horizon_id, username, id_searchable, username_changed_at
  from public.profiles
 order by horizon_id
 limit 10;
