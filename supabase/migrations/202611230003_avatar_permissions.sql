-- Horizon：头像写库权限修复（0.3.0）
-- 报错 "permission denied for table profiles"（42501）说明：
--   存储上传成功了，但把 avatar_url 写回 profiles 时被拒 —— 缺表级 GRANT / 缺 UPDATE 策略。
-- 可重复执行。

-- ---------- 1. profiles：允许已登录用户改自己的资料 ----------
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;

drop policy if exists "Profiles update own" on public.profiles;
create policy "Profiles update own"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------- 2. conversations：允许群主改自己建的群（群头像用）----------
grant select, update on public.conversations to authenticated;

drop policy if exists "Group owner update conversation" on public.conversations;
create policy "Group owner update conversation"
  on public.conversations for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- ---------- 3. 自检 ----------
select table_name,
       has_table_privilege('authenticated', 'public.' || table_name, 'UPDATE') as authenticated_can_update
  from (values ('profiles'), ('conversations')) as t(table_name);

select schemaname, tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('profiles', 'conversations')
 order by tablename, policyname;
