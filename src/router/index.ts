import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { session } from '@/stores/session';

const routes: Array<RouteRecordRaw> = [
  { path: '/', redirect: '/tabs/chats' },
  { path: '/login', component: () => import('@/views/LoginPage.vue') },
  {
    path: '/tabs/',
    component: () => import('@/views/TabsPage.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/tabs/chats' },
      { path: 'chats', component: () => import('@/views/ChatsPage.vue') },
      { path: 'friends', component: () => import('@/views/FriendsPage.vue') },
      { path: 'me', component: () => import('@/views/MePage.vue') },
    ],
  },
  { path: '/chat/:id', component: () => import('@/views/ChatPage.vue'), meta: { requiresAuth: true } },
  { path: '/chat/:id/info', component: () => import('@/views/GroupInfoPage.vue'), meta: { requiresAuth: true } },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// 没登录不能进主页面；已登录就不用再看登录页
router.beforeEach(to => {
  const needsAuth = to.matched.some(r => r.meta.requiresAuth);
  if (needsAuth && !session.user) return '/login';
  if (to.path === '/login' && session.user) return '/tabs/chats';
});

// 从聊天页「离开」到标签页时，强制回到进入聊天时所在的标签。
// 为什么需要：安卓侧滑/返回手势走的是浏览器历史，历史里可能残留着别的标签页
// （比如先去了「我的」再去「聊天」），光靠 router.back() 会回到那个残留标签。
// 这里在路由层兜底：只要不是目标标签，就重定向过去。
router.beforeEach((to, from) => {
  if (to.query.force === '1') return;          // 解散群/被移出等明确跳转，不拦
  const fromChat = from.path.startsWith('/chat/');
  const toTabs = to.path.startsWith('/tabs/');
  if (!fromChat || !toTabs) return;

  const q = from.query.from;
  const want = typeof q === 'string' && q.startsWith('/tabs/') ? q : '/tabs/chats';
  if (to.path !== want) return want;
});

export default router;
