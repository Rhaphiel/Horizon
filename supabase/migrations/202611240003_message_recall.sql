-- Horizon：消息撤回（1 小时内可撤回，撤回后 10 分钟可重新编辑 —— 重新编辑由客户端保存文本）
-- 可重复执行。

alter table public.messages
  add column if not exists recalled_at timestamptz;

-- 只有发送者本人、且消息未超过 1 小时，才能把 recalled_at 写进去
drop policy if exists "recall own message" on public.messages;
create policy "recall own message"
  on public.messages for update to authenticated
  using (sender_id = auth.uid() and created_at > now() - interval '1 hour')
  with check (sender_id = auth.uid() and recalled_at is not null);

-- 列级授权（有些项目只给了行级权限，不补这句会报 permission denied）
grant update (recalled_at) on public.messages to authenticated;

-- 自检
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'messages' and column_name = 'recalled_at';

select polname from pg_policy where polname = 'recall own message';
