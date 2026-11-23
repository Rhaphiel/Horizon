<template>
  <ion-modal :is-open="open" class="m3-dialog" @didDismiss="emit('close')">
    <div class="box">
      <div class="head">选择文本</div>
      <div ref="box" class="sel">{{ text }}</div>
      <div class="hint">长按文字并拖动两端的圆点，可选中一部分；不选则复制全部。</div>
      <div class="actions">
        <ion-button fill="clear" @click="selectAll">全选</ion-button>
        <ion-button fill="clear" @click="copy">复制</ion-button>
        <ion-button fill="clear" @click="emit('close')">关闭</ion-button>
      </div>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonModal, IonButton } from '@ionic/vue';
import { copyText } from '@/lib/clipboard';
import { showToast } from '@/lib/toast';

defineProps<{ open: boolean; text: string }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const box = ref<HTMLElement | null>(null);

function selectAll(): void {
  const el = box.value;
  const sel = window.getSelection();
  if (!el || !sel) return;
  const r = document.createRange();
  r.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(r);
}

// 有选中内容就复制选中的，没有就复制全部
async function copy(): Promise<void> {
  const el = box.value;
  const sel = window.getSelection();
  let chosen = '';
  if (el && sel && sel.rangeCount && el.contains(sel.anchorNode) && el.contains(sel.focusNode)) chosen = sel.toString();
  const all = !chosen;
  const ok = await copyText(all ? (el?.textContent ?? '') : chosen);
  void showToast(ok ? (all ? '已复制全部内容' : '已复制所选内容') : '复制失败');
  if (ok) emit('close');
}
</script>

<style scoped>
.box { padding: 20px 20px 8px; display: flex; flex-direction: column; gap: 12px; max-height: 78vh; }
.head { font-size: 20px; font-weight: 500; }
.sel {
  overflow-y: auto;
  max-height: 44vh;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--md-surface-container-highest);
  color: var(--md-on-surface);
  font-size: 16px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
/* Ionic 在手机上默认禁止选中文字，这里单独放开 */
.sel, .sel * { user-select: text !important; -webkit-user-select: text !important; }
.hint { font-size: 12px; color: var(--md-on-surface-variant); }
.actions { display: flex; justify-content: flex-end; gap: 4px; }
</style>
