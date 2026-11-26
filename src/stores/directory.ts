import { reactive } from 'vue';
import { db } from '@/lib/supabase';
export const names = reactive<Record<string, string>>({});
export const avatars = reactive<Record<string, string | null>>({});
export async function ensureNames(ids: string[]): Promise<void> {
    const need = [...new Set(ids)].filter(id => id && !names[id]);
    if (!need.length)
        return;
    const { data } = await db.from('profiles').select('id,username,avatar_url').in('id', need);
    data?.forEach(p => {
        names[p.id] = p.username;
        avatars[p.id] = p.avatar_url ?? null;
    });
}
export async function ensureAvatars(ids: string[]): Promise<void> {
    const need = [...new Set(ids)].filter(id => id && !(id in avatars));
    if (!need.length)
        return;
    const { data } = await db.from('profiles').select('id,username,avatar_url').in('id', need);
    data?.forEach(p => {
        names[p.id] = p.username;
        avatars[p.id] = p.avatar_url ?? null;
    });
}
const REFRESH_EVERY = 5 * 60 * 1000;
let lastRefresh = Date.now();
export async function refreshProfiles(force = false): Promise<void> {
    if (!force && Date.now() - lastRefresh < REFRESH_EVERY)
        return;
    lastRefresh = Date.now();
    const ids = [...new Set([...Object.keys(names), ...Object.keys(avatars)])];
    for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await db.from('profiles').select('id,username,avatar_url').in('id', ids.slice(i, i + 100));
        if (error)
            return;
        data?.forEach(p => {
            if (names[p.id] !== p.username)
                names[p.id] = p.username;
            const url = p.avatar_url ?? null;
            if (avatars[p.id] !== url)
                avatars[p.id] = url;
        });
    }
}
export const nameOf = (id?: string | null): string => (id && names[id]) || '某人';
export const avatarOf = (id?: string | null): string | null => (id ? avatars[id] ?? null : null);
export function setAvatar(id: string, url: string | null): void {
    if (id)
        avatars[id] = url;
}
