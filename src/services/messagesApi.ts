import { db } from '@/lib/supabase';
import { likePattern } from '@/lib/format';

export const PAGE = 50;            // 每次加载多少条
export const AROUND_BEFORE = 30;   // 跳转到某条消息时，往前加载多少条
export const AROUND_AFTER = 200;   // 往后最多加载多少条

const COLS = 'id,conversation_id,sender_id,body,created_at' as const;

export const fetchLatest = (cid: string) =>
  db.from('messages').select(COLS).eq('conversation_id', cid)
    .order('created_at', { ascending: false }).limit(PAGE);

export const fetchOlder = (cid: string, before: string) =>
  db.from('messages').select(COLS).eq('conversation_id', cid)
    .lt('created_at', before).order('created_at', { ascending: false }).limit(PAGE);

export const fetchNewer = (cid: string, after: string) =>
  db.from('messages').select(COLS).eq('conversation_id', cid)
    .gt('created_at', after).order('created_at', { ascending: true }).limit(PAGE);

// 目标消息及它之前的 AROUND_BEFORE 条（含目标）
export const fetchBefore = (cid: string, at: string) =>
  db.from('messages').select(COLS).eq('conversation_id', cid)
    .lte('created_at', at).order('created_at', { ascending: false }).limit(AROUND_BEFORE);

// 目标消息之后的 AROUND_AFTER 条
export const fetchAfter = (cid: string, at: string) =>
  db.from('messages').select(COLS).eq('conversation_id', cid)
    .gt('created_at', at).order('created_at', { ascending: true }).limit(AROUND_AFTER);

export const sendMessage = (cid: string, senderId: string, body: string) =>
  db.from('messages').insert({ conversation_id: cid, sender_id: senderId, body })
    .select(COLS).single();

// 搜索消息：传 cid 只搜这个聊天，不传搜所有聊天（数据库的行级安全保证只能搜到自己有权看的）
export function searchMessages(kw: string, cid?: string) {
  let q = db.from('messages').select(COLS)
    .ilike('body', likePattern(kw)).order('created_at', { ascending: false }).limit(50);
  if (cid) q = q.eq('conversation_id', cid);
  return q;
}
