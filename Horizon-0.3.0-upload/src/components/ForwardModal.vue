<template>
  <ion-modal :is-open="open" class="m3-dialog tall" @didDismiss="emit('close')">
    <div class="wrap">
      <div class="head">转发到…</div>
      <div class="preview">{{ preview }}</div>
      <div class="list">
        <ion-list v-if="sortedChats.length">
          <ion-item v-for="c in sortedChats" :key="c.id" lines="none" class="row">
            <Avatar slot="start" :name="chatTitle(c)" :size="40" />
            <ion-checkbox :checked="picked.includes(c.id)" @ionChange="onCheck(c.id, $event)">{{ chatTitle(c) }}</ion-checkbox>
          </ion-item>
        </ion-list>
        <div v-else class="empty">还没有聊天可以转发。</div>
      </div>
      <div class="actions">
        <ion-button fill="clear" @click="emit('close')">取消</ion-button>
        <ion-button :disabled="!picked.length || busy" @click="emit('submit', [...picked])">
          转发{{ picked.length ? `（${picked.length}）` : '' }}
        </ion-button>
      </div>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonModal, IonButton, IonList, IonItem, IonCheckbox } from '@ionic/vue';
import Avatar from '@/components/Avatar.vue';
import { chatTitle, sortedChats } from '@/stores/chats';
import { oneLine } from '@/lib/format';

const props = defineProps<{ open: boolean; body: string; busy?: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'submit', ids: string[]): void }>();

const picked = ref<string[]>([]);
watch(
  () => props.open,
  v => {
    if (v) picked.value = [];
  },
);

const preview = computed(() => {
  const t = oneLine(props.body);
  return t.length > 60 ? t.slice(0, 60) + '…' : t;
});

function onCheck(id: string, ev: CustomEvent): void {
  const checked = !!(ev.detail as { checked?: boolean }).checked;
  if (checked && !picked.value.includes(id)) picked.value = [...picked.value, id];
  if (!checked) picked.value = picked.value.filter(x => x !== id);
}
</script>

<style scoped>
.wrap { display: flex; flex-direction: column; height: 72vh; padding: 20px 8px 8px; box-sizing: border-box; }
.head { font-size: 20px; font-weight: 500; padding: 0 12px; }
.preview {
  margin: 12px 12px 4px; padding: 10px 12px; border-radius: 14px;
  background: var(--md-surface-container-highest); color: var(--md-on-surface-variant);
  font-size: 14px; overflow-wrap: anywhere;
}
.list { flex: 1; overflow-y: auto; }
ion-list { background: transparent; }
.row { --background: transparent; --min-height: 56px; }
.row :deep(.avatar) { margin-right: 12px; }
.empty { padding: 24px 16px; color: var(--md-on-surface-variant); }
.actions { display: flex; justify-content: flex-end; gap: 4px; padding: 4px 8px; }
</style>
