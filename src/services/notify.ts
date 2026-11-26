import { reactive } from 'vue';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { session } from '@/stores/session';
import { notifyOn, persistNotify } from '@/stores/settings';
import { getChat, chatTitle } from '@/stores/chats';
import { nameOf } from '@/stores/directory';
import { oneLine } from '@/lib/format';
import type { MessageRow } from '@/types/database';
import { routeToChat } from '@/services/navigation';
import { currentPushToken, ensureRemotePush, isRemotePushRegistered, removeCurrentPushToken, savePushToken } from '@/services/push';
export interface Banner {
    key: number;
    cid: string;
    title: string;
    text: string;
}
export const banners = reactive<Banner[]>([]);
let bannerSeq = 0;
const lastBannerAt: Record<string, number> = {};
export function dismissBanner(key: number): void {
    const i = banners.findIndex(b => b.key === key);
    if (i >= 0)
        banners.splice(i, 1);
}
function messageTitle(m: MessageRow): string {
    const c = getChat(m.conversation_id);
    const who = nameOf(m.sender_id);
    return c && c.type === 'group' ? `${chatTitle(c)} · ${who}` : who;
}
function showBanner(m: MessageRow): void {
    const now = Date.now();
    if (lastBannerAt[m.conversation_id] && now - lastBannerAt[m.conversation_id] < 1500)
        return;
    lastBannerAt[m.conversation_id] = now;
    const key = ++bannerSeq;
    banners.push({
        key,
        cid: m.conversation_id,
        title: messageTitle(m),
        text: oneLine(m.body || '') || '（空消息）',
    });
    while (banners.length > 3)
        banners.shift();
    window.setTimeout(() => dismissBanner(key), 5000);
}
export function openBanner(b: Banner): void {
    dismissBanner(b.key);
    routeToChat(b.cid);
}
const native = Capacitor.isNativePlatform();
let lnReady = false;
let lnBusy: Promise<boolean> | null = null;
let lnListener = false;
export function ensureSystemNotify(ask = true): Promise<boolean> {
    if (!native)
        return Promise.resolve(true);
    if (lnReady)
        return Promise.resolve(true);
    if (!lnBusy) {
        lnBusy = initSystemNotify(ask).finally(() => {
            lnBusy = null;
        });
    }
    return lnBusy;
}
async function initSystemNotify(ask: boolean): Promise<boolean> {
    try {
        if (!lnListener) {
            lnListener = true;
            void LocalNotifications.addListener('localNotificationActionPerformed', ev => {
                const extra = ev.notification.extra as {
                    cid?: string;
                } | undefined;
                routeToChat(extra?.cid);
            });
        }
        let perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted' && ask)
            perm = await LocalNotifications.requestPermissions();
        if (perm.display !== 'granted') {
            console.warn('通知权限未开启');
            return false;
        }
        await LocalNotifications.createChannel({
            id: 'msg',
            name: '新消息',
            description: '有人给你发消息时提醒',
            importance: 5,
            visibility: 1,
            lights: true,
            vibration: true,
        });
        lnReady = true;
        return true;
    }
    catch (e) {
        console.warn('系统通知初始化失败：', e);
        return false;
    }
}
function cidToId(cid: string): number {
    let h = 0;
    for (let i = 0; i < cid.length; i++)
        h = (h * 31 + cid.charCodeAt(i)) | 0;
    return (Math.abs(h) % 100000) + 1;
}
async function systemNotify(m: MessageRow): Promise<void> {
    if (!native || !lnReady)
        return;
    try {
        await LocalNotifications.schedule({
            notifications: [
                {
                    id: cidToId(m.conversation_id),
                    title: messageTitle(m),
                    body: oneLine(m.body || '（新消息）').slice(0, 120),
                    channelId: 'msg',
                    extra: { cid: m.conversation_id },
                    autoCancel: true,
                },
            ],
        });
    }
    catch (e) {
        console.warn('系统通知发送失败：', e);
    }
}
export async function clearDelivered(): Promise<void> {
    if (!native || !lnReady)
        return;
    try {
        await LocalNotifications.removeAllDeliveredNotifications();
    }
    catch {
    }
}
export function notifyNewMessage(m: MessageRow): void {
    if (!notifyOn.value || !session.user || m.sender_id === session.user.id)
        return;
    if (getChat(m.conversation_id)?.muted)
        return;
    if (document.hidden) {
        if (!isRemotePushRegistered())
            void systemNotify(m);
        return;
    }
    showBanner(m);
}
export async function initNotifications(): Promise<void> {
    if (!notifyOn.value)
        return;
    const granted = await ensureSystemNotify();
    await ensureRemotePush(granted);
}
let lastPushRetry = 0;
export async function recheckNotifyPermission(): Promise<void> {
    if (!notifyOn.value || !session.user)
        return;
    if (!lnReady)
        await ensureSystemNotify(false);
    if (!isRemotePushRegistered() && Date.now() - lastPushRetry > 10 * 60 * 1000) {
        lastPushRetry = Date.now();
        await ensureRemotePush(false);
    }
}
export async function setNotify(on: boolean): Promise<boolean> {
    persistNotify(on);
    if (!session.user)
        return true;
    if (on) {
        const granted = await ensureSystemNotify();
        const token = currentPushToken();
        if (token)
            await savePushToken(token);
        await ensureRemotePush(granted);
        return granted;
    }
    await removeCurrentPushToken();
    return true;
}
