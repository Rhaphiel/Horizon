import { db } from '@/lib/supabase';
import { friendlyRpcError } from '@/lib/errors';
import { chats, getChat, loadChats, removeChat } from '@/stores/chats';

export async function startDm(friendId: string): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await db.rpc('create_dm', { friend: friendId });
  if (error || !data) return { id: null, error: friendlyRpcError(error?.message) };
  await loadChats();
  return { id: data, error: null };
}

export async function createGroup(name: string, memberIds: string[]): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await db.rpc('create_group', { group_name: name, member_ids: memberIds });
  if (error || !data) return { id: null, error: friendlyRpcError(error?.message) };
  await loadChats();
  return { id: data, error: null };
}

// 下面这些：成功返回 null，失败返回错误文字
export async function addMembers(cid: string, ids: string[]): Promise<string | null> {
  const { error } = await db.rpc('add_group_members', { conv: cid, member_ids: ids });
  if (error) return friendlyRpcError(error.message);
  await loadChats();
  return null;
}

export async function removeMember(cid: string, userId: string): Promise<string | null> {
  const { error } = await db.rpc('remove_group_member', { conv: cid, member: userId });
  if (error) return friendlyRpcError(error.message);
  await loadChats();
  return null;
}

export async function leaveGroup(cid: string): Promise<string | null> {
  const { error } = await db.rpc('leave_group', { conv: cid });
  if (error) return friendlyRpcError(error.message);
  removeChat(cid);
  return null;
}

export async function dissolveGroup(cid: string): Promise<string | null> {
  const { error } = await db.rpc('dissolve_group', { conv: cid });
  if (error) return friendlyRpcError(error.message);
  removeChat(cid);
  return null;
}

// 清空聊天记录：只对自己生效，别人的记录不受影响
export async function clearConversation(cid: string): Promise<string | null> {
  const { error } = await db.rpc('clear_conversation', { conv: cid });
  if (error) return friendlyRpcError(error.message);
  const c = getChat(cid);
  if (c) {
    c.unread = 0;
    c.lastAt = null;
    c.lastBody = null;
    c.lastSender = null;
  }
  return null;
}

export const isViewing = (cid: string): boolean => chats.openId === cid;
