import { createClient } from 'npm:@supabase/supabase-js@2';
const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS')
        return new Response('ok', { headers: cors });
    if (req.method !== 'POST')
        return json({ error: 'method_not_allowed' }, 405);
    const auth = req.headers.get('Authorization') ?? '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token)
        return json({ error: 'not_authenticated' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const asUser = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: me, error: meErr } = await asUser.auth.getUser(token);
    if (meErr || !me?.user)
        return json({ error: 'not_authenticated' }, 401);
    const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: mine } = await admin
        .from('profiles')
        .select('horizon_id')
        .eq('id', me.user.id)
        .maybeSingle();
    if (Number(mine?.horizon_id) !== 100001)
        return json({ error: 'forbidden' }, 403);
    const { data: profiles, error: pErr } = await admin
        .from('profiles')
        .select('id,username,handle,horizon_id,id_searchable,created_at')
        .order('horizon_id', { ascending: true });
    if (pErr)
        return json({ error: pErr.message }, 500);
    const authUsers: {
        id: string;
        email: string | null;
        created_at: string;
        last_sign_in_at: string | null;
    }[] = [];
    let page = 1;
    for (;;) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error)
            return json({ error: error.message }, 500);
        const users = data?.users ?? [];
        users.forEach(u => authUsers.push({
            id: u.id,
            email: u.email ?? null,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
        }));
        if (users.length < 1000)
            break;
        page += 1;
        if (page > 20)
            break;
    }
    const byId = new Map(authUsers.map(u => [u.id, u]));
    const rows = (profiles ?? []).map(p => {
        const a = byId.get(p.id as string);
        return {
            id: p.id,
            horizon_id: p.horizon_id,
            username: p.username,
            handle: p.handle,
            email: a?.email ?? null,
            registered_at: a?.created_at ?? p.created_at,
            last_sign_in_at: a?.last_sign_in_at ?? null,
            id_searchable: p.id_searchable,
        };
    });
    return json({ count: rows.length, users: rows, password_note: '密码只存哈希，无法查看' });
});
