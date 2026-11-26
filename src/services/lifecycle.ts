import type { User } from '@supabase/supabase-js';
import { db } from '@/lib/supabase';
import { emit } from '@/lib/bus';
import router from '@/router';
import { session } from '@/stores/session';
import { names, refreshProfiles } from '@/stores/directory';
import { refreshTitles } from '@/stores/titles';
import { loadChats, resetChats } from '@/stores/chats';
import { loadFriends, resetFriends } from '@/stores/friends';
import { startRealtime, stopRealtime } from '@/services/realtime';
import { clearDelivered, initNotifications, recheckNotifyPermission } from '@/services/notify';
import { clearPushState, removeCurrentPushToken } from '@/services/push';
import { flushPendingRoute } from '@/services/navigation';
import { installBackButton } from '@/services/backButton';
import { migrateLocalMutes } from '@/services/chatApi';
let currentId: string | null = null;
export async function initApp(): Promise<void> {
    installBackButton();
    const { data } = await db.auth.getSession();
    await handleSession(data.session?.user ?? null);
    db.auth.onAuthStateChange((_event, s) => {
        window.setTimeout(() => {
            void handleSession(s?.user ?? null);
        }, 0);
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden || !session.user)
            return;
        void loadChats();
        void loadFriends();
        void refreshProfiles();
        void refreshTitles();
        emit('resume');
        void clearDelivered();
        void recheckNotifyPermission();
    });
}
async function handleSession(user: User | null): Promise<void> {
    session.user = user;
    const id = user?.id ?? null;
    if (id !== currentId) {
        currentId = id;
        if (user)
            await afterLogin(user);
        else
            afterLogout();
    }
    const route = router.currentRoute.value;
    if (user && route.path === '/login')
        void router.replace('/tabs/chats');
    if (!user && route.matched.some(r => r.meta.requiresAuth))
        void router.replace('/login');
}
async function afterLogin(user: User): Promise<void> {
    const meta = (user.user_metadata as {
        username?: string;
    } | undefined)?.username ?? '';
    session.username = meta;
    if (meta)
        names[user.id] = meta;
    const { data } = await db.from('profiles').select('username').eq('id', user.id).maybeSingle();
    if (data?.username) {
        session.username = data.username;
        names[user.id] = data.username;
    }
    startRealtime();
    await Promise.all([loadFriends(), loadChats()]);
    flushPendingRoute();
    void migrateLocalMutes();
    void initNotifications();
}
function afterLogout(): void {
    stopRealtime();
    resetChats();
    resetFriends();
    clearPushState();
    session.username = '';
}
export async function logout(): Promise<void> {
    await removeCurrentPushToken();
    await db.auth.signOut();
    window.location.assign('/');
}
