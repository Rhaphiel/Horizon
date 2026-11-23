-- Horizon v0.3: per-device push tokens.
-- 可重复执行（幂等）：表、策略、权限都会先判断/重建，不会因为“已存在”而报错。
-- 在 Supabase Dashboard → SQL Editor 里执行。

-- ---------- 1. 表 ----------
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('fcm', 'hms')),
  token text not null,
  platform text not null default 'android',
  device_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_user_provider_token_key unique (user_id, provider, token)
);

-- ---------- 2. 表级权限（RLS 之外还必须 GRANT，否则 authenticated 也会被拒 42501）----------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;
grant all on public.push_tokens to service_role;

-- ---------- 3. 行级安全 ----------
alter table public.push_tokens enable row level security;

drop policy if exists "Users can read their own push tokens" on public.push_tokens;
create policy "Users can read their own push tokens"
  on public.push_tokens for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own push tokens" on public.push_tokens;
create policy "Users can insert their own push tokens"
  on public.push_tokens for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own push tokens" on public.push_tokens;
create policy "Users can update their own push tokens"
  on public.push_tokens for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own push tokens" on public.push_tokens;
create policy "Users can delete their own push tokens"
  on public.push_tokens for delete to authenticated
  using (auth.uid() = user_id);

-- ---------- 4. 索引 ----------
create index if not exists push_tokens_user_provider_idx
  on public.push_tokens (user_id, provider);

-- ---------- 5. 自检（执行后应看到 4 条策略）----------
select schemaname, tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename = 'push_tokens'
 order by policyname;
