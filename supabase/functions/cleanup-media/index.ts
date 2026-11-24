// Horizon：清理过期多媒体（24 小时）
// 由 pg_cron 每 15 分钟调用一次（见 supabase/templates/media-cleanup-cron.sql.example）
// 逻辑：找出已过期但未清理的媒体消息 → 删除 Storage 文件 → 标记 is_expired、清空 media_path
// 幂等：文件已不存在（404）也算清理成功，避免死循环重试。

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BATCH = 200;

Deno.serve(async (req) => {
  // 简单鉴权：带 service_role（cron 里配置）或自定义头
  const auth = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const url = Deno.env.get('SUPABASE_URL') ?? '';

  if (!url || !serviceKey) {
    return json({ error: 'server_misconfigured' }, 500);
  }
  if (!auth.includes(serviceKey)) {
    return json({ error: 'forbidden' }, 403);
  }

  const admin = createClient(url, serviceKey);

  const { data: rows, error } = await admin
    .from('messages')
    .select('id,media_path')
    .neq('media_type', 'text')
    .eq('is_expired', false)
    .not('media_path', 'is', null)
    .lte('expires_at', new Date().toISOString())
    .limit(BATCH);

  if (error) return json({ error: error.message }, 500);
  if (!rows || !rows.length) return json({ cleaned: 0 });

  const paths = rows.map((r: { media_path: string | null }) => r.media_path).filter((p: string | null): p is string => !!p);
  const ids = rows.map((r: { id: string }) => r.id);

  let removed = 0;
  if (paths.length) {
    const { error: rmErr } = await admin.storage.from('chat-media').remove(paths);
    // 文件不存在不阻塞：照样标记过期
    if (rmErr) console.warn('storage remove warning:', rmErr.message);
    removed = paths.length;
  }

  const { error: upErr } = await admin
    .from('messages')
    .update({ is_expired: true, media_path: null })
    .in('id', ids);

  if (upErr) return json({ error: upErr.message, removed }, 500);

  return json({ cleaned: ids.length, files: removed });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
