<template>
  <div class="avatar" :style="style" aria-hidden="true">
    <img v-if="props.src" :src="props.src" alt="" />
    <span v-else>{{ letter }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// 有图片就显示图片，没有就用名字首字 + 由名字决定的颜色
const props = withDefaults(defineProps<{ name: string; size?: number; src?: string | null }>(), {
  size: 52,
  src: null,
});

const letter = computed(() => (Array.from(props.name.trim())[0] ?? '?').toUpperCase());
const hue = computed(() => {
  let h = 0;
  for (const ch of props.name) h = (h * 31 + ch.codePointAt(0)!) % 360;
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
  flex: none;
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
  display: block;
}
</style>
