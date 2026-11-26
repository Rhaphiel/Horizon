import { onBeforeUnmount, watch } from 'vue';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { actionSheetController, alertController, modalController, popoverController } from '@ionic/vue';
import router from '@/router';
import { showToast } from '@/lib/toast';
import { leaveChat } from '@/services/navigation';
type Handler = () => boolean;
const handlers: Handler[] = [];
export function registerBackHandler(fn: Handler): () => void {
    handlers.push(fn);
    return () => {
        const i = handlers.indexOf(fn);
        if (i >= 0)
            handlers.splice(i, 1);
    };
}
export function useBackToClose(isOpen: () => boolean, close: () => void): void {
    let off: (() => void) | null = null;
    watch(isOpen, open => {
        off?.();
        off = null;
        if (open) {
            off = registerBackHandler(() => {
                close();
                return true;
            });
        }
    }, { immediate: true });
    onBeforeUnmount(() => {
        off?.();
        off = null;
    });
}
let lastPress = 0;
export function installBackButton(): void {
    if (!Capacitor.isNativePlatform())
        return;
    void App.addListener('backButton', async () => {
        for (const ctrl of [alertController, actionSheetController, modalController, popoverController]) {
            const top = await ctrl.getTop();
            if (top) {
                await top.dismiss();
                return;
            }
        }
        for (let i = handlers.length - 1; i >= 0; i--) {
            if (handlers[i]())
                return;
        }
        const path = router.currentRoute.value.path;
        if (/^\/chat\/[^/]+$/.test(path)) {
            leaveChat();
        }
        else if (path.startsWith('/chat/')) {
            router.back();
        }
        else if (path === '/tabs/friends' || path === '/tabs/me') {
            void router.replace('/tabs/chats');
        }
        else {
            const now = Date.now();
            if (now - lastPress < 2000) {
                await App.exitApp();
            }
            else {
                lastPress = now;
                void showToast('再按一次返回键退出', 1800);
            }
        }
    });
}
