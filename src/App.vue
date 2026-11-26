<template>
  <ion-app>
    <ion-router-outlet />

    
    <div class="notifyWrap">
      <div v-for="b in banners" :key="b.key" class="notify" @click="openBanner(b)">
        <div class="n-body">
          <div class="n-title">{{ b.title }}</div>
          <div class="n-text">{{ b.text }}</div>
        </div>
        <button class="n-x" type="button" @click.stop="dismissBanner(b.key)">×</button>
      </div>
    </div>

    
    <UpdateModal :open="!!updateInfo" :info="updateInfo" @close="closeUpdate" />

    
    <HandleModal :open="needHandle" @done="onHandleDone" />
  </ion-app>
</template>

<script setup lang="ts">import { onMounted, ref, watch } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { banners, dismissBanner, openBanner } from '@/services/notify';
import UpdateModal from '@/components/UpdateModal.vue';
import HandleModal from '@/components/HandleModal.vue';
import { checkUpdate } from '@/services/updates';
import type { ReleaseInfo } from '@/services/updates';
import { session } from '@/stores/session';
import { db } from '@/lib/supabase';
const updateInfo = ref<ReleaseInfo | null>(null);
const needHandle = ref(false);
const handledFor = ref<string | null>(null);
function closeUpdate(): void {
    updateInfo.value = null;
}
async function run(): Promise<void> {
    if (localStorage.getItem('hz:update-push') === '0')
        return;
    updateInfo.value = await checkUpdate();
}
async function checkHandle(): Promise<void> {
    const uid = session.user?.id;
    if (!uid || handledFor.value === uid)
        return;
    const { data, error } = await db.from('profiles').select('handle').eq('id', uid).maybeSingle();
    if (error || !data)
        return;
    if (!data.handle) {
        handledFor.value = uid;
        needHandle.value = true;
    }
}
function onHandleDone(): void {
    needHandle.value = false;
}
onMounted(() => {
    if (session.user) {
        void run();
        void checkHandle();
    }
});
watch(() => session.user?.id, id => {
    if (id) {
        void run();
        void checkHandle();
    }
    else {
        needHandle.value = false;
        handledFor.value = null;
    }
});
</script>
