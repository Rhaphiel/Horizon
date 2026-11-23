<template>
  <div class="avatar" :style="style" aria-hidden="true">{{ letter }}</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// 用名字的第一个字 + 由名字决定的颜色，生成圆形头像
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 52 });

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
}
</style>
