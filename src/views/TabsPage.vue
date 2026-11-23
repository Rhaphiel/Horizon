<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="chats" href="/tabs/chats">
          <ion-label>聊天</ion-label>
          <ion-badge v-if="totalUnread > 0">{{ totalUnread > 99 ? '99+' : totalUnread }}</ion-badge>
        </ion-tab-button>
        <ion-tab-button tab="friends" href="/tabs/friends">
          <ion-label>好友</ion-label>
          <ion-badge v-if="friendState.incoming.length > 0">{{ friendState.incoming.length }}</ion-badge>
        </ion-tab-button>
        <ion-tab-button tab="me" href="/tabs/me">
          <ion-label>我的</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, IonLabel, IonBadge } from '@ionic/vue';
import { totalUnread } from '@/stores/chats';
import { friendState } from '@/stores/friends';
</script>
