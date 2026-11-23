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
  void router.push(`/chat/${cid}`);
}

export function flushPendingRoute(): void {
  if (pendingCid && session.user) {
    const cid = pendingCid;
    pendingCid = null;
    routeToChat(cid);
  }
}
