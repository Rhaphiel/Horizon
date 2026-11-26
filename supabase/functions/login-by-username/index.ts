import { createClient } from "npm:@supabase/supabase-js@2";
const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const WINDOW = 60000;
const hits = new Map<string, number[]>();
function limited(key: string, max: number): boolean {
    const now = Date.now();
    const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW);
    list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) {
        for (const [k, v] of hits)
            if (!v.length || now - v[v.length - 1] >= WINDOW)
                hits.delete(k);
    }
    return list.length > max;
}
Deno.serve(async (req) => {
    if (req.method === "OPTIONS")
        return new Response("ok", { headers: cors });
    if (req.method !== "POST")
        return json({ error: "method_not_allowed" }, 405);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (limited("ip:" + ip, 30))
        return json({ error: "too_many_requests" }, 429);
    let username = "";
    let password = "";
    try {
        const b = await req.json();
        username = String(b.username ?? "").trim();
        password = String(b.password ?? "");
    }
    catch {
        return json({ error: "invalid_login" }, 401);
    }
    if (!/^(\d{5,15}|[A-Za-z0-9_]{3,20})$/.test(username) || !password)
        return json({ error: "invalid_login" }, 401);
    if (limited("user:" + username.toLowerCase(), 10))
        return json({ error: "too_many_requests" }, 429);
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    let prof: {
        id: string;
        username: string;
    } | null = null;
    if (/^\d{5,}$/.test(username)) {
        const { data } = await admin
            .from("profiles")
            .select("id, username")
            .eq("horizon_id", username)
            .maybeSingle();
        prof = data ?? null;
    }
    else {
        const { data } = await admin
            .from("profiles")
            .select("id, username")
            .ilike("handle", username.replace(/_/g, "\\_"))
            .maybeSingle();
        prof = data ?? null;
    }
    if (!prof)
        return json({ error: "invalid_login" }, 401);
    const { data: u, error: ue } = await admin.auth.admin.getUserById(prof.id);
    const email = u?.user?.email;
    if (ue || !email)
        return json({ error: "invalid_login" }, 401);
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session)
        return json({ error: "invalid_login" }, 401);
    return json({
        session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
        },
    });
});
