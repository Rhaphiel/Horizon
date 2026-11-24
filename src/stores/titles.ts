import { reactive } from 'vue';
import { db } from '@/lib/supabase';

// 用户当前「显示中」的称号（只在拿到数据后才有值）
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

/** 批量拉取这些人「当前显示」的称号 */
export async function ensureTitles(ids: string[]): Promise<void> {
  const need = [...new Set(ids)].filter(id => id && !(id in shownTitles));
  if (!need.length) return;
  need.forEach(id => { shownTitles[id] = null; });

  const { data } = await db
    .from('profile_titles')
    .select('user_id,title,title_gradient,title_from,title_to,name_gradient,name_from,name_to')
    .in('user_id', need);

  (data as Row[] | null)?.forEach(row => {
    if (!row.title) return;
    shownTitles[row.user_id] = {
      text: row.title,
      titleGradient: !!row.title_gradient,
      titleFrom: row.title_from,
      titleTo: row.title_to,
      nameGradient: !!row.name_gradient,
      nameFrom: row.name_from,
      nameTo: row.name_to,
    };
  });
}

export function titleOf(id?: string | null): TitleInfo | null {
  return id ? (shownTitles[id] ?? null) : null;
}

/** 称号胶囊的样式（只看称号自己的渐变） */
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

/** 用户名文字的样式（只看用户名自己的渐变） */
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

// 自己拥有的称号列表（「我的 → 外观」里选显示哪个）
export interface OwnedTitle extends TitleInfo {
  id: string;
}

export async function loadMyTitles(uid: string): Promise<OwnedTitle[]> {
  const { data } = await db
    .from('user_titles')
    .select('id,title,title_gradient,title_from,title_to,name_gradient,name_from,name_to')
    .eq('user_id', uid)
    .order('created_at', { ascending: true });

  return ((data ?? []) as (Row & { id: string })[]).map(r => ({
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
