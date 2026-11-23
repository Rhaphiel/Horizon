// 用户名登录：手机把 {username, password} 发过来，这里在服务器上用 service_role 查出该用户的邮箱，
// 再用邮箱 + 密码登录，只把登录会话（token）还给手机。邮箱不会出现在返回内容里，
// 所以不能通过这个接口反查别人的邮箱。
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: cors });

// 极简限流：同一个 IP 每分钟最多 10 次（函数实例重启会清零，只是挡一下暴力尝试）
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 10;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return json({ error: "too_many_requests" }, 429);

  let username = "";
  let password = "";
  try {
    const b = await req.json();
    username = String(b.username ?? "").trim();
    password = String(b.password ?? "");
  } catch {
    return json({ error: "invalid_login" }, 401);
  }
  // 和数据库里的用户名规则一致；不符合直接按“账号或密码错误”处理
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username) || !password) return json({ error: "invalid_login" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 用户名不区分大小写；ilike 里 _ 是通配符，要转义
  const { data: prof } = await admin
    .from("profiles")
    .select("id, username")
    .ilike("username", username.replace(/_/g, "\\_"))
    .maybeSingle();
  if (!prof || prof.username.toLowerCase() !== username.toLowerCase()) {
    return json({ error: "invalid_login" }, 401);
  }

  const { data: u, error: ue } = await admin.auth.admin.getUserById(prof.id);
  const email = u?.user?.email;
  if (ue || !email) return json({ error: "invalid_login" }, 401);

  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) return json({ error: "invalid_login" }, 401);

  return json({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
});
