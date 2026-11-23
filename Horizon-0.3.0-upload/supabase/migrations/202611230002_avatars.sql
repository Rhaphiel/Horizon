-- Horizon 0.4.1：自定义头像（用户头像 + 群头像）
-- 幂等，可重复执行。

-- ---------- 1. 字段 ----------
alter table public.profiles add column if not exists avatar_url text;
alter table public.conversations add column if not exists avatar_url text;

-- ---------- 2. 存储桶 ----------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ---------- 3. 存储策略（只能写自己目录下的文件）----------
drop policy if exists "avatars read" on storage.objects;
create policy "avatars read"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars insert own" on storage.objects;
create policy "avatars insert own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- 4. 自检 ----------
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('profiles', 'conversations')
   and column_name = 'avatar_url'
 order by table_name;
