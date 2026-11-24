-- Horizon：称号的修改 / 删除（仅 100001 可操作）
-- 可重复执行。

-- 允许 100001 更新称号内容
drop policy if exists "titles update owner" on public.user_titles;
create policy "titles update owner"
  on public.user_titles for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

grant update (title, gradient, gradient_from, gradient_to) on public.user_titles to authenticated;

-- 自检：确认策略存在（注意用 pg_policies 视图，pg_policy 里没有 cmd 列，只有 polcmd）
select policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename = 'user_titles'
 order by policyname;
