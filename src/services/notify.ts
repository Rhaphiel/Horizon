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

// ============ 应用内弹窗（App 在前台、但你没在看那个聊天时） ============
export interface Banner {
  key: number;
  cid: string;
  title: string;
  text: string;
}
export const banners = reactive<Banner[]>([]);

let bannerSeq = 0;
const lastBannerAt: Record<string, number> = {};   // 聊天 id -> 上次弹窗时间（同一聊天 1.5 秒内只弹一次）

export function dismissBanner(key: number): void {
  const i = banners.findIndex(b => b.key === key);
  if (i >= 0) banners.splice(i, 1);
}

function messageTitle(m: MessageRow): string {
  const c = getChat(m.conversation_id);
  const who = nameOf(m.sender_id);
  return c && c.type === 'group' ? `${chatTitle(c)} · ${who}` : who;
}

function showBanner(m: MessageRow): void {
  const now = Date.now();
  if (lastBannerAt[m.conversation_id] && now - lastBannerAt[m.conversation_id] < 1500) return;
  lastBannerAt[m.conversation_id] = now;

  const key = ++bannerSeq;
  banners.push({
    key,
    cid: m.conversation_id,
    title: messageTitle(m),
    text: oneLine(m.body || '') || '（空消息）',
  });
  while (banners.length > 3) banners.shift();   // 最多同时 3 条
  window.setTimeout(() => dismissBanner(key), 5000);
}

export function openBanner(b: Banner): void {
  dismissBanner(b.key);
  routeToChat(b.cid);
}

// ============ 系统通知（锁屏 / 横幅 / 角标） ============
// 普通浏览器里不启用，只用应用内弹窗。
const native = Capacitor.isNativePlatform();
let lnReady = false;
let lnInit = false;

export async function ensureSystemNotify(): Promise<void> {
  if (!native || lnInit) return;
  lnInit = true;
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') {
      console.warn('通知权限被拒绝');
      return;
    }

    // importance 5 = 高优先级：只有这个级别才会有顶部横幅
    await LocalNotifications.createChannel({
      id: 'msg',
      name: '新消息',
      description: '有人给你发消息时提醒',
      importance: 5,
      visibility: 1,
      lights: true,
      vibration: true,
    });

    void LocalNotifications.addListener('localNotificationActionPerformed', ev => {
      const extra = ev.notification.extra as { cid?: string } | undefined;
      routeToChat(extra?.cid);
    });

    lnReady = true;
  } catch (e) {
    console.warn('系统通知初始化失败：', e);
  }
}

// 聊天 id（字符串）-> 通知 id（整数）；同一聊天反复提醒会覆盖，不会堆一屏
function cidToId(cid: string): number {
  let h = 0;
  for (let i = 0; i < cid.length; i++) h = (h * 31 + cid.charCodeAt(i)) | 0;
  return (Math.abs(h) % 100000) + 1;
}

async function systemNotify(m: MessageRow): Promise<void> {
  if (!native || !lnReady) return;
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
  } catch (e) {
    console.warn('系统通知发送失败：', e);
  }
}

export async function clearDelivered(): Promise<void> {
  if (!native || !lnReady) return;
  try {
    await LocalNotifications.removeAllDeliveredNotifications();
  } catch {
    /* 忽略 */
  }
}

// ============ 对外入口 ============
// 新消息提醒：前台用应用内弹窗；后台用系统通知（已注册 FCM 时由 FCM 负责，避免重复）
export function notifyNewMessage(m: MessageRow): void {
  if (!notifyOn.value || !session.user || m.sender_id === session.user.id) return;
  if (document.hidden) {
    if (!isRemotePushRegistered()) void systemNotify(m);
    return;
  }
  showBanner(m);
}

// 登录后初始化通知
export async function initNotifications(): Promise<void> {
  if (!notifyOn.value) return;
  await ensureSystemNotify();
  await ensureRemotePush();
}

// 开关通知
export async function setNotify(on: boolean): Promise<void> {
  persistNotify(on);
  if (!session.user) return;
  if (on) {
    await ensureSystemNotify();
    const token = currentPushToken();
    if (token) await savePushToken(token);
    await ensureRemotePush();
  } else {
    await removeCurrentPushToken();
  }
}
