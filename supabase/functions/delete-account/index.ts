import { createClient } from 'npm:@supabase/supabase-js@2';
const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const FRESH_SECONDS = 15 * 60;
function freshCodeLogin(token: string): boolean {
    try {
        const seg = token.split('.')[1] ?? '';
        const b64 = seg.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(seg.length / 4) * 4, '=');
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const claims = JSON.parse(new TextDecoder().decode(bytes)) as {
            amr?: {
                method?: string;
                timestamp?: number;
            }[];
        };
        const now = Date.now() / 1000;
        return (claims.amr ?? []).some((a) => typeof a?.method === 'string'
            && !['password', 'oauth', 'anonymous', 'token_refresh'].includes(a.method)
            && typeof a.timestamp === 'number'
            && now - a.timestamp < FRESH_SECONDS);
    }
    catch {
        return false;
    }
}
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
    if (!freshCodeLogin(token))
        return json({ error: 'reauth_required' }, 403);
    const uid = me.user.id;
    const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: prof } = await admin
        .from('profiles')
        .select('horizon_id')
        .eq('id', uid)
        .maybeSingle();
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error)
        return json({ error: error.message }, 500);
    return json({ ok: true, recycled_horizon_id: prof?.horizon_id ?? null });
});
