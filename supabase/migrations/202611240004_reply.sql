-- Horizon：引用回复
-- reply_to 指向被引用的消息；reply_preview 冗余存一份摘要，避免每次渲染都 join 查询。

alter table public.messages
  add column if not exists reply_to uuid references public.messages (id) on delete set null,
  add column if not exists reply_preview text;

create index if not exists messages_reply_to_idx on public.messages (reply_to);

-- 自检
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'messages'
   and column_name in ('reply_to', 'reply_preview');
