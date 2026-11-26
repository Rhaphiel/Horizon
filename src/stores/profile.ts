import { ref } from 'vue';
import { db } from '@/lib/supabase';
import { session } from '@/stores/session';
const KEY = 'hz:avatar';
export const myAvatar = ref<string | null>(localStorage.getItem(KEY));
export function setMyAvatar(url: string | null): void {
    myAvatar.value = url;
    if (url)
        localStorage.setItem(KEY, url);
    else
        localStorage.removeItem(KEY);
}
export async function loadMyAvatar(): Promise<void> {
    const uid = session.user?.id;
    if (!uid)
        return;
    const { data, error } = await db.from('profiles').select('avatar_url').eq('id', uid).maybeSingle();
    if (!error && data)
        setMyAvatar(data.avatar_url ?? null);
}
