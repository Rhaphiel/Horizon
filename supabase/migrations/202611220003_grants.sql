-- Horizon：修复 Edge Function 报 42501（permission denied）
-- 原因：RLS 只是“行级过滤”，表级权限还必须有 GRANT。
--       Edge Function 用 service_role 查表，如果该角色没有表权限，就会 42501。
-- 可重复执行。

-- 1) 基础 schema 权限
grant usage on schema public to anon, authenticated, service_role;

-- 2) service_role 需要读所有业务表（推送函数要用）
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- 3) 登录用户对 push_tokens 的读写（App 存 Token 用）
grant select, insert, update, delete on public.push_tokens to authenticated;

-- 4) 自检：确认三个角色在 push_tokens 上的权限
select grantee, string_agg(privilege_type, ',' order by privilege_type) as privileges
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name = 'push_tokens'
 group by grantee
 order by grantee;

-- 5) 自检：确认 service_role 能读推送函数依赖的四张表
select table_name,
       has_table_privilege('service_role', 'public.' || table_name, 'SELECT') as service_role_can_select
  from (values ('push_tokens'), ('conversation_members'), ('conversations'), ('profiles'), ('messages')) as t(table_name);
