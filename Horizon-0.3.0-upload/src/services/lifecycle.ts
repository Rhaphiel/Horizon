import type { User } from '@supabase/supabase-js';
import { db } from '@/lib/supabase';
import { emit } from '@/lib/bus';
import router from '@/router';
import { session } from '@/stores/session';
import { names } from '@/stores/directory';
import { loadChats, resetChats } from '@/stores/chats';
import { loadFriends, resetFriends } from '@/stores/friends';
import { startRealtime, stopRealtime } from '@/services/realtime';
import { clearDelivered, initNotifications } from '@/services/notify';
import { clearPushState, removeCurrentPushToken } from '@/services/push';
import { flushPendingRoute } from '@/services/navigation';
import { installBackButton } from '@/services/backButton';

let currentId: string | null = null;

// App 启动时调用一次：恢复登录状态、监听登录变化、安装返回键和前后台切换处理
export async function initApp(): Promise<void> {
  installBackButton();

  const { data } = await db.auth.getSession();
  await handleSession(data.session?.user ?? null);

  // 注意：这个回调里不要直接请求数据库，用 setTimeout 延后，否则可能卡住
  db.auth.onAuthStateChange((_event, s) => {
    window.setTimeout(() => {
      void handleSession(s?.user ?? null);
    }, 0);
  });

  // 从后台切回前台：补刷新列表（后台时实时连接可能断过）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !session.user) return;
    void loadChats();
    void loadFriends();
    emit('resume');
    void clearDelivered();
  });
}

async function handleSession(user: User | null): Promise<void> {
  session.user = user;
  const id = user?.id ?? null;
  if (id !== currentId) {
    currentId = id;
    if (user) await afterLogin(user);
    else afterLogout();
  }
  const route = router.currentRoute.value;
  if (user && route.path === '/login') void router.replace('/tabs/chats');
  if (!user && route.matched.some(r => r.meta.requiresAuth)) void router.replace('/login');
}

async function afterLogin(user: User): Promise<void> {
  const meta = (user.user_metadata as { username?: string } | undefined)?.username ?? '';
  session.username = meta;
  if (meta) names[user.id] = meta;

  const { data } = await db.from('profiles').select('username').eq('id', user.id).maybeSingle();
  if (data?.username) {
    session.username = data.username;
    names[user.id] = data.username;
  }

  startRealtime();
  await Promise.all([loadFriends(), loadChats()]);
  flushPendingRoute();
  void initNotifications();
}

function afterLogout(): void {
  stopRealtime();
  resetChats();
  resetFriends();
  clearPushState();
  session.username = '';
}

// 退出登录：先删掉这台设备的推送 Token，再退出，最后整页重载，保证界面状态干净
export async function logout(): Promise<void> {
  await removeCurrentPushToken();
  await db.auth.signOut();
  window.location.assign('/');
}
