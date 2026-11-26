<template>
  <div class="mb">
    
    <template v-if="!gone && kind === 'image'">
      <button v-if="failed" class="ph retry" type="button" @click="load">加载失败，点此重试</button>
      <div v-else-if="!url" class="ph">加载中…</div>
      <div v-else class="pic-wrap">
        <img :src="url" class="pic" alt="图片" @click="emit('open')" @error="onBroken" />
        <span class="exp-badge" :title="'媒体将在 24 小时后自动销毁'">24h</span>
      </div>
    </template>

    
    <template v-else-if="!gone">
      <button class="audio" type="button" :disabled="!url && !failed" @click="failed ? load() : toggle()">
        <ion-icon :icon="playing ? pause : play" class="ico" />
        <span class="dur">{{ label }}</span>
        <span v-if="failed" class="muted">加载失败，点此重试</span>
        <span v-else-if="!url" class="muted">加载中…</span>
      </button>
      <audio ref="audioEl" :src="url || undefined" @ended="playing = false" @pause="playing = false" @error="onBroken" />
    </template>

    
    <div v-if="gone" class="expired">该内容已过期，系统已自动销毁</div>
  </div>
</template>

<script setup lang="ts">import { computed, onMounted, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { pause, play } from 'ionicons/icons';
import { forgetMediaUrl, mediaUrl } from '@/services/mediaApi';
const props = defineProps<{
    kind: 'image' | 'audio';
    path?: string | null;
    duration?: number | null;
    expired?: boolean;
    expiresAt?: string | null;
}>();
const emit = defineEmits<{
    open: [
    ];
}>();
const gone = computed(() => props.expired === true || (!!props.expiresAt && Date.parse(props.expiresAt) <= Date.now()));
const url = ref<string | null>(null);
const failed = ref(false);
const playing = ref(false);
const audioEl = ref<HTMLAudioElement | null>(null);
const label = computed(() => {
    const d = props.duration ?? 0;
    if (!d)
        return '语音';
    return `${Math.floor(d / 60) ? `${Math.floor(d / 60)}′` : ''}${d % 60}″`;
});
async function load(): Promise<void> {
    failed.value = false;
    url.value = null;
    if (gone.value || !props.path)
        return;
    url.value = await mediaUrl(props.path);
    failed.value = !url.value;
}
function onBroken(): void {
    if (!url.value)
        return;
    if (props.path)
        forgetMediaUrl(props.path);
    url.value = null;
    failed.value = true;
}
onMounted(() => { void load(); });
watch(() => props.path, () => { void load(); });
function toggle(): void {
    const el = audioEl.value;
    if (!el)
        return;
    if (playing.value) {
        el.pause();
        playing.value = false;
    }
    else {
        void el.play().then(() => { playing.value = true; }).catch(() => { playing.value = false; });
    }
}
</script>

<style scoped>
.mb { display: flex; flex-direction: column; gap: 6px; }
.pic-wrap { position: relative; display: inline-flex; }
.exp-badge {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 10px;
  line-height: 1.6;
  color: rgba(255, 255, 255, .94);
  background: rgba(0, 0, 0, .38);
  backdrop-filter: blur(4px);
  pointer-events: none;
}
.pic {
  max-width: 220px;
  max-height: 260px;
  border-radius: 14px;
  object-fit: cover;
  background: rgba(0, 0, 0, 0.08);
}
.ph.retry { border: 0; cursor: pointer; font: inherit; font-size: 12px; }
.ph { width: 160px; height: 110px; border-radius: 14px; background: rgba(127,127,127,.18); display: grid; place-items: center; font-size: 12px; color: var(--md-on-surface-variant); }
.audio {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
  padding: 8px 12px;
  border: 0;
  border-radius: 14px;
  background: rgba(127, 127, 127, 0.16);
  color: var(--md-on-surface);
  font-size: 14px;
}
.audio .ico { font-size: 18px; }
.audio .muted { font-size: 12px; opacity: .7; }
.expired { font-size: 11.5px; color: var(--md-on-surface-variant); opacity: .85; }
</style>
