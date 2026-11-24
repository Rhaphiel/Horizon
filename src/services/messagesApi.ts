import { db } from '@/lib/supabase';
import { likePattern } from '@/lib/format';

export const PAGE = 50;            // 每次加载多少条
export const AROUND_BEFORE = 30;   // 跳转到某条消息时，往前加载多少条
export const AROUND_AFTER = 200;   // 往后最多加载多少条

const COLS = 'id,conversation_id,sender_id,body,created_at,media_type,media_path,media_name,media_mime,media_size,media_duration,expires_at,is_expired,recalled_at,reply_to,reply_preview' as const;

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

// 撤回：只写 recalled_at，正文保留（客户端用它做「重新编辑」）
export const recallMessage = (id: string) =>
  db.from('messages').update({ recalled_at: new Date().toISOString() })
    .eq('id', id).select(COLS).single();

export const sendMessage = (cid: string, senderId: string, body: string, replyTo?: string, replyPreview?: string) =>
  db.from('messages').insert({
    conversation_id: cid,
    sender_id: senderId,
    body,
    reply_to: replyTo ?? null,
    reply_preview: replyPreview ?? null,
  }).select(COLS).single();

// 搜索消息：传 cid 只搜这个聊天，不传搜所有聊天（数据库的行级安全保证只能搜到自己有权看的）
export function searchMessages(kw: string, cid?: string) {
  let q = db.from('messages').select(COLS)
    .ilike('body', likePattern(kw)).is('recalled_at', null).order('created_at', { ascending: false }).limit(50);
  if (cid) q = q.eq('conversation_id', cid);
  return q;
}
