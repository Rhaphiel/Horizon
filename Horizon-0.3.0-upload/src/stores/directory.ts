import { reactive } from 'vue';
import { db } from '@/lib/supabase';

// 用户 id -> 用户名（缓存）
export const names = reactive<Record<string, string>>({});
// 用户 id -> 头像地址（缓存；没有自定义头像时为 null）
export const avatars = reactive<Record<string, string | null>>({});

export async function ensureNames(ids: string[]): Promise<void> {
  const need = [...new Set(ids)].filter(id => id && !names[id]);
  if (!need.length) return;
  const { data } = await db.from('profiles').select('id,username,avatar_url').in('id', need);
  data?.forEach(p => {
    names[p.id] = p.username;
    avatars[p.id] = p.avatar_url ?? null;
  });
}

// 已知用户名但缺头像时也能补一次（比如搜索结果只带了 username）
export async function ensureAvatars(ids: string[]): Promise<void> {
  const need = [...new Set(ids)].filter(id => id && !(id in avatars));
  if (!need.length) return;
  const { data } = await db.from('profiles').select('id,username,avatar_url').in('id', need);
  data?.forEach(p => {
    names[p.id] = p.username;
    avatars[p.id] = p.avatar_url ?? null;
  });
}

export const nameOf = (id?: string | null): string => (id && names[id]) || '某人';
export const avatarOf = (id?: string | null): string | null => (id ? avatars[id] ?? null : null);

// 自己换了头像后，把缓存同步一下，列表里立刻更新
export function setAvatar(id: string, url: string | null): void {
  if (id) avatars[id] = url;
}
