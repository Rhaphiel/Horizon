-- Horizon 0.5.1：私聊不再重复建立 + 删好友后私聊不能再发消息 + 群主改群名 + 群资料变动实时通知
--               + 同一台手机换账号后，推送不再发给上一个账号
--               + 实时频道不再发布 DELETE 事件
-- 在 Supabase Dashboard → SQL Editor 里整段执行即可。可重复执行（幂等）。
-- 需要先执行过 0014、0015、0016。请在装 0.5.1 的 APK 之前执行（新版「改群名」要用到 rename_group）。

-- ========== 1. 建私聊：两人同时点「发消息」也只会建出一个 ==========
-- 以前「先查有没有、没有再建」不是原子操作，两边同时点会各建一个。
-- 现在按这两个人加一把事务锁：后到的那个等前一个提交后再查，就能查到刚建好的那个。
create or replace function public.create_dm(friend uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv uuid;
begin
  if me is null then raise exception 'not logged in'; end if;
  if friend is null or friend = me then raise exception 'not friends'; end if;
  if not exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester = me and addressee = friend) or (requester = friend and addressee = me))
  ) then raise exception 'not friends'; end if;

  perform pg_advisory_xact_lock(hashtextextended('dm:' || least(me, friend)::text || ':' || greatest(me, friend)::text, 0));

  -- 以前已经重复建过的：固定返回最早那个，两边进的是同一个聊天
  select c.id into conv from public.conversations c
  where c.type = 'dm'
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = me)
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = friend)
  order by c.created_at, c.id
  limit 1;
  if conv is not null then return conv; end if;

  insert into public.conversations (type, created_by) values ('dm', me) returning id into conv;
  insert into public.conversation_members (conversation_id, user_id, role)
  values (conv, me, 'owner'), (conv, friend, 'member');
  return conv;
end;
$$;
revoke execute on function public.create_dm(uuid) from public, anon;
grant execute on function public.create_dm(uuid) to authenticated;

-- ========== 2. 删好友后，原来的私聊只能看、不能再发 ==========
-- 重新加回好友后自动恢复（create_dm 会找回原来那个私聊，聊天记录还在）。群聊不受影响。
-- 「我能不能往这个聊天发消息」：群聊总是可以；私聊要求对方仍是我的好友。
-- 只按当前登录用户判断，App 也能直接调用，不会泄露别人之间的好友关系。
create or replace function public.dm_can_send(conv uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select not exists (select 1 from public.conversations c where c.id = conv and c.type = 'dm')
      or exists (
        select 1
          from public.conversation_members p
          join public.friendships f
            on f.status = 'accepted'
           and ((f.requester = auth.uid() and f.addressee = p.user_id)
             or (f.requester = p.user_id and f.addressee = auth.uid()))
         where p.conversation_id = conv
           and p.user_id <> auth.uid()
      );
$$;
revoke execute on function public.dm_can_send(uuid) from public, anon;
grant execute on function public.dm_can_send(uuid) to authenticated;

-- 触发器以 App 用户身份执行（不是 security definer），所以能用 current_user 区分 App 和后台。
-- 行级安全已经保证 App 用户的 sender_id 就是自己，这里按 auth.uid() 判断即可。
create or replace function public.messages_guard_dm_friend()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;   -- Edge Function / SQL Editor 不受限制
  end if;
  if not public.dm_can_send(new.conversation_id) then
    raise exception 'friendship_ended';
  end if;
  return new;
end;
$$;

-- trg_01：排在 0014 的 trg_00_messages_guard_insert 之后
drop trigger if exists trg_01_messages_guard_dm_friend on public.messages;
create trigger trg_01_messages_guard_dm_friend
  before insert on public.messages
  for each row execute function public.messages_guard_dm_friend();

-- ========== 3. 群主改群名 ==========
-- 走函数而不是直接开放 name 列的 UPDATE：长度校验和群主判断都在服务器上做
create or replace function public.rename_group(conv uuid, new_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;
  if not public.is_group_owner(conv) then raise exception 'not_owner'; end if;
  new_name := btrim(new_name);
  if new_name is null or char_length(new_name) not between 1 and 30 then
    raise exception 'bad group name';
  end if;
  update public.conversations set name = new_name where id = conv and name is distinct from new_name;
end;
$$;
revoke execute on function public.rename_group(uuid, text) from public, anon;
grant execute on function public.rename_group(uuid, text) to authenticated;

-- ========== 4. 群名 / 群头像变了：通知所有成员刷新列表 ==========
-- 以前别人改了群头像，要等你回到前台或下拉刷新才看得到
alter table public.user_events drop constraint if exists user_events_kind_check;
alter table public.user_events add constraint user_events_kind_check check (kind in (
  'conversation_dissolved',
  'removed_from_conversation',
  'member_left',
  'friendship_removed',
  'conversation_updated'               -- 群名或群头像变了
));

create or replace function public.ev_conversation_updated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.name is not distinct from old.name and new.avatar_url is not distinct from old.avatar_url then
    return new;
  end if;
  insert into public.user_events (user_id, kind, conversation_id)
  select m.user_id, 'conversation_updated', new.id
    from public.conversation_members m
   where m.conversation_id = new.id;
  perform public.prune_user_events();
  return new;
end;
$$;
drop trigger if exists ev_conversation_updated on public.conversations;
create trigger ev_conversation_updated
  after update on public.conversations
  for each row execute function public.ev_conversation_updated();

-- ========== 5. 同一台手机只归一个账号收推送 ==========
-- 设备 Token 是按手机发的。A 在这台手机上退出时如果没删掉 Token（比如当时没网），
-- B 再登录后，A 的消息还会推到这台手机上。现在谁登记了这个 Token，就把别的账号名下的同一个 Token 删掉。
create or replace function public.push_token_claim()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_tokens
   where token = new.token
     and provider = new.provider
     and user_id <> new.user_id;
  return new;
end;
$$;
revoke execute on function public.push_token_claim() from public, anon, authenticated;

drop trigger if exists push_token_claim on public.push_tokens;
create trigger push_token_claim
  after insert or update of token, user_id on public.push_tokens
  for each row execute function public.push_token_claim();

-- 已经有同一个 Token 挂在多个账号下的：只留最近更新的那个
delete from public.push_tokens a
 using public.push_tokens b
 where a.provider = b.provider
   and a.token = b.token
   and a.user_id <> b.user_id
   and (a.updated_at, a.id::text) < (b.updated_at, b.id::text);

-- ========== 6. 实时频道只发布 INSERT / UPDATE ==========
-- Supabase Realtime 的 DELETE 事件不经过行级安全：任何登录用户只要自己订阅，就能收到所有人的删除事件。
-- conversation_members 的主键是（聊天 id, 用户 id），等于谁退了哪个群都看得到。
-- 0016 之后 App 已经不订阅 DELETE（改走 user_events），这里在服务器端直接不发布，别人也订阅不到。
-- 也可以在后台 Database → Publications → supabase_realtime 里把 Delete / Truncate 关掉，效果一样。
do $$
begin
  alter publication supabase_realtime set (publish = 'insert, update');
exception
  when undefined_object then null;   -- 没有这个 publication（本地测试环境）
  when insufficient_privilege then
    raise notice '没有权限修改 supabase_realtime：请到 Database → Publications 手动关掉 Delete 和 Truncate';
end
$$;

-- ========== 7. 自检 ==========
-- 应看到 ev_conversation_updated / push_token_claim / trg_01_messages_guard_dm_friend
select tgname, tgrelid::regclass as on_table
  from pg_trigger
 where tgname in ('ev_conversation_updated', 'push_token_claim', 'trg_01_messages_guard_dm_friend')
 order by tgname;

-- 已经重复的私聊（同一对人有两个以上私聊）：0.5.1 起固定进最早那个，其余的可以手动删除
select least(a.user_id, b.user_id) as user_a, greatest(a.user_id, b.user_id) as user_b,
       count(distinct c.id) as dm_count
  from public.conversations c
  join public.conversation_members a on a.conversation_id = c.id
  join public.conversation_members b on b.conversation_id = c.id and a.user_id < b.user_id
 where c.type = 'dm'
 group by 1, 2
having count(distinct c.id) > 1;

-- 应为 insert = true、update = true、delete = false、truncate = false
select pubname, pubinsert, pubupdate, pubdelete, pubtruncate
  from pg_publication where pubname = 'supabase_realtime';
