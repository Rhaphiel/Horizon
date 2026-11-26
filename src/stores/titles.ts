import { reactive } from 'vue';
import { db } from '@/lib/supabase';
export interface TitleInfo {
    text: string;
    titleGradient: boolean;
    titleFrom: string | null;
    titleTo: string | null;
    nameGradient: boolean;
    nameFrom: string | null;
    nameTo: string | null;
}
export const shownTitles = reactive<Record<string, TitleInfo | null>>({});
type Row = {
    user_id: string;
    title: string | null;
    title_gradient: boolean | null;
    title_from: string | null;
    title_to: string | null;
    name_gradient: boolean | null;
    name_from: string | null;
    name_to: string | null;
};
export async function ensureTitles(ids: string[]): Promise<void> {
    const need = [...new Set(ids)].filter(id => id && !(id in shownTitles));
    if (!need.length)
        return;
    need.forEach(id => { shownTitles[id] = null; });
    const { data } = await db
        .from('profile_titles')
        .select('user_id,title,title_gradient,title_from,title_to,name_gradient,name_from,name_to')
        .in('user_id', need);
    (data as Row[] | null)?.forEach(row => {
        shownTitles[row.user_id] = toInfo(row);
    });
}
function toInfo(row: Row): TitleInfo | null {
    if (!row.title)
        return null;
    return {
        text: row.title,
        titleGradient: !!row.title_gradient,
        titleFrom: row.title_from,
        titleTo: row.title_to,
        nameGradient: !!row.name_gradient,
        nameFrom: row.name_from,
        nameTo: row.name_to,
    };
}
const REFRESH_EVERY = 5 * 60 * 1000;
let lastRefresh = Date.now();
export async function refreshTitles(force = false): Promise<void> {
    if (!force && Date.now() - lastRefresh < REFRESH_EVERY)
        return;
    lastRefresh = Date.now();
    const ids = Object.keys(shownTitles);
    for (let i = 0; i < ids.length; i += 100) {
        const part = ids.slice(i, i + 100);
        const { data, error } = await db
            .from('profile_titles')
            .select('user_id,title,title_gradient,title_from,title_to,name_gradient,name_from,name_to')
            .in('user_id', part);
        if (error)
            return;
        const got = new Map((data as Row[] | null ?? []).map(r => [r.user_id, r]));
        part.forEach(id => {
            const row = got.get(id);
            shownTitles[id] = row ? toInfo(row) : null;
        });
    }
}
export async function reloadTitle(id: string): Promise<void> {
    delete shownTitles[id];
    await ensureTitles([id]);
}
export function titleOf(id?: string | null): TitleInfo | null {
    return id ? (shownTitles[id] ?? null) : null;
}
export function titleStyle(t: TitleInfo): Record<string, string> {
    if (t.titleGradient && t.titleFrom && t.titleTo) {
        return {
            backgroundImage: `linear-gradient(90deg, ${t.titleFrom}, ${t.titleTo})`,
            webkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
        };
    }
    return {};
}
export function nameStyle(t: TitleInfo | null): Record<string, string> {
    if (t?.nameGradient && t.nameFrom && t.nameTo) {
        return {
            backgroundImage: `linear-gradient(90deg, ${t.nameFrom}, ${t.nameTo})`,
            webkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
        };
    }
    return {};
}
export interface OwnedTitle extends TitleInfo {
    id: string;
}
export async function loadMyTitles(uid: string): Promise<OwnedTitle[]> {
    const { data } = await db
        .from('user_titles')
        .select('id,title,title_gradient,title_from,title_to,name_gradient,name_from,name_to')
        .eq('user_id', uid)
        .order('created_at', { ascending: true });
    return ((data ?? []) as (Row & {
        id: string;
    })[]).map(r => ({
        id: r.id,
        text: r.title ?? '',
        titleGradient: !!r.title_gradient,
        titleFrom: r.title_from,
        titleTo: r.title_to,
        nameGradient: !!r.name_gradient,
        nameFrom: r.name_from,
        nameTo: r.name_to,
    }));
}
