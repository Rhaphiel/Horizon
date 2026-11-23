<template>
  <ion-app>
    <ion-router-outlet />

    <!-- 应用内消息弹窗 -->
    <div class="notifyWrap">
      <div v-for="b in banners" :key="b.key" class="notify" @click="openBanner(b)">
        <div class="n-body">
          <div class="n-title">{{ b.title }}</div>
          <div class="n-text">{{ b.text }}</div>
        </div>
        <button class="n-x" type="button" @click.stop="dismissBanner(b.key)">×</button>
      </div>
    </div>
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { banners, dismissBanner, openBanner } from '@/services/notify';
</script>
