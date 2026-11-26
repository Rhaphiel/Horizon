import { db } from '@/lib/supabase';
import { likePattern } from '@/lib/format';
export const PAGE = 50;
export const AROUND_BEFORE = 30;
export const AROUND_AFTER = 200;
const COLS = 'id,conversation_id,sender_id,body,created_at,media_type,media_path,media_name,media_mime,media_size,media_duration,expires_at,is_expired,recalled_at,reply_to,reply_preview' as const;
export const fetchLatest = (cid: string) => db.from('messages').select(COLS).eq('conversation_id', cid)
    .order('created_at', { ascending: false }).limit(PAGE);
export const fetchOlder = (cid: string, before: string) => db.from('messages').select(COLS).eq('conversation_id', cid)
    .lt('created_at', before).order('created_at', { ascending: false }).limit(PAGE);
export const fetchNewer = (cid: string, after: string) => db.from('messages').select(COLS).eq('conversation_id', cid)
    .gt('created_at', after).order('created_at', { ascending: true }).limit(PAGE);
export const fetchBefore = (cid: string, at: string) => db.from('messages').select(COLS).eq('conversation_id', cid)
    .lte('created_at', at).order('created_at', { ascending: false }).limit(AROUND_BEFORE);
export const fetchAfter = (cid: string, at: string) => db.from('messages').select(COLS).eq('conversation_id', cid)
    .gt('created_at', at).order('created_at', { ascending: true }).limit(AROUND_AFTER);
export const fetchGroupImages = (cid: string) => db.from('messages').select(COLS).eq('conversation_id', cid).eq('media_type', 'image')
    .eq('is_expired', false).is('recalled_at', null).not('media_path', 'is', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(60);
export const fetchLinkMessages = (cid: string) => db.from('messages').select(COLS).eq('conversation_id', cid).eq('media_type', 'text')
    .is('recalled_at', null).ilike('body', '%http%')
    .order('created_at', { ascending: false }).limit(100);
export const recallMessage = (id: string) => db.from('messages').update({ recalled_at: new Date().toISOString() })
    .eq('id', id).select(COLS).single();
export const sendMessage = (cid: string, senderId: string, body: string, replyTo?: string, replyPreview?: string) => db.from('messages').insert({
    conversation_id: cid,
    sender_id: senderId,
    body,
    reply_to: replyTo ?? null,
    reply_preview: replyPreview ?? null,
}).select(COLS).single();
export function searchMessages(kw: string, cid?: string) {
    let q = db.from('messages').select(COLS)
        .eq('media_type', 'text')
        .ilike('body', likePattern(kw)).is('recalled_at', null).order('created_at', { ascending: false }).limit(50);
    if (cid)
        q = q.eq('conversation_id', cid);
    return q;
}
