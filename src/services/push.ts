import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { db } from '@/lib/supabase';
import { session } from '@/stores/session';
import { notifyOn } from '@/stores/settings';
import { routeToChat } from '@/services/navigation';
const native = Capacitor.isNativePlatform();
let pushToken: string | null = null;
let remoteRegistered = false;
let listenersInstalled = false;
let registering = false;
export const isRemotePushRegistered = (): boolean => remoteRegistered;
export const currentPushToken = (): string | null => pushToken;
function installListeners(): void {
    if (listenersInstalled)
        return;
    listenersInstalled = true;
    void PushNotifications.addListener('registration', async (t) => {
        pushToken = t.value || null;
        remoteRegistered = !!pushToken;
        if (pushToken)
            await savePushToken(pushToken);
    });
    void PushNotifications.addListener('registrationError', e => {
        remoteRegistered = false;
        console.warn('FCM 注册失败：', e);
    });
    void PushNotifications.addListener('pushNotificationReceived', n => {
        console.debug('收到前台 FCM 消息：', n);
    });
    void PushNotifications.addListener('pushNotificationActionPerformed', action => {
        const data = (action.notification.data ?? {}) as Record<string, string | undefined>;
        routeToChat(data.cid || data.conversation_id);
    });
}
export async function savePushToken(token: string): Promise<void> {
    const me = session.user;
    if (!token || !me || !notifyOn.value)
        return;
    const { error } = await db.from('push_tokens').upsert({
        user_id: me.id,
        provider: 'fcm',
        token,
        platform: 'android',
        device_name: 'Horizon Android',
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider,token' });
    if (error)
        console.warn('保存 FCM Token 失败：', error.message);
}
export async function ensureRemotePush(ask = true): Promise<void> {
    if (!native || !session.user || !notifyOn.value || registering)
        return;
    installListeners();
    registering = true;
    try {
        let permission = await PushNotifications.checkPermissions();
        if (permission.receive !== 'granted' && ask)
            permission = await PushNotifications.requestPermissions();
        if (permission.receive !== 'granted') {
            console.warn('用户未授予远程通知权限');
            return;
        }
        await PushNotifications.register();
    }
    catch (e) {
        console.warn('FCM 初始化失败：', e);
    }
    finally {
        registering = false;
    }
}
export async function removeCurrentPushToken(): Promise<void> {
    const me = session.user;
    if (me && pushToken) {
        const { error } = await db.from('push_tokens').delete().eq('user_id', me.id).eq('token', pushToken);
        if (error)
            console.warn('删除设备 Token 失败：', error.message);
    }
    remoteRegistered = false;
}
export function clearPushState(): void {
    pushToken = null;
    remoteRegistered = false;
}
