import { reactive, computed } from 'vue';
import { db } from '@/lib/supabase';
import { session } from '@/stores/session';
import { names, ensureNames } from '@/stores/directory';

export interface Member {
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export interface Chat {
  id: string;
  type: 'dm' | 'group';
  name: string | null;
  created_by: string;
  created_at: string;
  members: Member[];
  unread: number;            // 未读数（来自数据库，换手机也不会丢）
  lastAt: string | null;     // 最新一条消息的时间
  lastBody: string | null;
  lastSender: string | null;
}

export const chats = reactive({
  list: [] as Chat[],
  loaded: false,
  openId: null as string | null,   // 当前正在看的聊天
});

const time = (c: Chat): number => Date.parse(c.lastAt ?? c.created_at);

export const sortedChats = computed(() => [...chats.list].sort((a, b) => time(b) - time(a)));
export const totalUnread = computed(() => chats.list.reduce((n, c) => n + c.unread, 0));

export const getChat = (id: string): Chat | undefined => chats.list.find(c => c.id === id);

export function chatTitle(c: Chat): string {
  if (c.type === 'group') return c.name || '群聊';
  const other = c.members.find(m => m.user_id !== session.user?.id);
  return (other && names[other.user_id]) || '（未知用户）';
}

export function myRole(c: Chat): 'owner' | 'member' {
  return c.members.find(m => m.user_id === session.user?.id)?.role ?? 'member';
}

// 读取聊天列表（聊天 + 成员 + 未读统计）。成功返回 null，失败返回错误文字。
export async function loadChats(): Promise<string | null> {
  if (!session.user) return null;
  const [c, m, s] = await Promise.all([
    db.from('conversations').select('id,type,name,created_by,created_at'),
    db.from('conversation_members').select('conversation_id,user_id,role,joined_at'),
    db.rpc('get_conversation_stats'),
  ]);
  const err = c.error || m.error || s.error;
  if (err) return err.message;

  const convRows = c.data ?? [];
  const memberRows = m.data ?? [];
  const statRows = s.data ?? [];

  await ensureNames(memberRows.map(x => x.user_id));
  const stats = new Map(statRows.map(x => [x.conversation_id, x]));
  chats.list = convRows.map(row => {
    const st = stats.get(row.id);
    return {
      ...row,
      members: memberRows
        .filter(x => x.conversation_id === row.id)
        .map(x => ({ user_id: x.user_id, role: x.role, joined_at: x.joined_at })),
      unread: Number(st?.unread ?? 0),
      lastAt: st?.last_message_at ?? null,
      lastBody: st?.last_body ?? null,
      lastSender: st?.last_sender_id ?? null,
    };
  });
  chats.loaded = true;
  return null;
}

// 只刷新未读数 / 最新消息（别的设备读了消息、清空了记录时用）
export async function refreshStats(): Promise<void> {
  if (!session.user) return;
  const { data, error } = await db.rpc('get_conversation_stats');
  if (error) return;
  const stats = new Map((data ?? []).map(x => [x.conversation_id, x]));
  for (const c of chats.list) {
    const st = stats.get(c.id);
    c.unread = Number(st?.unread ?? 0);
    c.lastAt = st?.last_message_at ?? null;
    c.lastBody = st?.last_body ?? null;
    c.lastSender = st?.last_sender_id ?? null;
  }
}

// 来了新消息（或自己发了消息）：更新列表里的"最新一条"
export function touchChat(m: { conversation_id: string; body: string; sender_id: string; created_at: string }): void {
  const c = getChat(m.conversation_id);
  if (!c) return;
  c.lastAt = m.created_at;
  c.lastBody = m.body;
  c.lastSender = m.sender_id;
}

// 标记已读：本地立刻清零，稍后（300ms 防抖）通知数据库
const readTimers: Record<string, number> = {};
export function markRead(cid: string): void {
  const c = getChat(cid);
  if (c) c.unread = 0;
  window.clearTimeout(readTimers[cid]);
  readTimers[cid] = window.setTimeout(() => {
    void db.rpc('mark_conversation_read', { conv: cid }).then(({ error }) => {
      if (error) console.warn('标记已读失败：', error.message);
    });
  }, 300);
}

export function removeChat(cid: string): void {
  chats.list = chats.list.filter(c => c.id !== cid);
  if (chats.openId === cid) chats.openId = null;
}

export function resetChats(): void {
  chats.list = [];
  chats.loaded = false;
  chats.openId = null;
}
