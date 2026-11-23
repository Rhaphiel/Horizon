<template>
  <Teleport to="body">
    <div v-if="open" class="cropper-mask">
      <div class="cropper-bar">
        <button class="txt" type="button" @click="onCancel">取消</button>
        <span class="title">{{ title }}</span>
        <button class="done" type="button" :disabled="!ready" @click="onDone">完成</button>
      </div>

      <!-- 圆形裁剪区：拖动移动，双指/滚轮/滑杆缩放 -->
      <div
        ref="stageEl"
        class="stage"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @wheel.prevent="onWheel"
      >
        <img ref="imgEl" class="pic" :src="src" alt="" :style="picStyle" draggable="false" />
        <div class="ring" :style="ringStyle" />
        <div class="hint">拖动移动 · 双指或滚轮缩放</div>
      </div>

      <div class="zoom">
        <span>缩放</span>
        <input type="range" min="1" max="4" step="0.01" :value="zoom" @input="onSlider" />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

// 圆形头像裁剪：拖动 / 缩放 → 点“完成”输出 512×512 JPEG
const props = withDefaults(defineProps<{ open: boolean; src: string; title?: string }>(), {
  title: '移动和缩放',
});
const emit = defineEmits<{ cancel: []; done: [blob: Blob] }>();

const stageEl = ref<HTMLDivElement | null>(null);
const imgEl = ref<HTMLImageElement | null>(null);

const natW = ref(0);
const natH = ref(0);
const stage = ref(0);      // 裁剪区（正方形）边长
const zoom = ref(1);
const tx = ref(0);         // 图片相对中心的偏移
const ty = ref(0);
const ready = ref(false);

// 图片按“铺满裁剪区”为基准缩放
const baseScale = computed(() => (natW.value && natH.value ? stage.value / Math.max(natW.value, natH.value) : 1));
const dispW = computed(() => natW.value * baseScale.value * zoom.value);
const dispH = computed(() => natH.value * baseScale.value * zoom.value);

const picStyle = computed(() => ({
  width: dispW.value + 'px',
  height: dispH.value + 'px',
  left: `calc(50% - ${dispW.value / 2}px + ${tx.value}px)`,
  top: `calc(50% - ${dispH.value / 2}px + ${ty.value}px)`,
}));

const ringStyle = computed(() => ({
  width: stage.value + 'px',
  height: stage.value + 'px',
}));

function measure(): void {
  const el = stageEl.value;
  if (!el) return;
  const s = Math.min(el.clientWidth, el.clientHeight) * 0.92;
  stage.value = Math.max(160, s);
  clampOffsets();
}

function clampOffsets(): void {
  const maxX = Math.max(0, (dispW.value - stage.value) / 2);
  const maxY = Math.max(0, (dispH.value - stage.value) / 2);
  tx.value = Math.min(maxX, Math.max(-maxX, tx.value));
  ty.value = Math.min(maxY, Math.max(-maxY, ty.value));
}

function loadImage(): void {
  ready.value = false;
  const img = new Image();
  img.onload = () => {
    natW.value = img.naturalWidth;
    natH.value = img.naturalHeight;
    zoom.value = 1;
    tx.value = 0;
    ty.value = 0;
    void nextTick(() => {
      measure();
      ready.value = true;
    });
  };
  img.onerror = () => { ready.value = false; };
  img.src = props.src;
}

watch(() => [props.open, props.src], ([open]) => {
  if (open) {
    void nextTick(() => { measure(); loadImage(); });
  }
}, { immediate: true });

// ----- 拖动 -----
const pointers = new Map<number, { x: number; y: number }>();
let dragStart: { x: number; y: number; tx: number; ty: number } | null = null;
let pinchStart: { dist: number; zoom: number } | null = null;

function onDown(e: PointerEvent): void {
  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    dragStart = { x: e.clientX, y: e.clientY, tx: tx.value, ty: ty.value };
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: zoom.value };
    dragStart = null;
  }
}

function onMove(e: PointerEvent): void {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2 && pinchStart) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    zoom.value = Math.min(4, Math.max(1, pinchStart.zoom * (dist / pinchStart.dist)));
    clampOffsets();
    return;
  }
  if (dragStart) {
    tx.value = dragStart.tx + (e.clientX - dragStart.x);
    ty.value = dragStart.ty + (e.clientY - dragStart.y);
    clampOffsets();
  }
}

function onUp(e: PointerEvent): void {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = null;
  if (pointers.size === 0) dragStart = null;
}

function onWheel(e: WheelEvent): void {
  zoom.value = Math.min(4, Math.max(1, zoom.value * (e.deltaY > 0 ? 0.94 : 1.06)));
  clampOffsets();
}

function onSlider(e: Event): void {
  zoom.value = Number((e.target as HTMLInputElement).value);
  clampOffsets();
}

// ----- 输出 -----
function onCancel(): void {
  emit('cancel');
}

function onDone(): void {
  const img = imgEl.value;
  if (!img || !ready.value || stage.value <= 0) return;
  const OUT = 512;
  const k = OUT / stage.value;
  const canvas = document.createElement('canvas');
  canvas.width = OUT;
  canvas.height = OUT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, OUT, OUT);

  ctx.save();
  ctx.beginPath();
  ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  // 图片左上角相对裁剪区左上角的坐标（再乘 k 放到 512 画布上）
  const dx = (stage.value / 2 - dispW.value / 2 + tx.value) * k;
  const dy = (stage.value / 2 - dispH.value / 2 + ty.value) * k;
  ctx.drawImage(img, dx, dy, dispW.value * k, dispH.value * k);
  ctx.restore();

  canvas.toBlob(blob => { if (blob) emit('done', blob); }, 'image/jpeg', 0.9);
}
</script>

<style scoped>
.cropper-mask {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #000;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
}
.cropper-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  padding-top: calc(12px + env(safe-area-inset-top));
  color: #fff;
}
.cropper-bar .title { font-size: 16px; }
.cropper-bar .txt { background: none; border: 0; color: #bbb; font-size: 15px; padding: 6px; }
.cropper-bar .done {
  background: var(--md-primary, #4f9dff);
  color: #fff;
  border: 0;
  border-radius: 18px;
  padding: 7px 18px;
  font-size: 15px;
}
.cropper-bar .done:disabled { opacity: 0.5; }

.stage {
  position: relative;
  flex: 1;
  overflow: hidden;
  touch-action: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* Ionic / normalize 的全局 img{max-width:100%} 会把放大后的图横向压回来，
   这里显式解除，否则放大就等于“压扁” */
.pic {
  position: absolute;
  max-width: none;
  max-height: none;
  width: auto;
  height: auto;
  user-select: none;
  -webkit-user-drag: none;
}
.ring {
  position: absolute;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.62);
  pointer-events: none;
}
.hint {
  position: absolute;
  bottom: 8px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  pointer-events: none;
}
.zoom {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px 20px;
  color: #ccc;
  font-size: 12px;
}
.zoom input { flex: 1; }
</style>
