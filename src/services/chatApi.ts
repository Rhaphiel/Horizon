import { db } from '@/lib/supabase';
import { friendlyRpcError } from '@/lib/errors';
import { chats, getChat, loadChats, removeChat } from '@/stores/chats';

export async function createGroup(name: string, memberIds: string[]): Promise<{
    id: string | null;
    error: string | null;
}> {
    const { data, error } = await db.rpc('create_group', { group_name: name, member_ids: memberIds });
    if (error || !data)
        return { id: null, error: friendlyRpcError(error?.message) };
    await loadChats();
    return { id: data, error: null };
}
export async function addMembers(cid: string, ids: string[]): Promise<string | null> {
    const { error } = await db.rpc('add_group_members', { conv: cid, member_ids: ids });
    if (error)
        return friendlyRpcError(error.message);
    await loadChats();
    return null;
}
export async function removeMember(cid: string, userId: string): Promise<string | null> {
    const { error } = await db.rpc('remove_group_member', { conv: cid, member: userId });
    if (error)
        return friendlyRpcError(error.message);
    await loadChats();
    return null;
}
export async function leaveGroup(cid: string): Promise<string | null> {
    const { error } = await db.rpc('leave_group', { conv: cid });
    if (error)
        return friendlyRpcError(error.message);
    removeChat(cid);
    return null;
}
export async function dissolveGroup(cid: string): Promise<string | null> {
    const { error } = await db.rpc('dissolve_group', { conv: cid });
    if (error)
        return friendlyRpcError(error.message);
    removeChat(cid);
    return null;
}
export async function renameGroup(cid: string, name: string): Promise<string | null> {
    const { error } = await db.rpc('rename_group', { conv: cid, new_name: name });
    if (error)
        return friendlyRpcError(error.message);
    const c = getChat(cid);
    if (c)
        c.name = name.trim();
    return null;
}
export async function clearConversation(cid: string): Promise<string | null> {
    const { error } = await db.rpc('clear_conversation', { conv: cid });
    if (error)
        return friendlyRpcError(error.message);
    const c = getChat(cid);
    if (c) {
        c.unread = 0;
        c.lastAt = null;
        c.lastBody = null;
        c.lastSender = null;
    }
    return null;
}
export async function setMuted(cid: string, on: boolean): Promise<string | null> {
    const c = getChat(cid);
    const prev = c?.muted ?? false;
    if (c)
        c.muted = on;
    const { error } = on
        ? await db.from('conversation_mutes').insert({ conversation_id: cid })
        : await db.from('conversation_mutes').delete().eq('conversation_id', cid);
    if (error && error.code !== '23505') {
        if (c)
            c.muted = prev;
        return friendlyRpcError(error.message);
    }
    forgetLocalMute(cid);
    return null;
}
const LOCAL_MUTE = 'hz:mute:';
function forgetLocalMute(cid: string): void {
    try {
        localStorage.removeItem(LOCAL_MUTE + cid);
    }
    catch { }
}
export async function migrateLocalMutes(): Promise<void> {
    const keys: string[] = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith(LOCAL_MUTE))
                keys.push(k);
        }
    }
    catch {
        return;
    }
    for (const k of keys) {
        const cid = k.slice(LOCAL_MUTE.length);
        const c = getChat(cid);
        if (!c)
            continue;
        let on = false;
        try {
            on = localStorage.getItem(k) === '1';
        }
        catch { }
        if (!on || c.muted)
            forgetLocalMute(cid);
        else
            await setMuted(cid, true);
    }
}
