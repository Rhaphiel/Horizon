<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>我的</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list>
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
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonToggle, IonButton } from '@ionic/vue';
import { session } from '@/stores/session';
import { notifyOn, APP_VERSION } from '@/stores/settings';
import { setNotify } from '@/services/notify';
import { logout } from '@/services/lifecycle';
import { confirmDialog } from '@/lib/toast';

function onToggle(ev: CustomEvent): void {
  const on = !!(ev.detail as { checked?: boolean }).checked;
  if (on !== notifyOn.value) void setNotify(on);
}

async function onLogout(): Promise<void> {
  if (await confirmDialog('退出登录', '确定要退出登录吗？', '退出')) await logout();
}
</script>
