-- Horizon 0.5.1：聊天静音（存在服务器上：跨设备、连推送一起挡）+ 存储桶上限 + 旧媒体消息补过期时间
-- 在 Supabase Dashboard → SQL Editor 里整段执行即可。可重复执行（幂等）。
-- 执行完这份之后，再重新部署 push-message 函数（它会跳过静音了这个聊天的人）。
-- 0.5.0 存在手机本地的静音，0.5.1 的 App 登录后会自动搬到这张表里。

-- ========== 1. 静音 ==========
-- 单独一张表，只有自己看得到自己的设置（放在 conversation_members 里会被同群成员读到）
create table if not exists public.conversation_mutes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

alter table public.conversation_mutes enable row level security;

drop policy if exists "see own mutes" on public.conversation_mutes;
create policy "see own mutes" on public.conversation_mutes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "mute my conversations" on public.conversation_mutes;
create policy "mute my conversations" on public.conversation_mutes
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(conversation_id));

drop policy if exists "unmute my conversations" on public.conversation_mutes;
create policy "unmute my conversations" on public.conversation_mutes
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on public.conversation_mutes to authenticated;
grant all on public.conversation_mutes to service_role;

-- ========== 2. 存储桶上限 ==========
-- 聊天媒体：单个文件 ≤ 20MB，只收图片和音频（App 上传前会去掉 ;codecs=… 这类参数）
update storage.buckets
   set file_size_limit = 20 * 1024 * 1024,
       allowed_mime_types = array['image/*', 'audio/*']
 where id = 'chat-media';

-- 头像：裁剪后只有几十 KB，给 5MB 足够
update storage.buckets
   set file_size_limit = 5 * 1024 * 1024,
       allowed_mime_types = array['image/*']
 where id = 'avatars';

-- ========== 3. 过期功能上线前发的媒体消息：补上过期时间，交给 cleanup-media 统一清理 ==========
-- （SQL Editor 以 postgres 身份执行，不受 App 用户触发器约束）
update public.messages
   set expires_at = created_at + interval '24 hours'
 where media_type <> 'text'
   and expires_at is null;

-- ========== 4. 自检 ==========
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'conversation_mutes'
 order by policyname;

select id, file_size_limit, allowed_mime_types from storage.buckets
 where id in ('chat-media', 'avatars');
