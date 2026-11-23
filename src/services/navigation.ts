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
  openChat(cid);
}

// 打开聊天，并记下“从哪个标签页进来的”。返回时回到同一个标签页（聊天 / 好友 / 我的），
// 不再依赖导航栈的猜测。
export function openChat(cid: string, query: Record<string, string> = {}): void {
  const cur = router.currentRoute.value;
  const from = cur.path.startsWith('/tabs/') ? cur.path : '/tabs/chats';
  void router.push({ path: `/chat/${cid}`, query: { ...query, from } });
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
