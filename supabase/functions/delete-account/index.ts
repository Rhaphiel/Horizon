// Horizon：注销账号
// 客户端先用邮箱验证码证明本人（signInWithOtp + verifyOtp），拿到会话后调用本函数。
// 本函数用 service_role 删除 auth.users 里的用户；profiles 会级联删除，
// 触发器会把 horizon_id 放进回收池，下一个注册的人优先占用。
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'not_authenticated' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // 用调用者的 token 查出 uid，确保只能删自己
  const asUser = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: me, error: meErr } = await asUser.auth.getUser(token);
  if (meErr || !me?.user) return json({ error: 'not_authenticated' }, 401);

  const uid = me.user.id;
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 删除前先取 horizon_id（给前端提示用）
  const { data: prof } = await admin
    .from('profiles')
    .select('horizon_id')
    .eq('id', uid)
    .maybeSingle();

  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, recycled_horizon_id: prof?.horizon_id ?? null });
});
