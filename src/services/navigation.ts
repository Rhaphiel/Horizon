import router from '@/router';
import { session } from '@/stores/session';
let pendingCid: string | null = null;
export function routeToChat(cid?: string | null): void {
    if (!cid)
        return;
    if (!session.user) {
        pendingCid = cid;
        return;
    }
    if (router.currentRoute.value.path === `/chat/${cid}`)
        return;
    void openChat(cid);
}
export async function openChat(cid: string, query: Record<string, string> = {}): Promise<void> {
    const cur = router.currentRoute.value;
    const q = cur.query.from;
    const inherited = typeof q === 'string' && q.startsWith('/tabs/') ? q : '/tabs/chats';
    const from = cur.path.startsWith('/tabs/') ? cur.path : inherited;
    if (cur.path !== from) {
        await router.replace(from);
    }
    await router.push({ path: `/chat/${cid}`, query: { ...query, from } });
}
export function leaveChat(): void {
    const cur = router.currentRoute.value;
    const q = cur.query.from;
    const from = typeof q === 'string' && q.startsWith('/tabs/') ? q : '/tabs/chats';
    const prev = (window.history.state as {
        back?: string | null;
    } | null)?.back ?? null;
    if (prev && prev.split('?')[0] === from) {
        router.back();
    }
    else {
        void router.replace(from);
    }
}
export function flushPendingRoute(): void {
    if (pendingCid && session.user) {
        const cid = pendingCid;
        pendingCid = null;
        routeToChat(cid);
    }
}
