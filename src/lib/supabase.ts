import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
const url = import.meta.env.VITE_SUPABASE_URL || 'https://osbjqvdzmqcztsxbsuyc.supabase.co';
const key = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_V0KVXmPOOnUTpzkQ7iLIow_JoCZ1ZBW';
export const db = createClient<Database>(url, key);
