import { reactive } from 'vue';
import { db } from '@/lib/supabase';

// 用户 id -> 用户名（缓存）
export const names = reactive<Record<string, string>>({});

export async function ensureNames(ids: string[]): Promise<void> {
  const need = [...new Set(ids)].filter(id => id && !names[id]);
  if (!need.length) return;
  const { data } = await db.from('profiles').select('id,username').in('id', need);
  data?.forEach(p => {
    names[p.id] = p.username;
  });
}

export const nameOf = (id?: string | null): string => (id && names[id]) || '某人';
