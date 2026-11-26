-- Horizon 0.5.1：注销账号 / HorizonID / 称号相关的修正
-- 在 Supabase Dashboard → SQL Editor 里整段执行即可。可重复执行（幂等）。
-- 需要先执行过 0014–0017。

-- ========== 1. 100001 不进回收池 ==========
-- 发称号的权限认的是 horizon_id = 100001。以前 100001 注销后会进回收池，下一个注册的人就成了管理员。
create or replace function public.reclaim_horizon_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.horizon_id is not null and old.horizon_id <> 100001 then
    insert into public.id_recycle_pool (horizon_id)
    values (old.horizon_id)
    on conflict (horizon_id) do nothing;
  end if;
  return old;
end;
$$;
revoke execute on function public.reclaim_horizon_id() from public, anon, authenticated;
delete from public.id_recycle_pool where horizon_id = 100001;

-- ========== 2. 注销账号：不再连带删掉他建的群 ==========
-- 以前 conversations.created_by 是 on delete cascade：建群的人一注销，整个群连同所有人的聊天记录都被删掉。
-- 现在改成 set null：群留下，群主转给最早入群的成员；群里没人了才删群。
alter table public.conversations alter column created_by drop not null;
alter table public.conversations drop constraint if exists conversations_created_by_fkey;
alter table public.conversations
  add constraint conversations_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

-- 私聊：对方注销后，他发的消息已经随账号删掉，人也不在了，留着只剩半边对话。
-- 注销时把他参与的私聊一起删掉（另一方会收到「聊天已删除」的事件，列表里随即消失）。
create or replace function public.profile_before_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.conversations c
   where c.type = 'dm'
     and exists (select 1 from public.conversation_members m
                  where m.conversation_id = c.id and m.user_id = old.id);
  return old;
end;
$$;
revoke execute on function public.profile_before_delete() from public, anon, authenticated;

drop trigger if exists trg_profile_before_delete on public.profiles;
create trigger trg_profile_before_delete
  before delete on public.profiles
  for each row execute function public.profile_before_delete();

-- 群主不在了（注销时成员行被级联删除，没有经过 leave_group 的转让）：转给最早入群的成员；没人了就删群
create or replace function public.member_owner_gone()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  next_owner uuid;
begin
  if old.role <> 'owner' then return old; end if;
  if not exists (select 1 from public.conversations where id = old.conversation_id and type = 'group') then
    return old;   -- 群正在被解散，或者是私聊
  end if;
  if exists (select 1 from public.conversation_members
              where conversation_id = old.conversation_id and role = 'owner') then
    return old;   -- leave_group 已经先转让过了
  end if;

  select user_id into next_owner
    from public.conversation_members
   where conversation_id = old.conversation_id
   order by joined_at, user_id
   limit 1;

  if next_owner is null then
    delete from public.conversations where id = old.conversation_id;
  else
    update public.conversation_members set role = 'owner'
     where conversation_id = old.conversation_id and user_id = next_owner;
  end if;
  return old;
end;
$$;
revoke execute on function public.member_owner_gone() from public, anon, authenticated;

drop trigger if exists trg_member_owner_gone on public.conversation_members;
create trigger trg_member_owner_gone
  after delete on public.conversation_members
  for each row execute function public.member_owner_gone();

-- ========== 3. 只能显示自己的称号 ==========
-- 称号表所有人可读，以前 shown_title 可以填任何人的称号 id，等于能把别人的称号挂到自己名字后面
create or replace function public.guard_shown_title()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.shown_title is not null
     and new.shown_title is distinct from old.shown_title
     and not exists (select 1 from public.user_titles t
                      where t.id = new.shown_title and t.user_id = new.id) then
    raise exception 'not_your_title';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_shown_title on public.profiles;
create trigger guard_shown_title
  before update of shown_title on public.profiles
  for each row execute function public.guard_shown_title();

-- 以前挂上的别人的称号：撤掉
update public.profiles p
   set shown_title = null
 where p.shown_title is not null
   and not exists (select 1 from public.user_titles t where t.id = p.shown_title and t.user_id = p.id);

-- ========== 4. 收紧没登录（anon）也能用的函数和视图 ==========
-- Supabase 默认把 public 里新建的函数、视图也开放给 anon；anon key 就在 APK 里，等于谁都能调。
-- find_for_login：输入 HorizonID 就能查出任何人的用户名和账号名，不管对方有没有关掉「ID 查找」。
-- App 和 login-by-username 都没有用到它，只留给后台（service_role）。
revoke execute on function public.find_for_login(text) from public, anon, authenticated;
grant execute on function public.find_for_login(text) to service_role;

revoke execute on function public.find_by_horizon_id(bigint) from public, anon;
grant execute on function public.find_by_horizon_id(bigint) to authenticated;

revoke execute on function public.grant_title(bigint, text, boolean, text, text, boolean, text, text) from public, anon;
grant execute on function public.grant_title(bigint, text, boolean, text, text, boolean, text, text) to authenticated;

revoke execute on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;

revoke execute on function public.set_handle(text) from public, anon;
grant execute on function public.set_handle(text) to authenticated;

revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- is_username_ok 用在 profiles 的检查约束里，App 用户改头像时也会用到，所以 authenticated 要保留
revoke execute on function public.is_username_ok(text) from public, anon;
grant execute on function public.is_username_ok(text) to authenticated, service_role;

-- profile_titles 视图：以前以视图所有者的身份查询（绕过行级安全），没登录也能读到所有人的用户名和 HorizonID。
-- 改成按查询者的权限执行；App 登录后读到的内容不变。
alter view public.profile_titles set (security_invoker = true);
revoke all on public.profile_titles from anon;
grant select on public.profile_titles to authenticated;

-- ========== 5. 自检 ==========
-- 应看到 guard_shown_title / trg_member_owner_gone / trg_profile_before_delete
select tgname, tgrelid::regclass as on_table
  from pg_trigger
 where tgname in ('guard_shown_title', 'trg_member_owner_gone', 'trg_profile_before_delete')
 order by tgname;

-- 应全部为 false
select has_function_privilege('anon', 'public.find_for_login(text)', 'execute')          as anon_find_for_login,
       has_function_privilege('authenticated', 'public.find_for_login(text)', 'execute') as user_find_for_login,
       has_table_privilege('anon', 'public.profile_titles', 'select')                    as anon_profile_titles,
       exists (select 1 from public.id_recycle_pool where horizon_id = 100001)           as owner_id_in_pool;
