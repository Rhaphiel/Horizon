import type { RealtimeChannel } from '@supabase/supabase-js';
import { db } from '@/lib/supabase';
import { emit } from '@/lib/bus';
import { showToast } from '@/lib/toast';
import type { MessageRow } from '@/types/database';
import { session } from '@/stores/session';
import { chats, chatTitle, getChat, loadChats, markRead, refreshStats, removeChat, touchChat } from '@/stores/chats';
import { loadFriends } from '@/stores/friends';
import { notifyNewMessage } from '@/services/notify';

// 实时连接：别人发来的消息、被拉进群 / 被移出群、群被解散、好友申请，都会自动出现。
let channel: RealtimeChannel | null = null;

export function startRealtime(): void {
  const me = session.user;
  if (channel || !me) return;
  channel = db
    .channel('horizon-' + me.id)
    // 新消息（数据库行级安全保证只会收到自己有权看的）
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => {
      void onNewMessage(p.new as MessageRow);
    })
    // 有人加入群（含我被拉进新群）
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_members' }, () => {
      void loadChats();
    })
    // 有人退群 / 被移出（含我被移出）
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'conversation_members' }, p => {
      onMemberDeleted(p.old as { conversation_id?: string; user_id?: string });
    })
    // 我的已读位置 / 清空时间变化（比如在另一台设备上读了消息）
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${me.id}` }, () => {
      void refreshStats();
    })
    // 群被解散
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'conversations' }, p => {
      onConversationDeleted(p.old as { id?: string });
    })
    // 好友申请 / 通过 / 删除
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
      void loadFriends();
    })
    .subscribe();
}

export function stopRealtime(): void {
  if (channel) {
    void db.removeChannel(channel);
    channel = null;
  }
}

async function onNewMessage(m: MessageRow): Promise<void> {
  const me = session.user?.id;
  if (!me) return;
  emit('message', m);   // 通知正在打开的聊天页

  const known = !!getChat(m.conversation_id);
  if (!known) {
    await loadChats();   // 新聊天：刷新列表（未读数由数据库算好）
    if (getChat(m.conversation_id) && m.sender_id !== me) notifyNewMessage(m);
    return;
  }

  touchChat(m);
  if (m.sender_id === me) return;

  const c = getChat(m.conversation_id);
  if (chats.openId === m.conversation_id && !document.hidden) {
    markRead(m.conversation_id);   // 正在看这个聊天：直接算已读
  } else {
    if (c) c.unread += 1;
    notifyNewMessage(m);
  }
}

function onMemberDeleted(old: { conversation_id?: string; user_id?: string }): void {
  const cid = old.conversation_id;
  if (!cid) return;
  const c = getChat(cid);
  if (!c) return;
  if (old.user_id === session.user?.id) {
    const title = chatTitle(c);
    removeChat(cid);
    void showToast(`你已不在群聊「${title}」中`);
  } else {
    void loadChats();   // 别人退群 / 被移出：刷新成员列表
  }
}

function onConversationDeleted(old: { id?: string }): void {
  if (!old.id) return;
  const c = getChat(old.id);
  if (!c) return;
  const title = chatTitle(c);
  removeChat(old.id);
  void showToast(`群聊「${title}」已解散`);
}
