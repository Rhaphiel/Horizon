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
router.beforeEach(to => {
    const needsAuth = to.matched.some(r => r.meta.requiresAuth);
    if (needsAuth && !session.user)
        return '/login';
    if (to.path === '/login' && session.user)
        return '/tabs/chats';
});
router.beforeEach((to, from) => {
    if (to.query.force === '1')
        return;
    const fromChat = from.path.startsWith('/chat/');
    const toTabs = to.path.startsWith('/tabs/');
    if (!fromChat || !toTabs)
        return;
    const q = from.query.from;
    const want = typeof q === 'string' && q.startsWith('/tabs/') ? q : '/tabs/chats';
    if (to.path !== want)
        return want;
});
export default router;
