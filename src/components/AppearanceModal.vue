<template>
  <ion-modal :is-open="open" @didDismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button class="icon-btn" aria-label="关闭" @click="emit('close')"><ion-icon slot="icon-only" :icon="closeOutline" /></ion-button>
        </ion-buttons>
        <ion-title>外观</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="onReset">恢复默认</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      
      <div class="preview" :style="bubbleVars">
        <div class="pv-bg" :style="{ background: chatBackground }">
          <div class="pill">今天</div>
          <div class="b in">你好！这是对方的消息。</div>
          <div class="b out">这是我发的消息，颜色会随背景自动调整。</div>
        </div>
      </div>

      <div class="section-title">称号与显示</div>
      <div class="titles">
        <label class="tit" :class="{ off: !myTitles.length }">
          <input
            type="radio"
            name="shownTitle"
            :disabled="!myTitles.length"
            :checked="!shownTitleId"
            @change="pickTitle(null)"
          />
          <span>不显示称号</span>
        </label>
        <label v-for="t in myTitles" :key="t.id" class="tit">
          <input
            type="radio"
            name="shownTitle"
            :checked="shownTitleId === t.id"
            @change="pickTitle(t.id)"
          />
          <span class="chip" :style="titleStyle(t)">{{ t.text }}</span>
        </label>
        <p v-if="!myTitles.length" class="tit-empty">还没有被授予称号（由管理员发放）</p>
      </div>

      <div class="section-title">深色 / 浅色</div>
      <ion-segment :value="appearance.mode" @ionChange="onMode">
        <ion-segment-button value="system"><ion-label>跟随系统</ion-label></ion-segment-button>
        <ion-segment-button value="light"><ion-label>浅色</ion-label></ion-segment-button>
        <ion-segment-button value="dark"><ion-label>深色</ion-label></ion-segment-button>
      </ion-segment>

      <div class="section-title">主题色</div>
      <div class="swatches">
        <button v-for="c in SEED_PRESETS" :key="c" type="button" :class="['sw', { on: same(appearance.seed, c) }]" :style="{ background: c }" :aria-label="c" @click="appearance.seed = c" />
        <label class="sw custom" :class="{ on: !SEED_PRESETS.some(c => same(appearance.seed, c)) }" :style="{ background: appearance.seed }">
          <ion-icon :icon="colorPaletteOutline" />
          <input type="color" :value="appearance.seed" @input="appearance.seed = ($event.target as HTMLInputElement).value" />
        </label>
      </div>

      <button type="button" class="more-toggle" @click="advancedOpen = !advancedOpen">
        <span>{{ advancedOpen ? '收起更多外观设置' : '更多外观设置' }}</span>
        <span class="chev">{{ advancedOpen ? '⌃' : '⌄' }}</span>
      </button>

      <template v-if="advancedOpen">
      <div class="section-title">聊天背景</div>
      <ion-segment :value="appearance.bgKind" @ionChange="onKind">
        <ion-segment-button value="none"><ion-label>默认</ion-label></ion-segment-button>
        <ion-segment-button value="color"><ion-label>纯色</ion-label></ion-segment-button>
        <ion-segment-button value="image"><ion-label>图片</ion-label></ion-segment-button>
      </ion-segment>

      <div v-if="appearance.bgKind === 'color'" class="swatches pad">
        <button v-for="c in BG_COLOR_PRESETS" :key="c" type="button" :class="['sw', { on: same(appearance.bgColor, c) }]" :style="{ background: c }" :aria-label="c" @click="appearance.bgColor = c" />
        <label class="sw custom" :class="{ on: !BG_COLOR_PRESETS.some(c => same(appearance.bgColor, c)) }" :style="{ background: appearance.bgColor }">
          <ion-icon :icon="colorPaletteOutline" />
          <input type="color" :value="appearance.bgColor" @input="appearance.bgColor = ($event.target as HTMLInputElement).value" />
        </label>
      </div>

      <div v-if="appearance.bgKind === 'image'" class="pad row">
        <ion-button class="tonal" @click="fileInput?.click()"><ion-icon slot="start" :icon="imageOutline" />{{ appearance.image ? '更换图片' : '选择图片' }}</ion-button>
        <ion-button v-if="appearance.image" fill="outline" @click="removeChatImage">移除</ion-button>
        <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
      </div>

      <template v-if="appearance.bgKind !== 'none'">
        <div class="section-title">背景透明度　{{ appearance.bgOpacity }}%</div>
        <ion-range :min="0" :max="100" :step="1" :value="appearance.bgOpacity" aria-label="背景透明度" @ionInput="onOpacity" />
      </template>
      </template>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">import { onMounted, ref } from 'vue';
import { IonModal, IonHeader, IonToolbar, IonButtons, IonButton, IonTitle, IonContent, IonSegment, IonSegmentButton, IonLabel, IonRange, IonIcon } from '@ionic/vue';
import { closeOutline, colorPaletteOutline, imageOutline } from 'ionicons/icons';
import { appearance, bubbleVars, chatBackground, BG_COLOR_PRESETS, SEED_PRESETS, removeChatImage, resetAppearance, setChatImage } from '@/theme/appearance';
import type { BgKind, ThemeMode } from '@/theme/appearance';
import { showToast } from '@/lib/toast';
import { db } from '@/lib/supabase';
import { session } from '@/stores/session';
import { loadMyTitles, reloadTitle, titleStyle } from '@/stores/titles';
import type { OwnedTitle } from '@/stores/titles';
defineProps<{
    open: boolean;
}>();
const emit = defineEmits<{
    (e: 'close'): void;
}>();
const advancedOpen = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const myTitles = ref<OwnedTitle[]>([]);
const shownTitleId = ref<string | null>(null);
async function loadTitles(): Promise<void> {
    const uid = session.user?.id;
    if (!uid)
        return;
    myTitles.value = await loadMyTitles(uid);
    const { data } = await db.from('profiles').select('shown_title').eq('id', uid).maybeSingle();
    shownTitleId.value = (data?.shown_title as string | null) ?? null;
}
async function pickTitle(id: string | null): Promise<void> {
    const uid = session.user?.id;
    if (!uid)
        return;
    const prev = shownTitleId.value;
    shownTitleId.value = id;
    const { error } = await db.from('profiles').update({ shown_title: id }).eq('id', uid);
    if (error) {
        shownTitleId.value = prev;
        void showToast('保存失败：' + error.message);
        return;
    }
    void reloadTitle(uid);
    void showToast(id ? '已更新显示的称号' : '已隐藏称号');
}
onMounted(() => { void loadTitles(); });
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
function onMode(ev: CustomEvent): void {
    const v = (ev.detail as {
        value?: ThemeMode;
    }).value;
    if (v)
        appearance.mode = v;
}
function onKind(ev: CustomEvent): void {
    const v = (ev.detail as {
        value?: BgKind;
    }).value;
    if (!v)
        return;
    appearance.bgKind = v;
    if (v === 'image' && !appearance.image)
        fileInput.value?.click();
}
function onOpacity(ev: CustomEvent): void {
    appearance.bgOpacity = Number((ev.detail as {
        value?: number;
    }).value ?? 100);
}
async function onFile(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f)
        return;
    const err = await setChatImage(f);
    if (err)
        void showToast(err, 3000);
}
function onReset(): void {
    resetAppearance();
    void showToast('已恢复默认外观');
}
</script>

<style scoped>
.preview { border-radius: 20px; overflow: hidden; margin-bottom: 8px; border: 1px solid var(--md-outline-variant); }
.pv-bg { padding: 14px; display: flex; flex-direction: column; gap: 8px; min-height: 150px; }
.pill { align-self: center; padding: 2px 12px; border-radius: 12px; font-size: 11px; background: var(--pill-bg); color: var(--pill-fg); }
.b { max-width: 80%; padding: 8px 12px; border-radius: 16px; font-size: 14px; box-shadow: 0 0 0 1px var(--bubble-edge), 0 1px 2px rgba(0, 0, 0, 0.18); }
.b.in { align-self: flex-start; background: var(--in-bg); color: var(--in-fg); border-bottom-left-radius: 4px; }
.b.out { align-self: flex-end; background: var(--out-bg); color: var(--out-fg); border-bottom-right-radius: 4px; }
.section-title { padding: 18px 4px 8px; }
.swatches { display: flex; flex-wrap: wrap; gap: 10px; }
.swatches.pad, .pad { margin-top: 12px; }
.row { display: flex; gap: 8px; }
.sw {
  position: relative; width: 44px; height: 44px; border-radius: 14px; border: 0; padding: 0;
  box-shadow: inset 0 0 0 1px rgba(128, 128, 128, 0.35);
  display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer;
}
.sw.on { outline: 3px solid var(--md-primary); outline-offset: 2px; }
.sw.custom ion-icon { font-size: 20px; mix-blend-mode: difference; }
.sw.custom input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
.titles { display: flex; flex-direction: column; gap: 8px; padding: 0 4px 6px; }
.tit { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.tit.off { opacity: .55; }
.tit .chip { padding: 2px 8px; border-radius: 8px; background: rgba(127,127,127,.16); font-weight: 600; }
.tit-empty { margin: 2px 0 0; font-size: 12px; color: var(--md-on-surface-variant); }
.more-toggle {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  width: 100%; margin: 14px 0 4px; padding: 11px 14px;
  border: 0; border-radius: 14px;
  background: var(--md-surface-container); color: var(--md-on-surface-variant);
  font-size: 13px;
}
.more-toggle .chev { opacity: .7; }
</style>
