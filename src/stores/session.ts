import { reactive } from 'vue';
import type { User } from '@supabase/supabase-js';

// 当前登录状态。这个文件不依赖其他业务模块，避免循环引用。
export const session = reactive({
  user: null as User | null,
  username: '',
});

export const myId = (): string => session.user?.id ?? '';
