-- Horizon 0.5.1：权限加固（撤回 / 群头像 / 发消息 / 引用回复）
-- 在 Supabase Dashboard → SQL Editor 里整段执行即可。可重复执行（幂等）。
-- 需要先执行过 0001–0013。0014–0018 请按顺序执行，并且要在装 0.5.1 的 APK 之前。
--
-- 修的问题：
--   1. 撤回后正文仍留在库里，任何成员查 API 都能读到；聊天列表预览也还显示原文、未读数照算
--   2. 群头像的更新策略看 created_by，群主转让后新群主改不了（而且前端会误报成功）；
--      并且整张 conversations 表都开放了 UPDATE，私聊建立者能改 type / name
--   3. messages 整表开放 INSERT，客户端能自填 created_at / expires_at / recalled_at / is_expired，
--      还能让 media_path 指向别的会话的文件
--   4. 引用回复的摘要（reply_preview）由客户端填写：能伪造「某人说过的话」；
--      原消息撤回后，引用里还留着原文
--
-- 规则：下面的触发器只约束 App 用户（authenticated / anon 角色）。
--       service_role（Edge Function）和 SQL Editor（postgres）不受影响，cleanup-media 照常工作。

-- ========== 1. 发消息：服务器决定时间和系统字段 ==========
create or replace function public.messages_guard_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  new.created_at  := now();
  new.recalled_at := null;
  new.is_expired  := false;

  -- 引用回复：只能引用本聊天里的消息，摘要由服务器按原消息生成（客户端填的不算）
  new.reply_preview := null;
  if new.reply_to is not null then
    select case
             when q.recalled_at is not null then '[已撤回]'
             when q.media_type = 'image' then '[图片]'
             when q.media_type = 'audio' then '[语音]'
             when q.media_type = 'video' then '[视频]'
             when q.media_type = 'file' then '[文件]'
             else left(btrim(regexp_replace(q.body, '\s+', ' ', 'g')), 60)
           end
      into new.reply_preview
      from public.messages q
     where q.id = new.reply_to
       and q.conversation_id = new.conversation_id;
    if not found then
      new.reply_to := null;   -- 引用的消息不存在或不在本聊天：当成普通消息发出去
    end if;
  end if;

  if new.media_type is null or new.media_type = 'text' then
    new.media_type     := 'text';
    new.media_path     := null;
    new.media_name     := null;
    new.media_mime     := null;
    new.media_size     := null;
    new.media_duration := null;
    new.expires_at     := null;
  else
    -- 文件必须放在本会话目录下：{conversation_id}/xxx
    if new.media_path is null
       or split_part(new.media_path, '/', 1) <> new.conversation_id::text
       or position('..' in new.media_path) > 0 then
      raise exception 'bad_media_path';
    end if;
    new.expires_at := now() + interval '24 hours';
  end if;

  return new;
end;
$$;

-- 名字以 trg_00 开头：同一时机的触发器按名字排序执行，保证它排在 trg_set_media_expiry 之前
drop trigger if exists trg_00_messages_guard_insert on public.messages;
create trigger trg_00_messages_guard_insert
  before insert on public.messages
  for each row execute function public.messages_guard_insert();

-- ========== 2. 撤回：只能写 recalled_at，并且服务器把正文抹掉 ==========
create or replace function public.messages_guard_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- App 用户只能做「撤回」这一件事：其余字段一律保持原样
  new.id             := old.id;
  new.conversation_id := old.conversation_id;
  new.sender_id      := old.sender_id;
  new.created_at     := old.created_at;
  new.media_type     := old.media_type;
  new.media_path     := old.media_path;
  new.media_name     := old.media_name;
  new.media_mime     := old.media_mime;
  new.media_size     := old.media_size;
  new.media_duration := old.media_duration;
  new.is_expired     := old.is_expired;
  new.expires_at     := old.expires_at;
  new.body           := old.body;
  new.reply_to       := old.reply_to;
  new.reply_preview  := old.reply_preview;

  if old.recalled_at is not null then
    new.recalled_at := old.recalled_at;          -- 已撤回的不能「取消撤回」，时间也不能改
    return new;
  end if;

  if new.recalled_at is not null then
    new.recalled_at := now();                    -- 以服务器时间为准
    new.body := '[已撤回]';                      -- 正文不再留在库里（「重新编辑」用的是手机本地的文字）
    if old.media_type <> 'text' and not old.is_expired then
      new.expires_at := now();                   -- 图片 / 语音：交给 cleanup-media 下一轮（≤15 分钟）删文件
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_00_messages_guard_update on public.messages;
create trigger trg_00_messages_guard_update
  before update on public.messages
  for each row execute function public.messages_guard_update();

-- 撤回后，引用了这条消息的回复里的摘要也换成「[已撤回]」（摘要是单独存的一份，不跟着原消息变）
-- security definer：要改的是别人发的消息；以 postgres 身份执行，上面的 App 用户限制不会拦它
create or replace function public.messages_recall_replies()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.messages
     set reply_preview = '[已撤回]'
   where reply_to = new.id
     and reply_preview is distinct from '[已撤回]';
  return new;
end;
$$;
revoke execute on function public.messages_recall_replies() from public, anon, authenticated;

drop trigger if exists trg_messages_recall_replies on public.messages;
create trigger trg_messages_recall_replies
  after update of recalled_at on public.messages
  for each row
  when (old.recalled_at is null and new.recalled_at is not null)
  execute function public.messages_recall_replies();

-- 列级授权保持「只能改 recalled_at」（防止以前手工放开过整表 UPDATE）
revoke update on public.messages from authenticated, anon;
grant update (recalled_at) on public.messages to authenticated;

-- ========== 3. 未读数不算已撤回的消息 ==========
-- 预览不用改：撤回后 body 已经是「[已撤回]」
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
         and x.sender_id <> m.user_id
         and x.recalled_at is null),
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

revoke execute on function public.get_conversation_stats() from public, anon;
grant execute on function public.get_conversation_stats() to authenticated;

-- （可选，不可恢复）把以前已经撤回、但正文还留在库里的消息也抹掉。
-- 确认要清掉旧的撤回原文时，去掉下面语句开头的「--」再执行：
-- update public.messages set body = '[已撤回]'
--  where recalled_at is not null and body <> '[已撤回]';
-- 引用了已撤回消息的回复，摘要里也可能还留着原文；一起清掉的话再执行这句：
-- update public.messages r set reply_preview = '[已撤回]'
--   from public.messages q
--  where r.reply_to = q.id and q.recalled_at is not null and r.reply_preview is distinct from '[已撤回]';

-- ========== 4. 群头像：看「当前群主」，并且只能改 avatar_url ==========
create or replace function public.is_group_owner(conv uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
      from public.conversation_members m
      join public.conversations c on c.id = m.conversation_id
     where m.conversation_id = conv
       and m.user_id = auth.uid()
       and m.role = 'owner'
       and c.type = 'group'
  );
$$;

revoke execute on function public.is_group_owner(uuid) from public, anon;
grant execute on function public.is_group_owner(uuid) to authenticated;

revoke update on public.conversations from authenticated, anon;
grant update (avatar_url) on public.conversations to authenticated;

drop policy if exists "Group owner update conversation" on public.conversations;
drop policy if exists "Group owner update avatar" on public.conversations;
create policy "Group owner update avatar"
  on public.conversations for update to authenticated
  using (public.is_group_owner(id))
  with check (public.is_group_owner(id));

-- ========== 5. 自检 ==========
-- 应看到 trg_00_messages_guard_insert / trg_00_messages_guard_update / trg_messages_recall_replies
select tgname
  from pg_trigger
 where tgrelid = 'public.messages'::regclass and not tgisinternal
 order by tgname;

-- authenticated 在 conversations / messages 上应只剩列级 UPDATE（表级为 false）
select t.table_name,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'UPDATE') as table_level_update
  from (values ('conversations'), ('messages')) as t(table_name);
