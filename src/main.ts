import { createApp } from 'vue';
import { IonicVue } from '@ionic/vue';
import App from './App.vue';
import router from './router';
import { initApp } from '@/services/lifecycle';

/* Ionic 基础样式 */
import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';
/* 深色模式：跟随系统 */
import '@ionic/vue/css/palettes/dark.system.css';

import './theme/variables.css';
import './theme/global.css';

const app = createApp(App).use(IonicVue, { mode: 'md' }).use(router);

// 先恢复登录状态再显示界面；最多等 4 秒，网络慢也不会一直白屏
const boot = Promise.race([initApp(), new Promise<void>(resolve => window.setTimeout(resolve, 4000))]);
void boot.finally(() => {
  void router.isReady().then(() => app.mount('#app'));
});
