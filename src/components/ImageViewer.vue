<template>
  <Teleport to="body">
    <div v-if="open && list.length" class="lv" @click.self="emit('close')">
      <div class="top">
        <button class="x" type="button" aria-label="关闭" @click="emit('close')">✕</button>
        <span class="idx">{{ index + 1 }} / {{ list.length }}</span>
      </div>

      <div class="stage" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @click.self="emit('close')">
        <div v-if="!url" class="loading">加载中…</div>
        <img v-else :src="url" class="big" alt="图片" :style="style" draggable="false" @click.stop @dblclick="zoom = zoom > 1 ? 1 : 2" />
      </div>

      <button v-if="index > 0" class="nav prev" type="button" aria-label="上一张" @click.stop="go(-1)">‹</button>
      <button v-if="index < list.length - 1" class="nav next" type="button" aria-label="下一张" @click.stop="go(1)">›</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { mediaUrl } from '@/services/mediaApi';

const props = defineProps<{
  open: boolean;
  paths: string[];
  index: number;
}>();
const emit = defineEmits<{ close: []; change: [index: number] }>();

const url = ref<string | null>(null);
const zoom = ref(1);
const dragX = ref(0);

const list = computed(() => props.paths.filter(Boolean));
const style = computed(() => ({
  transform: `translateX(${dragX.value}px) scale(${zoom.value})`,
  transition: dragX.value === 0 ? 'transform .18s ease-out' : 'none',
}));

async function load(): Promise<void> {
  url.value = null;
  zoom.value = 1;
  dragX.value = 0;
  const p = list.value[props.index];
  if (!p) return;
  url.value = await mediaUrl(p);
}

watch(() => [props.open, props.index, props.paths.length], () => {
  if (props.open) void load();
}, { immediate: true });

function go(delta: number): void {
  const next = props.index + delta;
  if (next < 0 || next >= list.value.length) return;
  emit('change', next);
}

// 左右滑动切换（超过 60px 算一次）
let startX = 0;
let tracking = false;
let fromEdge = false;
function down(e: PointerEvent): void {
  if (zoom.value > 1) return;
  tracking = true;
  startX = e.clientX;
  fromEdge = e.clientX < 32;   // 从左边缘开始滑 = 关闭
}
function move(e: PointerEvent): void {
  if (!tracking) return;
  dragX.value = e.clientX - startX;
}
function up(): void {
  if (!tracking) return;
  tracking = false;
  const dx = dragX.value;
  dragX.value = 0;
  if (fromEdge && dx > 60) { emit('close'); return; }   // 边缘右滑：关闭查看器
  if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
}

function onKey(e: KeyboardEvent): void {
  if (!props.open) return;
  if (e.key === 'Escape') emit('close');
  if (e.key === 'ArrowLeft') go(-1);
  if (e.key === 'ArrowRight') go(1);
}
window.addEventListener('keydown', onKey);
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
.lv {
  position: fixed;
  inset: 0;
  z-index: 99990;
  background: rgba(0, 0, 0, 0.94);
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
}
.top {
  position: absolute;
  top: calc(10px + var(--ion-safe-area-top, 0px));
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  z-index: 2;
}
.x {
  width: 40px; height: 40px; border: 0; border-radius: 50%;
  background: rgba(255,255,255,.14); color: #fff; font-size: 18px;
}
.idx { color: #fff; font-size: 14px; opacity: .85; }
.stage { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.big { max-width: 100%; max-height: 88%; object-fit: contain; border-radius: 8px; will-change: transform; }
.loading { color: #fff; font-size: 14px; opacity: .8; }
.nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px; height: 44px;
  border: 0; border-radius: 50%;
  background: rgba(255,255,255,.14);
  color: #fff; font-size: 26px; line-height: 1;
}
.nav.prev { left: 10px; }
.nav.next { right: 10px; }
</style>
