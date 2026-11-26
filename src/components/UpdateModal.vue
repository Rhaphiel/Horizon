<template>
  <Teleport to="body">
    <div v-if="open && info" class="upd-mask">
      <div class="upd-card">
        <div class="upd-head">
          <span class="ico">!</span>
          <h2>发现新版本</h2>
        </div>

        <p class="ver">发现新版本：v{{ info.version }}</p>
        <p class="ver sub">下载：GitHub Releases · {{ info.page.replace('https://github.com/', '') }}</p>

        <div class="body">
          <template v-if="info.body">
            <p v-for="(line, i) in lines" :key="i">{{ line }}</p>
          </template>
          <p v-else class="muted">这次更新没有写说明，可以直接去下载。</p>
        </div>

        <div class="btns">
          <button type="button" class="later" @click="emit('close')">稍后提醒</button>
          <button type="button" class="go" @click="go">前往更新</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">import { computed } from 'vue';
import type { ReleaseInfo } from '@/services/updates';
import { openRelease } from '@/services/updates';
import { useBackToClose } from '@/services/backButton';
const props = defineProps<{
    open: boolean;
    info: ReleaseInfo | null;
}>();
const emit = defineEmits<{
    close: [
    ];
}>();
useBackToClose(() => props.open && !!props.info, () => emit('close'));
const lines = computed(() => (props.info?.body || '')
    .split('\n')
    .map(l => l.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim())
    .filter(l => l.length > 0));
function go(): void {
    if (props.info?.url)
        openRelease(props.info.url);
    emit('close');
}
</script>

<style scoped>
.upd-mask {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
}
.upd-card {
  width: 100%;
  max-width: 420px;
  border-radius: 26px;
  padding: 22px 22px 16px;
  background: var(--md-surface-container, #2a2a2e);
  color: var(--md-on-surface, #eee);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
}
.upd-head { display: flex; align-items: center; gap: 10px; }
.upd-head .ico {
  width: 34px; height: 34px; border-radius: 50%;
  display: grid; place-items: center;
  background: rgba(167, 139, 250, 0.2);
  color: #c4b5fd; font-weight: 700;
}
.upd-head h2 { margin: 0; font-size: 22px; font-weight: 600; }
.ver { margin: 14px 0 12px; font-size: 15px; color: var(--md-on-surface-variant, #bbb); }
.ver.sub { margin: 0 0 12px; font-size: 12px; opacity: .75; word-break: break-all; }
.body {
  max-height: 42vh;
  overflow: auto;
  font-size: 13px;
  line-height: 1.65;
  color: var(--md-on-surface, #ddd);
  padding-right: 4px;
}
.body p { margin: 0 0 6px; }
.muted { color: var(--md-on-surface-variant, #999); }
.btns { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.btns button {
  border: 0; border-radius: 999px; padding: 11px 22px;
  font-size: 14px; font-weight: 500;
}
.later { background: transparent; color: var(--md-on-surface-variant, #aaa); }
.go { background: #c4b5fd; color: #221b33; }
</style>
