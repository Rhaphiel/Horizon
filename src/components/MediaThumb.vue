<template>
  <button class="thumb" type="button" aria-label="查看图片" @click="emit('open')">
    <img v-if="url && !failed" :src="url" alt="" loading="lazy" @error="onBroken" />
    <span v-else class="ph">{{ failed ? '加载失败' : '' }}</span>
  </button>
</template>

<script setup lang="ts">import { ref, watch } from 'vue';
import { forgetMediaUrl, mediaUrl } from '@/services/mediaApi';
const props = defineProps<{
    path: string | null;
}>();
const emit = defineEmits<{
    open: [
    ];
}>();
const url = ref<string | null>(null);
const failed = ref(false);
watch(() => props.path, async (p) => {
    failed.value = false;
    url.value = null;
    const u = await mediaUrl(p);
    if (p !== props.path)
        return;
    url.value = u;
    failed.value = !u;
}, { immediate: true });
function onBroken(): void {
    if (props.path)
        forgetMediaUrl(props.path);
    failed.value = true;
}
</script>

<style scoped>
.thumb {
  position: relative; display: block; width: 100%; aspect-ratio: 1 / 1;
  padding: 0; border: 0; border-radius: 10px; overflow: hidden;
  background: var(--md-surface-container-highest);
}
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ph {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: var(--md-on-surface-variant);
}
</style>
