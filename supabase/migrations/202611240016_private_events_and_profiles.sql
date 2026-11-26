-- Horizon 0.5.1：成员变动改走私有事件表 + 个人资料只能改头像 / 显示的称号 / ID 查找开关
-- 在 Supabase Dashboard → SQL Editor 里整段执行即可。可重复执行（幂等）。
-- 请在装新版 APK 之前执行：新版 App 不再订阅 DELETE 事件，没有这张表就收不到「被移出 / 群解散」的实时提醒
-- （回到前台或下拉刷新时仍会同步）。

-- ========== 1. 私有事件表 ==========
-- 为什么需要：Supabase Realtime 的 DELETE 事件不经过行级安全，订阅了就会收到所有人的退群 / 解散 / 删好友事件
-- （虽然只有主键 id）。改成由触发器把事件写进这张表，每个人只看得到写给自己的行。
create table if not exists public.user_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,              -- 收事件的人（不加外键：账号删除后残留的几行会被定期清掉）
  kind text not null check (kind in (
    'conversation_dissolved',          -- 群被解散
    'removed_from_conversation',       -- 我被移出 / 我退出了
    'member_left',                     -- 群里别人退出 / 被移出
    'friendship_removed'               -- 好友关系或好友申请被删除
  )),
  conversation_id uuid,               -- 不加外键：群解散后也要能通知
  created_at timestamptz not null default now()
);
create index if not exists user_events_user_idx on public.user_events (user_id, id);
create index if not exists user_events_created_idx on public.user_events (created_at);

alter table public.user_events enable row level security;
drop policy if exists "see own events" on public.user_events;
create policy "see own events" on public.user_events
  for select to authenticated using (user_id = auth.uid());

revoke all on public.user_events from anon, authenticated;
grant select on public.user_events to authenticated;
grant all on public.user_events to service_role;

do $$
begin
  begin alter publication supabase_realtime add table public.user_events;
  exception when duplicate_object or undefined_object then null; end;
end
$$;

-- 事件只用来实时提醒，保留 3 天就够了
create or replace function public.prune_user_events()
returns void language sql security definer set search_path = public as $$
  delete from public.user_events where created_at < now() - interval '3 days';
$$;
revoke execute on function public.prune_user_events() from public, anon, authenticated;

-- ---------- 群被解散：在删除前把成员都通知一遍（删除后成员行已经被级联删光了）----------
create or replace function public.ev_conversation_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_events (user_id, kind, conversation_id)
  select m.user_id, 'conversation_dissolved', old.id
    from public.conversation_members m
   where m.conversation_id = old.id;
  return old;
end;
$$;
drop trigger if exists ev_conversation_deleted on public.conversations;
create trigger ev_conversation_deleted
  before delete on public.conversations
  for each row execute function public.ev_conversation_deleted();

-- ---------- 有人离开聊天（退出 / 被移出）----------
create or replace function public.ev_member_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- 群正在被解散（级联删除成员）：上面已经发过「解散」，这里不再重复
  if not exists (select 1 from public.conversations where id = old.conversation_id) then
    return old;
  end if;

  insert into public.user_events (user_id, kind, conversation_id)
  values (old.user_id, 'removed_from_conversation', old.conversation_id);

  insert into public.user_events (user_id, kind, conversation_id)
  select m.user_id, 'member_left', old.conversation_id
    from public.conversation_members m
   where m.conversation_id = old.conversation_id;

  perform public.prune_user_events();
  return old;
end;
$$;
drop trigger if exists ev_member_deleted on public.conversation_members;
create trigger ev_member_deleted
  after delete on public.conversation_members
  for each row execute function public.ev_member_deleted();

-- ---------- 好友关系 / 申请被删除：双方都刷新好友列表 ----------
create or replace function public.ev_friendship_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_events (user_id, kind)
  values (old.requester, 'friendship_removed'), (old.addressee, 'friendship_removed');
  perform public.prune_user_events();
  return old;
end;
$$;
drop trigger if exists ev_friendship_deleted on public.friendships;
create trigger ev_friendship_deleted
  after delete on public.friendships
  for each row execute function public.ev_friendship_deleted();

-- ========== 2. 个人资料：只能直接改头像、显示的称号、ID 查找开关；头像必须是自己在 avatars 桶里的文件 ==========
-- 以前整张表开放 UPDATE（0003 的 grant select, update），绕开 App 直接调接口就能：
--   * 改用户名，不受「每天一次」限制；改已经锁定的账号名（handle）
--   * 改自己的 horizon_id（100001 空出来时，谁都能把自己改成 100001，拿到发称号的权限）
--   * 头像填任意外部网址（好友打开列表时会去请求那个网址）
-- 用户名、账号名走 change_username / set_handle 函数（security definer，不受这里影响）
revoke update on public.profiles from authenticated, anon;
grant update (avatar_url, shown_title, id_searchable) on public.profiles to authenticated;

-- 群头像同理（列级权限 0014 已经收紧，这里补地址校验）
-- 地址格式：https://<项目>.supabase.co/storage/v1/object/public/avatars/<上传者 id>/<文件名>
-- 以后如果换了自定义域名，要同步改这里的正则
create or replace function public.guard_avatar_url()
returns trigger language plpgsql set search_path = public as $$
declare
  pattern text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.avatar_url is null or new.avatar_url is not distinct from old.avatar_url then
    return new;
  end if;
  pattern := '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/'
             || auth.uid()::text || '/[A-Za-z0-9._-]+$';
  if new.avatar_url !~ pattern then
    raise exception 'bad_avatar_url';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_avatar on public.profiles;
create trigger guard_profile_avatar
  before update on public.profiles
  for each row execute function public.guard_avatar_url();

drop trigger if exists guard_conversation_avatar on public.conversations;
create trigger guard_conversation_avatar
  before update on public.conversations
  for each row execute function public.guard_avatar_url();

-- ========== 3. 自检 ==========
select tgname, tgrelid::regclass as on_table
  from pg_trigger
 where tgname in ('ev_conversation_deleted', 'ev_member_deleted', 'ev_friendship_deleted',
                  'guard_profile_avatar', 'guard_conversation_avatar')
 order by tgname;

select t.table_name,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'UPDATE') as table_level_update
  from (values ('profiles'), ('conversations')) as t(table_name);
