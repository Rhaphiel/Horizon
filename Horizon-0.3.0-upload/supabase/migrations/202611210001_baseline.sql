-- Horizon 基线：账号资料、好友、聊天、成员、消息 + 安全规则 + 创建私聊/群聊的函数
-- 这份脚本把"线上后台里手工建好的东西"写进仓库，之后能从零重建。
-- 全部写成可重复执行（幂等）：线上已经有的，重跑不会报错也不会丢数据。

-- ========== 1. 用户资料 ==========
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_key on public.profiles (lower(username));

alter table public.profiles enable row level security;
drop policy if exists "profiles are viewable by logged-in users" on public.profiles;
create policy "profiles are viewable by logged-in users"
  on public.profiles for select to authenticated using (true);
drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- 有人注册时自动建一行资料（用户名来自注册时带上的 username）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========== 2. 好友关系 ==========
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

alter table public.friendships enable row level security;
drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships
  for select to authenticated using (auth.uid() in (requester, addressee));
drop policy if exists "send friend requests" on public.friendships;
create policy "send friend requests" on public.friendships
  for insert to authenticated with check (auth.uid() = requester and status = 'pending');
drop policy if exists "accept requests sent to me" on public.friendships;
create policy "accept requests sent to me" on public.friendships
  for update to authenticated
  using (auth.uid() = addressee)
  with check (auth.uid() = addressee and status = 'accepted');
drop policy if exists "remove my friendships" on public.friendships;
create policy "remove my friendships" on public.friendships
  for delete to authenticated using (auth.uid() in (requester, addressee));

-- ========== 3. 聊天 / 成员 / 消息 ==========
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dm', 'group')),
  name text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conv_created_idx on public.messages (conversation_id, created_at desc);
create index if not exists conversation_members_user_idx on public.conversation_members (user_id);

-- "我是不是这个聊天的成员"（用 security definer 绕开行级安全，避免策略互相引用造成死循环）
create or replace function public.is_member(conv uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv and user_id = auth.uid()
  );
$$;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "members see conversation" on public.conversations;
create policy "members see conversation" on public.conversations
  for select to authenticated using (public.is_member(id));

drop policy if exists "members see members" on public.conversation_members;
create policy "members see members" on public.conversation_members
  for select to authenticated using (public.is_member(conversation_id));

drop policy if exists "members read messages" on public.messages;
create policy "members read messages" on public.messages
  for select to authenticated using (public.is_member(conversation_id));

drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_member(conversation_id));

-- ========== 4. 创建私聊 ==========
create or replace function public.create_dm(friend uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv uuid;
begin
  if me is null then raise exception 'not logged in'; end if;
  if not exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester = me and addressee = friend) or (requester = friend and addressee = me))
  ) then raise exception 'not friends'; end if;

  select c.id into conv from public.conversations c
  where c.type = 'dm'
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = me)
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = friend)
  limit 1;
  if conv is not null then return conv; end if;

  insert into public.conversations (type, created_by) values ('dm', me) returning id into conv;
  insert into public.conversation_members (conversation_id, user_id, role)
  values (conv, me, 'owner'), (conv, friend, 'member');
  return conv;
end;
$$;

-- ========== 5. 创建群聊 ==========
create or replace function public.create_group(group_name text, member_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv uuid;
  uid uuid;
  ids uuid[];
begin
  if me is null then raise exception 'not logged in'; end if;
  group_name := btrim(group_name);
  if group_name is null or char_length(group_name) not between 1 and 30 then
    raise exception 'bad group name';
  end if;

  select coalesce(array_agg(distinct x), '{}'::uuid[]) into ids
  from unnest(member_ids) as x where x <> me;
  if coalesce(array_length(ids, 1), 0) < 1 or array_length(ids, 1) > 49 then
    raise exception 'bad member count';
  end if;

  foreach uid in array ids loop
    if not exists (
      select 1 from public.friendships
      where status = 'accepted'
        and ((requester = me and addressee = uid) or (requester = uid and addressee = me))
    ) then raise exception 'not friends with all members'; end if;
  end loop;

  insert into public.conversations (type, name, created_by) values ('group', group_name, me) returning id into conv;
  insert into public.conversation_members (conversation_id, user_id, role) values (conv, me, 'owner');
  insert into public.conversation_members (conversation_id, user_id)
  select conv, x from unnest(ids) as x;
  return conv;
end;
$$;

-- ========== 6. 权限（第一道门） ==========
grant usage on schema public to anon, authenticated, service_role;
grant select on public.profiles to authenticated;
grant select, insert, delete on public.friendships to authenticated;
revoke update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;
grant select on public.conversations to authenticated;
grant select on public.conversation_members to authenticated;
grant select, insert on public.messages to authenticated;

revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.create_dm(uuid) from public, anon;
revoke execute on function public.create_group(text, uuid[]) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.create_dm(uuid) to authenticated;
grant execute on function public.create_group(text, uuid[]) to authenticated;

-- ========== 7. 实时推送（已加过的表会被忽略） ==========
do $$
begin
  begin alter publication supabase_realtime add table public.messages;
  exception when duplicate_object or undefined_object then null; end;
  begin alter publication supabase_realtime add table public.conversation_members;
  exception when duplicate_object or undefined_object then null; end;
  begin alter publication supabase_realtime add table public.friendships;
  exception when duplicate_object or undefined_object then null; end;
end
$$;
