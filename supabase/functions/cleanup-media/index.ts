import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const BUCKET = 'chat-media';
const BATCH = 200;
const STALE_MS = 26 * 60 * 60 * 1000;
const SWEEP_MAX = 1000;
const AVATAR_BUCKET = 'avatars';
const AVATAR_KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const AVATAR_MARK = '/object/public/avatars/';
type Admin = ReturnType<typeof createClient>;
Deno.serve(async (req) => {
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
    const expired = await cleanExpired(admin);
    if (expired.error)
        return json(expired, 500);
    const sweep = await sweepStale(admin);
    const avatars = await sweepAvatars(admin);
    return json({
        ...expired,
        swept: sweep.removed,
        sweepError: sweep.error,
        avatarsRemoved: avatars.removed,
        avatarError: avatars.error,
    });
});
async function cleanExpired(admin: Admin): Promise<{
    cleaned: number;
    files: number;
    error?: string;
}> {
    const { data: rows, error } = await admin
        .from('messages')
        .select('id,media_path')
        .neq('media_type', 'text')
        .eq('is_expired', false)
        .not('media_path', 'is', null)
        .lte('expires_at', new Date().toISOString())
        .limit(BATCH);
    if (error)
        return { cleaned: 0, files: 0, error: error.message };
    if (!rows || !rows.length)
        return { cleaned: 0, files: 0 };
    const paths = rows.map((r: {
        media_path: string | null;
    }) => r.media_path).filter((p: string | null): p is string => !!p);
    const ids = rows.map((r: {
        id: string;
    }) => r.id);
    if (paths.length) {
        const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
        if (rmErr)
            return { cleaned: 0, files: 0, error: 'storage remove failed: ' + rmErr.message };
    }
    const { error: upErr } = await admin
        .from('messages')
        .update({ is_expired: true, media_path: null })
        .in('id', ids);
    if (upErr)
        return { cleaned: 0, files: paths.length, error: upErr.message };
    return { cleaned: ids.length, files: paths.length };
}
async function sweepStale(admin: Admin): Promise<{
    removed: number;
    error?: string;
}> {
    const cutoff = Date.now() - STALE_MS;
    const { data: top, error } = await admin.storage.from(BUCKET).list('', { limit: 1000 });
    if (error)
        return { removed: 0, error: error.message };
    let removed = 0;
    for (const entry of top ?? []) {
        if (removed >= SWEEP_MAX)
            break;
        if (entry.id)
            continue;
        const { data: files, error: listErr } = await admin.storage.from(BUCKET).list(entry.name, {
            limit: 1000,
            sortBy: { column: 'created_at', order: 'asc' },
        });
        if (listErr) {
            console.warn('list failed:', entry.name, listErr.message);
            continue;
        }
        const stale = (files ?? [])
            .filter((f: {
            id: string | null;
            created_at?: string;
        }) => f.id && f.created_at && Date.parse(f.created_at) < cutoff)
            .map((f: {
            name: string;
        }) => `${entry.name}/${f.name}`)
            .slice(0, SWEEP_MAX - removed);
        if (!stale.length)
            continue;
        const { error: rmErr } = await admin.storage.from(BUCKET).remove(stale);
        if (rmErr) {
            console.warn('sweep remove failed:', entry.name, rmErr.message);
            continue;
        }
        removed += stale.length;
        for (let i = 0; i < stale.length; i += 100) {
            const chunk = stale.slice(i, i + 100);
            const { error: upErr } = await admin
                .from('messages')
                .update({ is_expired: true, media_path: null })
                .in('media_path', chunk);
            if (upErr)
                console.warn('mark swept messages failed:', upErr.message);
        }
    }
    return { removed };
}
async function sweepAvatars(admin: Admin): Promise<{
    removed: number;
    error?: string;
}> {
    const [p, c] = await Promise.all([
        admin.from('profiles').select('avatar_url', { count: 'exact' }).not('avatar_url', 'is', null),
        admin.from('conversations').select('avatar_url', { count: 'exact' }).not('avatar_url', 'is', null),
    ]);
    if (p.error || c.error)
        return { removed: 0, error: (p.error || c.error)!.message };
    if ((p.data?.length ?? 0) !== (p.count ?? -1) || (c.data?.length ?? 0) !== (c.count ?? -1)) {
        return { removed: 0, error: 'avatar references truncated, skipped' };
    }
    const refs = [...(p.data ?? []), ...(c.data ?? [])] as {
        avatar_url: string | null;
    }[];
    const used = new Set<string>();
    for (const r of refs) {
        const path = avatarPath(r.avatar_url);
        if (!path)
            return { removed: 0, error: 'unrecognized avatar_url, skipped' };
        used.add(path);
    }
    const cutoff = Date.now() - AVATAR_KEEP_MS;
    const { data: top, error } = await admin.storage.from(AVATAR_BUCKET).list('', { limit: 1000 });
    if (error)
        return { removed: 0, error: error.message };
    let removed = 0;
    for (const entry of top ?? []) {
        if (removed >= SWEEP_MAX)
            break;
        if (entry.id)
            continue;
        const { data: files, error: listErr } = await admin.storage.from(AVATAR_BUCKET).list(entry.name, { limit: 1000 });
        if (listErr) {
            console.warn('avatar list failed:', entry.name, listErr.message);
            continue;
        }
        const stale = (files ?? [])
            .filter((f: {
            id: string | null;
            created_at?: string;
        }) => f.id && f.created_at && Date.parse(f.created_at) < cutoff)
            .map((f: {
            name: string;
        }) => `${entry.name}/${f.name}`)
            .filter((path: string) => !used.has(path))
            .slice(0, SWEEP_MAX - removed);
        if (!stale.length)
            continue;
        const { error: rmErr } = await admin.storage.from(AVATAR_BUCKET).remove(stale);
        if (rmErr) {
            console.warn('avatar remove failed:', entry.name, rmErr.message);
            continue;
        }
        removed += stale.length;
    }
    return { removed };
}
function avatarPath(url: string | null): string | null {
    if (!url)
        return null;
    const i = url.indexOf(AVATAR_MARK);
    if (i < 0)
        return null;
    try {
        return decodeURIComponent(url.slice(i + AVATAR_MARK.length).split(/[?#]/)[0]);
    }
    catch {
        return null;
    }
}
function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
