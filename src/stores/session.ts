import { reactive } from 'vue';
import type { User } from '@supabase/supabase-js';
export const session = reactive({
    user: null as User | null,
    username: '',
});
export const myId = (): string => session.user?.id ?? '';
