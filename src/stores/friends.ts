import { reactive } from 'vue';
import { db } from '@/lib/supabase';
import { likePattern } from '@/lib/format';
import { session } from '@/stores/session';
import { names, ensureNames } from '@/stores/directory';

export interface FriendRow {
  rowId: string;   // friendships 表里这条记录的 id
  id: string;      // 对方的用户 id
  name: string;
}
export interface Relation {
  rowId: string;
  status: 'pending' | 'accepted';
  incoming: boolean;   // true = 对方向我发的申请
}

export const friendState = reactive({
  friends: [] as FriendRow[],
  incoming: [] as FriendRow[],
  outgoing: [] as FriendRow[],
  relations: {} as Record<string, Relation>,
  loaded: false,
});

export async function loadFriends(): Promise<string | null> {
  const me = session.user;
  if (!me) return null;
  const { data, error } = await db.from('friendships').select('id,requester,addressee,status');
  if (error) return error.message;

  await ensureNames(data.flatMap(r => [r.requester, r.addressee]).filter(id => id !== me.id));

  const rel: Record<string, Relation> = {};
  const friends: FriendRow[] = [];
  const incoming: FriendRow[] = [];
  const outgoing: FriendRow[] = [];
  for (const r of data) {
    const other = r.requester === me.id ? r.addressee : r.requester;
    const row: FriendRow = { rowId: r.id, id: other, name: names[other] || '（未知用户）' };
    rel[other] = { rowId: r.id, status: r.status, incoming: r.addressee === me.id };
    if (r.status === 'accepted') friends.push(row);
    else if (r.addressee === me.id) incoming.push(row);
    else outgoing.push(row);
  }
  friendState.relations = rel;
  friendState.friends = friends;
  friendState.incoming = incoming;
  friendState.outgoing = outgoing;
  friendState.loaded = true;
  return null;
}

export async function searchUsers(q: string): Promise<{ rows: { id: string; username: string }[]; error: string | null }> {
  const me = session.user;
  if (!me) return { rows: [], error: null };
  const { data, error } = await db
    .from('profiles')
    .select('id,username')
    .ilike('username', likePattern(q))
    .neq('id', me.id)
    .limit(20);
  if (error) return { rows: [], error: error.message };
  data.forEach(p => {
    names[p.id] = p.username;
  });
  return { rows: data, error: null };
}

// 下面三个函数：成功返回 null，失败返回错误文字
export async function sendRequest(userId: string): Promise<string | null> {
  const me = session.user;
  if (!me) return '请先登录';
  const { error } = await db.from('friendships').insert({ requester: me.id, addressee: userId });
  if (error) return error.code === '23505' ? '已经申请过，或你们已经是好友' : '发送失败：' + error.message;
  return null;
}

export async function acceptRequest(rowId: string): Promise<string | null> {
  const { error } = await db.from('friendships').update({ status: 'accepted' }).eq('id', rowId);
  return error ? '操作失败：' + error.message : null;
}

export async function removeFriendship(rowId: string): Promise<string | null> {
  const { error } = await db.from('friendships').delete().eq('id', rowId);
  return error ? '操作失败：' + error.message : null;
}

export function resetFriends(): void {
  friendState.friends = [];
  friendState.incoming = [];
  friendState.outgoing = [];
  friendState.relations = {};
  friendState.loaded = false;
}
