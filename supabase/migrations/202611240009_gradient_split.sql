-- Horizon：称号渐变 与 用户名渐变 分开设置
-- 之前只有一个 gradient 开关同时作用于两者；现在拆成两组字段。
-- 可重复执行。

alter table public.user_titles
  add column if not exists title_gradient boolean not null default false,
  add column if not exists title_from text,
  add column if not exists title_to text,
  add column if not exists name_gradient boolean not null default false,
  add column if not exists name_from text,
  add column if not exists name_to text;

-- 把老数据按原样复制到两组（保持现有外观不变）
update public.user_titles
   set title_gradient = gradient,
       title_from = gradient_from,
       title_to = gradient_to
 where title_from is null and title_to is null;

update public.user_titles
   set name_gradient = gradient,
       name_from = gradient_from,
       name_to = gradient_to
 where name_from is null and name_to is null;

-- 授予函数：增加两组参数（保留旧签名重载也行，这里直接换成新签名）
drop function if exists public.grant_title(bigint, text, boolean, text, text);

create or replace function public.grant_title(
  target_horizon_id bigint,
  new_title text,
  title_grad boolean default false,
  title_from_hex text default null,
  title_to_hex text default null,
  name_grad boolean default false,
  name_from_hex text default null,
  name_to_hex text default null
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

  insert into public.user_titles (
    user_id, title, gradient, gradient_from, gradient_to,
    title_gradient, title_from, title_to,
    name_gradient, name_from, name_to, created_by
  ) values (
    target_id, trim(new_title), title_grad, title_from_hex, title_to_hex,
    title_grad, title_from_hex, title_to_hex,
    name_grad, name_from_hex, name_to_hex, auth.uid()
  ) returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.grant_title(bigint, text, boolean, text, text, boolean, text, text) to authenticated;

grant update (
  title, gradient, gradient_from, gradient_to,
  title_gradient, title_from, title_to,
  name_gradient, name_from, name_to
) on public.user_titles to authenticated;

-- 视图要换列名，必须先删后建（create or replace 不允许改列名）
drop view if exists public.profile_titles;

create view public.profile_titles as
select p.id as user_id,
       p.username,
       p.horizon_id,
       t.title,
       t.title_gradient,
       t.title_from,
       t.title_to,
       t.name_gradient,
       t.name_from,
       t.name_to,
       p.shown_title
  from public.profiles p
  left join public.user_titles t on t.id = p.shown_title;

grant select on public.profile_titles to authenticated;

-- 自检
select column_name
  from information_schema.columns
 where table_schema = 'public' and table_name = 'user_titles'
   and column_name in ('title_gradient','name_gradient')
 order by column_name;
