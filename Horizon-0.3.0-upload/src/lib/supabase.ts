import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// 这两个值是"公开"的（publishable key 设计上就可以放进 App）。
// 安全靠数据库里的行级安全规则（RLS），不靠藏起这个 key。
// 绝对不要把 service_role / secret key 放进来。
const url = import.meta.env.VITE_SUPABASE_URL || 'https://osbjqvdzmqcztsxbsuyc.supabase.co';
const key = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_V0KVXmPOOnUTpzkQ7iLIow_JoCZ1ZBW';

export const db = createClient<Database>(url, key);
