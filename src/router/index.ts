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

export default router;
