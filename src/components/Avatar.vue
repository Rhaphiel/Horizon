<template>
  <div class="avatar" :style="style" aria-hidden="true">
    <img v-if="props.src && !broken" :src="props.src" alt="" @error="broken = true" />
    <span v-else>{{ letter }}</span>
  </div>
</template>

<script setup lang="ts">import { computed, ref, watch } from 'vue';
const props = withDefaults(defineProps<{
    name: string;
    size?: number;
    src?: string | null;
}>(), {
    size: 52,
    src: null,
});
const broken = ref(false);
watch(() => props.src, () => {
    broken.value = false;
});
const letter = computed(() => (Array.from(props.name.trim())[0] ?? '?').toUpperCase());
const hue = computed(() => {
    let h = 0;
    for (const ch of props.name)
        h = (h * 31 + ch.codePointAt(0)!) % 360;
    return h;
});
const style = computed(() => ({
    width: props.size + 'px',
    height: props.size + 'px',
    fontSize: Math.round(props.size * 0.42) + 'px',
    background: `hsl(${hue.value} 48% 36%)`,
}));
</script>

<style scoped>
.avatar {
  flex: 0 0 auto;
  aspect-ratio: 1 / 1;
  min-width: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 500;
  user-select: none;
  overflow: hidden;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}
</style>
