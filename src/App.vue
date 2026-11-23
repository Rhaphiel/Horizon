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

    <!-- 有新版本时弹一次 -->
    <UpdateModal :open="!!updateInfo" :info="updateInfo" @close="closeUpdate" />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { banners, dismissBanner, openBanner } from '@/services/notify';
import UpdateModal from '@/components/UpdateModal.vue';
import { checkUpdate } from '@/services/updates';
import type { ReleaseInfo } from '@/services/updates';
import { session } from '@/stores/session';

const updateInfo = ref<ReleaseInfo | null>(null);

function closeUpdate(): void {
  updateInfo.value = null;
}

async function run(): Promise<void> {
  updateInfo.value = await checkUpdate();
}

onMounted(() => {
  if (session.user) void run();
});

// 登录之后再查一次（首次打开是登录页）
watch(
  () => session.user?.id,
  id => {
    if (id) void run();
  },
);
</script>
