-- Horizon 0.3：未读消息存数据库 / 群成员管理 / 清空聊天记录
-- 在 Supabase Dashboard → SQL Editor 里整段执行即可。可重复执行（幂等）。

-- ========== 1. 成员表新增两列 ==========
-- last_read_at：我读到哪里了（用来算未读数，换手机也不会丢）
-- cleared_at ：我清空聊天记录的时间（这个时间之前的消息，只对我隐藏）
alter table public.conversation_members
  add column if not exists last_read_at timestamptz not null default now();
alter table public.conversation_members
  add column if not exists cleared_at timestamptz not null default 'epoch';

-- ========== 2. 消息可见性：成员且消息晚于自己的清空时间 ==========
create or replace function public.can_read_message(conv uuid, ts timestamptz)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv and user_id = auth.uid() and ts > cleared_at
  );
$$;

drop policy if exists "members read messages" on public.messages;
drop policy if exists "members read uncleared messages" on public.messages;
create policy "members read uncleared messages" on public.messages
  for select to authenticated
  using (public.can_read_message(conversation_id, created_at));

-- ========== 3. 标记已读 / 清空聊天记录 ==========
create or replace function public.mark_conversation_read(conv uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;
  update public.conversation_members
     set last_read_at = now()
   where conversation_id = conv and user_id = auth.uid();
end;
$$;

create or replace function public.clear_conversation(conv uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;
  update public.conversation_members
     set cleared_at = now(), last_read_at = now()
   where conversation_id = conv and user_id = auth.uid();
  if not found then raise exception 'not_member'; end if;
end;
$$;

-- ========== 4. 每个聊天的未读数 + 最新一条消息（聊天列表用） ==========
create or replace function public.get_conversation_stats()
returns table (
  conversation_id uuid,
  unread bigint,
  last_message_at timestamptz,
  last_body text,
  last_sender_id uuid
)
language sql stable set search_path = public as $$
  select
    m.conversation_id,
    (select count(*) from public.messages x
       where x.conversation_id = m.conversation_id
         and x.created_at > m.last_read_at
         and x.created_at > m.cleared_at
         and x.sender_id <> m.user_id),
    (select max(x.created_at) from public.messages x
       where x.conversation_id = m.conversation_id
         and x.created_at > m.cleared_at),
    (select x.body from public.messages x
       where x.conversation_id = m.conversation_id
         and x.created_at > m.cleared_at
       order by x.created_at desc limit 1),
    (select x.sender_id from public.messages x
       where x.conversation_id = m.conversation_id
         and x.created_at > m.cleared_at
       order by x.created_at desc limit 1)
  from public.conversation_members m
  where m.user_id = auth.uid();
$$;

-- ========== 5. 群成员管理 ==========
-- 规则：只有群主可以加人、移人、解散；加的人必须是群主自己的好友；群最多 50 人。

create or replace function public.add_group_members(conv uuid, member_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  ids uuid[];
  uid uuid;
  cur int;
begin
  if me is null then raise exception 'not logged in'; end if;
  if not exists (select 1 from public.conversations where id = conv and type = 'group') then
    raise exception 'not_group';
  end if;
  if not exists (
    select 1 from public.conversation_members
    where conversation_id = conv and user_id = me and role = 'owner'
  ) then raise exception 'not_owner'; end if;

  select coalesce(array_agg(distinct x), '{}'::uuid[]) into ids
  from unnest(member_ids) as x where x <> me;
  if coalesce(array_length(ids, 1), 0) < 1 then raise exception 'bad member count'; end if;

  select count(*) into cur from public.conversation_members where conversation_id = conv;
  if cur + array_length(ids, 1) > 50 then raise exception 'group_full'; end if;

  foreach uid in array ids loop
    if not exists (
      select 1 from public.friendships
      where status = 'accepted'
        and ((requester = me and addressee = uid) or (requester = uid and addressee = me))
    ) then raise exception 'not_friends'; end if;
    if exists (
      select 1 from public.conversation_members where conversation_id = conv and user_id = uid
    ) then raise exception 'already_member'; end if;
    insert into public.conversation_members (conversation_id, user_id) values (conv, uid);
  end loop;
end;
$$;

create or replace function public.remove_group_member(conv uuid, member uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not logged in'; end if;
  if not exists (select 1 from public.conversations where id = conv and type = 'group') then
    raise exception 'not_group';
  end if;
  if not exists (
    select 1 from public.conversation_members
    where conversation_id = conv and user_id = me and role = 'owner'
  ) then raise exception 'not_owner'; end if;
  if member = me then raise exception 'cannot_remove_self'; end if;

  delete from public.conversation_members where conversation_id = conv and user_id = member;
  if not found then raise exception 'not_member'; end if;
end;
$$;

-- 退出群聊：普通成员直接退出；群主退出时，群主身份自动交给最早加入的成员；群里没人了就删除群
create or replace function public.leave_group(conv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_role text;
  next_owner uuid;
begin
  if me is null then raise exception 'not logged in'; end if;
  if not exists (select 1 from public.conversations where id = conv and type = 'group') then
    raise exception 'not_group';
  end if;

  select role into my_role from public.conversation_members
   where conversation_id = conv and user_id = me;
  if my_role is null then raise exception 'not_member'; end if;

  if my_role = 'owner' then
    select user_id into next_owner from public.conversation_members
     where conversation_id = conv and user_id <> me
     order by joined_at asc limit 1;
    if next_owner is null then
      delete from public.conversations where id = conv;
      return;
    end if;
    update public.conversation_members set role = 'owner'
     where conversation_id = conv and user_id = next_owner;
  end if;

  delete from public.conversation_members where conversation_id = conv and user_id = me;
end;
$$;

create or replace function public.dissolve_group(conv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not logged in'; end if;
  if not exists (select 1 from public.conversations where id = conv and type = 'group') then
    raise exception 'not_group';
  end if;
  if not exists (
    select 1 from public.conversation_members
    where conversation_id = conv and user_id = me and role = 'owner'
  ) then raise exception 'not_owner'; end if;

  delete from public.conversations where id = conv;   -- 成员和消息会级联删除
end;
$$;

-- ========== 6. 权限：只有登录用户能调用这些函数 ==========
revoke execute on function public.can_read_message(uuid, timestamptz) from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
revoke execute on function public.clear_conversation(uuid) from public, anon;
revoke execute on function public.get_conversation_stats() from public, anon;
revoke execute on function public.add_group_members(uuid, uuid[]) from public, anon;
revoke execute on function public.remove_group_member(uuid, uuid) from public, anon;
revoke execute on function public.leave_group(uuid) from public, anon;
revoke execute on function public.dissolve_group(uuid) from public, anon;

grant execute on function public.can_read_message(uuid, timestamptz) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.clear_conversation(uuid) to authenticated;
grant execute on function public.get_conversation_stats() to authenticated;
grant execute on function public.add_group_members(uuid, uuid[]) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.dissolve_group(uuid) to authenticated;

grant all on all tables in schema public to service_role;

-- ========== 7. 群被解散时，其他成员要能实时收到通知 ==========
do $$
begin
  begin alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object or undefined_object then null; end;
end
$$;

-- ========== 8. 自检：应该能看到 8 个新函数 ==========
select proname
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('can_read_message', 'mark_conversation_read', 'clear_conversation',
                   'get_conversation_stats', 'add_group_members', 'remove_group_member',
                   'leave_group', 'dissolve_group')
 order by proname;
