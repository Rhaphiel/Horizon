import router from '@/router';
import { session } from '@/stores/session';

// 点通知 / 点弹窗时跳到某个聊天。冷启动时还没登录好，先记下来，登录后再跳。
let pendingCid: string | null = null;

export function routeToChat(cid?: string | null): void {
  if (!cid) return;
  if (!session.user) {
    pendingCid = cid;
    return;
  }
  if (router.currentRoute.value.path === `/chat/${cid}`) return;
  void openChat(cid);
}

// 打开聊天，并记下“从哪个标签页进来的”。
//
// 关键修复（0.4.1）：先把历史里的“当前页”归一成来源标签页，再 push 聊天页。
// 否则历史上可能是「好友 → 聊天 → 聊天页」，用户从聊天页返回（含安卓侧滑手势，
// 它等价于 history.back）时会回到“好友”，而不是他刚才所在的“聊天”。
export async function openChat(cid: string, query: Record<string, string> = {}): Promise<void> {
  const cur = router.currentRoute.value;
  const from = cur.path.startsWith('/tabs/') ? cur.path : '/tabs/chats';
  if (cur.path !== from) {
    await router.replace(from);   // 归一化：历史里只留“来源标签页 → 聊天页”
  }
  await router.push({ path: `/chat/${cid}`, query: { ...query, from } });
}

// 离开聊天页：回到进入时所在的标签页
export function leaveChat(): void {
  const cur = router.currentRoute.value;
  const q = cur.query.from;
  const from = typeof q === 'string' && q.startsWith('/tabs/') ? q : '/tabs/chats';
  const prev = (window.history.state as { back?: string | null } | null)?.back ?? null;
  if (prev && prev.split('?')[0] === from) {
    router.back();          // 上一页正好是来源页：正常后退（带返回动画）
  } else {
    void router.replace(from);   // 否则（比如从通知进入）直接去来源页
  }
}

export function flushPendingRoute(): void {
  if (pendingCid && session.user) {
    const cid = pendingCid;
    pendingCid = null;
    routeToChat(cid);
  }
}
