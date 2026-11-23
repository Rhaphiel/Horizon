<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <!-- Material 3 Navigation Bar：高 80、图标外有“胶囊指示器”，选中时变宽并填色 -->
      <ion-tab-bar slot="bottom" class="m3-nav">
        <ion-tab-button tab="chats" href="/tabs/chats">
          <span class="ind">
            <ion-icon class="off" :icon="chatbubblesOutline" />
            <ion-icon class="on" :icon="chatbubbles" />
            <span v-if="totalUnread > 0" class="dot">{{ totalUnread > 99 ? '99+' : totalUnread }}</span>
          </span>
          <ion-label>聊天</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="friends" href="/tabs/friends">
          <span class="ind">
            <ion-icon class="off" :icon="peopleOutline" />
            <ion-icon class="on" :icon="people" />
            <span v-if="friendState.incoming.length > 0" class="dot">{{ friendState.incoming.length }}</span>
          </span>
          <ion-label>好友</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="me" href="/tabs/me">
          <span class="ind">
            <ion-icon class="off" :icon="personCircleOutline" />
            <ion-icon class="on" :icon="personCircle" />
          </span>
          <ion-label>我的</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, IonLabel, IonIcon } from '@ionic/vue';
import { chatbubbles, chatbubblesOutline, people, peopleOutline, personCircle, personCircleOutline } from 'ionicons/icons';
import { totalUnread } from '@/stores/chats';
import { friendState } from '@/stores/friends';
</script>

<style scoped>
ion-tab-bar.m3-nav {
  --background: var(--md-surface-container);
  --border: 0;
  height: calc(80px + var(--ion-safe-area-bottom, 0px));
  padding-top: 12px;
  padding-bottom: var(--ion-safe-area-bottom, 0px);
  contain: none;
  border-top: 0;
  align-items: flex-start;
}
ion-tab-button {
  --color: var(--md-on-surface-variant);
  --color-selected: var(--md-on-surface);
  --ripple-color: transparent;
  --padding-top: 0;
  --padding-bottom: 0;
  max-width: none;
  gap: 4px;
  background: transparent;
}
ion-tab-button ion-label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  margin: 0;
}
.ind {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 32px;
  border-radius: 16px;
  background: transparent;
  transition: background-color 0.2s ease, width 0.2s ease;
}
ion-tab-button.tab-selected .ind {
  width: 64px;
  background: var(--md-secondary-container);
}
.ind ion-icon { font-size: 24px; }
.ind .on { display: none; color: var(--md-on-secondary-container); }
ion-tab-button.tab-selected .ind .on { display: block; }
ion-tab-button.tab-selected .ind .off { display: none; }
/* 小红点 / 数字角标 */
.dot {
  position: absolute;
  top: -2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--md-error);
  color: var(--md-on-error);
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  text-align: center;
  box-sizing: border-box;
}
</style>
