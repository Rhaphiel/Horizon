import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { actionSheetController, alertController, modalController, popoverController } from '@ionic/vue';
import router from '@/router';
import { showToast } from '@/lib/toast';
import { leaveChat } from '@/services/navigation';

// 安卓返回键：
// 1. 有弹窗 / 菜单打开 → 先关掉它
// 2. 页面自己注册的处理（比如聊天里的搜索面板）→ 先收起
// 3. 在聊天 / 群信息页 → 返回上一页
// 4. 在“好友 / 我的”标签 → 回到“聊天”标签
// 5. 在“聊天”标签（首页）→ 连按两次退出 App

type Handler = () => boolean;   // 返回 true 表示已处理
const handlers: Handler[] = [];

export function registerBackHandler(fn: Handler): () => void {
  handlers.push(fn);
  return () => {
    const i = handlers.indexOf(fn);
    if (i >= 0) handlers.splice(i, 1);
  };
}

let lastPress = 0;

export function installBackButton(): void {
  if (!Capacitor.isNativePlatform()) return;
  void App.addListener('backButton', async () => {
    for (const ctrl of [alertController, actionSheetController, modalController, popoverController]) {
      const top = await ctrl.getTop();
      if (top) {
        await top.dismiss();
        return;
      }
    }

    for (let i = handlers.length - 1; i >= 0; i--) {
      if (handlers[i]()) return;
    }

    const path = router.currentRoute.value.path;
    if (/^\/chat\/[^/]+$/.test(path)) {
      leaveChat();
    } else if (path.startsWith('/chat/')) {
      router.back();
    } else if (path === '/tabs/friends' || path === '/tabs/me') {
      void router.replace('/tabs/chats');
    } else {
      const now = Date.now();
      if (now - lastPress < 2000) {
        await App.exitApp();
      } else {
        lastPress = now;
        void showToast('再按一次返回键退出', 1800);
      }
    }
  });
}
