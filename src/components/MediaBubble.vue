<template>
  <div class="mb">
    <!-- 图片 -->
    <template v-if="kind === 'image'">
      <div v-if="!url" class="ph">加载中…</div>
      <img v-else :src="url" class="pic" alt="图片" @click="emit('open')" />
    </template>

    <!-- 语音 -->
    <template v-else>
      <button class="audio" type="button" :disabled="!url" @click="toggle">
        <ion-icon :icon="playing ? pause : play" class="ico" />
        <span class="dur">{{ label }}</span>
        <span v-if="!url" class="muted">加载中…</span>
      </button>
      <audio ref="audioEl" :src="url || undefined" @ended="playing = false" @pause="playing = false" />
    </template>

    <!-- 已过期（阶段二会用到） -->
    <div v-if="expired" class="expired">该内容已过期，系统已自动销毁</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { pause, play } from 'ionicons/icons';
import { mediaUrl } from '@/services/mediaApi';

const props = defineProps<{
  kind: 'image' | 'audio';
  path?: string | null;
  duration?: number | null;
  expired?: boolean;
  expiresAt?: string | null;
}>();
const emit = defineEmits<{ open: [] }>();

const gone = computed(() => props.expired === true || (!!props.expiresAt && Date.parse(props.expiresAt) <= Date.now()));
const url = ref<string | null>(null);
const playing = ref(false);
const audioEl = ref<HTMLAudioElement | null>(null);

const label = computed(() => {
  const d = props.duration ?? 0;
  if (!d) return '语音';
  return `${Math.floor(d / 60) ? `${Math.floor(d / 60)}′` : ''}${d % 60}″`;
});

async function load(): Promise<void> {
  if (gone.value) return;
  url.value = await mediaUrl(props.path);
}

onMounted(() => { void load(); });
watch(() => props.path, () => { void load(); });

function toggle(): void {
  const el = audioEl.value;
  if (!el) return;
  if (playing.value) {
    el.pause();
    playing.value = false;
  } else {
    void el.play().then(() => { playing.value = true; }).catch(() => { playing.value = false; });
  }
}

</script>

<style scoped>
.mb { display: flex; flex-direction: column; gap: 6px; }
.pic {
  max-width: 220px;
  max-height: 260px;
  border-radius: 14px;
  object-fit: cover;
  background: rgba(0, 0, 0, 0.08);
}
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
.expired { font-size: 12px; color: var(--md-on-surface-variant); }
</style>
