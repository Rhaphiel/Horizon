<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>我的</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="hero">
        <Avatar :name="session.username || '?'" :size="88" />
        <div class="hero-name">{{ session.username || '—' }}</div>
      </div>

      <ion-list>
        <ion-item button :detail="true" lines="none" @click="appearanceOpen = true">
          <ion-icon slot="start" :icon="colorPaletteOutline" />
          <ion-label>
            <h2>外观</h2>
            <p>深色 / 浅色、主题色、聊天背景</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-label>
            <p>用户名</p>
            <h2>{{ session.username || '—' }}</h2>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-label>
            <p>邮箱</p>
            <h2>{{ session.user?.email || '—' }}</h2>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-toggle :checked="notifyOn" @ionChange="onToggle">新消息通知</ion-toggle>
        </ion-item>
        <ion-item lines="none">
          <ion-label>
            <p>版本</p>
            <h2>v{{ APP_VERSION }}</h2>
          </ion-label>
        </ion-item>
      </ion-list>

      <div class="ion-padding">
        <ion-button expand="block" fill="outline" color="danger" @click="onLogout">退出登录</ion-button>
      </div>
      <AppearanceModal :open="appearanceOpen" @close="appearanceOpen = false" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonToggle, IonButton, IonIcon } from '@ionic/vue';
import { colorPaletteOutline } from 'ionicons/icons';
import Avatar from '@/components/Avatar.vue';
import AppearanceModal from '@/components/AppearanceModal.vue';
import { session } from '@/stores/session';
import { notifyOn, APP_VERSION } from '@/stores/settings';
import { setNotify } from '@/services/notify';
import { logout } from '@/services/lifecycle';
import { confirmDialog } from '@/lib/toast';

const appearanceOpen = ref(false);

function onToggle(ev: CustomEvent): void {
  const on = !!(ev.detail as { checked?: boolean }).checked;
  if (on !== notifyOn.value) void setNotify(on);
}

async function onLogout(): Promise<void> {
  if (await confirmDialog('退出登录', '确定要退出登录吗？', '退出')) await logout();
}
</script>

<style scoped>
.hero { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px 0 12px; }
.hero-name { font-size: 22px; font-weight: 500; }
ion-item ion-icon[slot='start'] { color: var(--md-primary); font-size: 24px; margin-inline-end: 16px; }
</style>
