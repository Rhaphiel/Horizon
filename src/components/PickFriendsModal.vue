<template>
  <ion-modal :is-open="open" @didDismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">取消</ion-button>
        </ion-buttons>
        <ion-title>{{ title }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :disabled="!canSubmit || busy" @click="submit">{{ confirmText }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-input
        v-if="askName"
        v-model="name"
        label="群名称"
        label-placement="stacked"
        placeholder="1–30 个字"
        :maxlength="30"        class="ion-padding-horizontal"
      />
      <div class="section-title">选择好友</div>
      <ion-list v-if="friends.length">
        <ion-item v-for="f in friends" :key="f.id">
          <ion-checkbox :checked="picked.includes(f.id)" @ionChange="onCheck(f.id, $event)">{{ f.name }}</ion-checkbox>
        </ion-item>
      </ion-list>
      <div v-else class="empty-tip">{{ emptyText || '没有可选的好友' }}</div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">import { computed, ref, watch } from 'vue';
import { IonModal, IonHeader, IonToolbar, IonButtons, IonButton, IonTitle, IonContent, IonInput, IonList, IonItem, IonCheckbox } from '@ionic/vue';
const props = defineProps<{
    open: boolean;
    title: string;
    confirmText: string;
    friends: {
        id: string;
        name: string;
    }[];
    askName?: boolean;
    busy?: boolean;
    emptyText?: string;
}>();
const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'submit', payload: {
        ids: string[];
        name: string;
    }): void;
}>();
const picked = ref<string[]>([]);
const name = ref('');
watch(() => props.open, v => {
    if (v) {
        picked.value = [];
        name.value = '';
    }
});
const canSubmit = computed(() => picked.value.length > 0 && (!props.askName || name.value.trim().length > 0));
function onCheck(id: string, ev: CustomEvent): void {
    const checked = !!(ev.detail as {
        checked?: boolean;
    }).checked;
    if (checked && !picked.value.includes(id))
        picked.value = [...picked.value, id];
    if (!checked)
        picked.value = picked.value.filter(x => x !== id);
}
function submit(): void {
    emit('submit', { ids: [...picked.value], name: name.value.trim() });
}
</script>
