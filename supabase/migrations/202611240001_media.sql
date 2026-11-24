-- Horizon：多媒体消息（图片 / 语音）基础设施
-- 阶段一：字段 + 私有存储桶 + 成员维度的访问策略（24 小时自动销毁留到阶段二）
-- 可重复执行。

-- ---------- 1. messages 扩展 ----------
alter table public.messages
  add column if not exists media_type text not null default 'text',
  add column if not exists media_path text,
  add column if not exists media_name text,
  add column if not exists media_mime text,
  add column if not exists media_size bigint,
  add column if not exists media_duration integer,
  add column if not exists expires_at timestamptz,
  add column if not exists is_expired boolean not null default false;

-- 只允许这几种类型
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_media_type_check'
  ) then
    alter table public.messages
      add constraint messages_media_type_check
      check (media_type in ('text', 'image', 'audio', 'video', 'file'));
  end if;
end $$;

create index if not exists idx_messages_expired_cleanup
  on public.messages (is_expired, expires_at)
  where media_type <> 'text' and is_expired = false;

-- ---------- 2. 私有存储桶 chat-media ----------
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;

-- 路径规范：{conversation_id}/{uuid}.{ext}
-- 只有该会话成员能读写（用 storage.foldername(name)[1] 取第一段当会话 id）

drop policy if exists "chat-media read" on storage.objects;
create policy "chat-media read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-media'
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id::text = (storage.foldername(name))[1]
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "chat-media insert" on storage.objects;
create policy "chat-media insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and owner_id = auth.uid()::text
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id::text = (storage.foldername(name))[1]
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "chat-media delete own" on storage.objects;
create policy "chat-media delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and owner_id = auth.uid()::text);

-- ---------- 3. 自检 ----------
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'messages'
   and column_name like 'media_%'
 order by column_name;

select id, name, public from storage.buckets where id = 'chat-media';
