import type { RealtimeChannel } from '@supabase/supabase-js';
import { db } from '@/lib/supabase';
import { emit } from '@/lib/bus';
import { showToast } from '@/lib/toast';
import type { MessageRow } from '@/types/database';
import { session } from '@/stores/session';
import { chats, chatTitle, getChat, loadChats, markRead, refreshStats, removeChat, touchChat } from '@/stores/chats';
import { loadFriends } from '@/stores/friends';
import { notifyNewMessage } from '@/services/notify';
let channel: RealtimeChannel | null = null;
let eventsChannel: RealtimeChannel | null = null;
let joinedOnce = false;
type UserEvent = {
    kind: 'conversation_dissolved' | 'removed_from_conversation' | 'member_left' | 'friendship_removed' | 'conversation_updated';
    conversation_id: string | null;
};
export function startRealtime(): void {
    const me = session.user;
    if (channel || !me)
        return;
    joinedOnce = false;
    channel = db
        .channel('horizon-' + me.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => {
        void onNewMessage(p.new as MessageRow);
    })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, p => {
        const m = p.new as MessageRow;
        emit('message-updated', m);
        if (m.recalled_at)
            scheduleRefreshStats();
    })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_members' }, () => {
        void loadChats();
    })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${me.id}` }, p => {
        onMyMembershipUpdated(p.new as MyMembership);
    })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friendships' }, () => {
        void loadFriends();
    })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'friendships' }, () => {
        void loadFriends();
    })
        .subscribe(status => {
        if (status !== 'SUBSCRIBED')
            return;
        if (joinedOnce) {
            void loadChats();
            void loadFriends();
            emit('resume');
        }
        joinedOnce = true;
    });
    eventsChannel = db
        .channel('horizon-events-' + me.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_events', filter: `user_id=eq.${me.id}` }, p => {
        onUserEvent(p.new as UserEvent);
    })
        .subscribe();
}
function onUserEvent(e: UserEvent): void {
    const me = session.user?.id;
    if (!me)
        return;
    switch (e.kind) {
        case 'conversation_dissolved':
            onConversationDeleted({ id: e.conversation_id ?? undefined });
            break;
        case 'removed_from_conversation':
            onMemberDeleted({ conversation_id: e.conversation_id ?? undefined, user_id: me });
            break;
        case 'member_left':
            void loadChats();
            break;
        case 'conversation_updated':
            void loadChats();
            break;
        case 'friendship_removed':
            void loadFriends();
            break;
    }
}
type MyMembership = {
    conversation_id?: string;
    last_read_at?: string;
    cleared_at?: string;
};
function onMyMembershipUpdated(row: MyMembership): void {
    const c = row.conversation_id ? getChat(row.conversation_id) : undefined;
    if (!c)
        return;
    const lastAt = c.lastAt ? Date.parse(c.lastAt) : 0;
    const readAt = row.last_read_at ? Date.parse(row.last_read_at) : 0;
    const clearedAt = row.cleared_at ? Date.parse(row.cleared_at) : 0;
    if (clearedAt && clearedAt >= lastAt && lastAt) {
        c.unread = 0;
        c.lastAt = null;
        c.lastBody = null;
        c.lastSender = null;
        return;
    }
    if (readAt && readAt >= lastAt) {
        c.unread = 0;
        return;
    }
    scheduleRefreshStats();
}
let statsTimer = 0;
function scheduleRefreshStats(): void {
    window.clearTimeout(statsTimer);
    statsTimer = window.setTimeout(() => {
        void refreshStats();
    }, 400);
}
export function stopRealtime(): void {
    if (channel) {
        void db.removeChannel(channel);
        channel = null;
    }
    if (eventsChannel) {
        void db.removeChannel(eventsChannel);
        eventsChannel = null;
    }
}
async function onNewMessage(m: MessageRow): Promise<void> {
    const me = session.user?.id;
    if (!me)
        return;
    emit('message', m);
    const known = !!getChat(m.conversation_id);
    if (!known) {
        await loadChats();
        if (getChat(m.conversation_id) && m.sender_id !== me)
            notifyNewMessage(m);
        return;
    }
    touchChat(m);
    if (m.sender_id === me)
        return;
    const c = getChat(m.conversation_id);
    if (chats.openId === m.conversation_id && !document.hidden) {
        markRead(m.conversation_id);
    }
    else {
        if (c)
            c.unread += 1;
        notifyNewMessage(m);
    }
}
function onMemberDeleted(old: {
    conversation_id?: string;
    user_id?: string;
}): void {
    const cid = old.conversation_id;
    if (!cid)
        return;
    const c = getChat(cid);
    if (!c)
        return;
    if (old.user_id === session.user?.id) {
        const title = chatTitle(c);
        removeChat(cid);
        void showToast(`你已不在群聊「${title}」中`);
    }
    else {
        void loadChats();
    }
}
function onConversationDeleted(old: {
    id?: string;
}): void {
    if (!old.id)
        return;
    const c = getChat(old.id);
    if (!c)
        return;
    const title = chatTitle(c);
    removeChat(old.id);
    void showToast(`群聊「${title}」已解散`);
}
