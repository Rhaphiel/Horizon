<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <!-- 悬浮胶囊标签栏：62 高、左右留白、蓝色胶囊可拖动切换 -->
      <ion-tab-bar
        slot="bottom"
        class="m3-nav"
        ref="barRef"
        @pointerdown="onBarDown"
        @pointermove="onBarMove"
        @pointerup="onBarUp"
        @pointercancel="onBarUp"
      >
        <div class="pill" ref="pillRef" aria-hidden="true"></div>

        <ion-tab-button tab="chats" href="/tabs/chats">
          <span class="ind">
            <ion-icon class="off" :icon="chatbubblesOutline" />
            <ion-icon class="on" :icon="chatbubbles" />
            <ion-label>聊天</ion-label>
            <span v-if="totalUnread > 0" class="dot">{{ totalUnread > 99 ? '99+' : totalUnread }}</span>
          </span>
        </ion-tab-button>

        <ion-tab-button tab="friends" href="/tabs/friends">
          <span class="ind">
            <ion-icon class="off" :icon="peopleOutline" />
            <ion-icon class="on" :icon="people" />
            <ion-label>好友</ion-label>
            <span v-if="friendState.incoming.length > 0" class="dot">{{ friendState.incoming.length }}</span>
          </span>
        </ion-tab-button>

        <ion-tab-button tab="me" href="/tabs/me">
          <span class="ind">
            <ion-icon class="off" :icon="personCircleOutline" />
            <ion-icon class="on" :icon="personCircle" />
            <ion-label>我的</ion-label>
          </span>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, IonLabel, IonIcon } from '@ionic/vue';
import { chatbubbles, chatbubblesOutline, people, peopleOutline, personCircle, personCircleOutline } from 'ionicons/icons';
import { totalUnread } from '@/stores/chats';
import { friendState } from '@/stores/friends';

const route = useRoute();
const router = useRouter();
const barRef = ref<unknown>(null);
const pillRef = ref<HTMLElement | null>(null);

const PATHS = ['/tabs/chats', '/tabs/friends', '/tabs/me'];
const SPRING = 'transform .28s cubic-bezier(.3,1.15,.5,1), width .28s cubic-bezier(.3,1.15,.5,1), height .28s cubic-bezier(.3,1.15,.5,1)';
const SNAP_PX = 75;   // 松手时，胶囊中心离图标中心 75px 以内才吸附

let pillX = 0;
let pillY = 0;
let pillW = 0;
let pillH = 0;
let lastIndex = -1;

function activeIndex(): number {
  const p = route.path;
  if (p.startsWith('/tabs/friends')) return 1;
  if (p.startsWith('/tabs/me')) return 2;
  return 0;
}

function barEl(): HTMLElement | null {
  const r = barRef.value as { $el?: HTMLElement } | HTMLElement | null;
  if (!r) return null;
  return (r as { $el?: HTMLElement }).$el ?? (r as HTMLElement);
}

function tabButtons(): HTMLElement[] {
  const bar = barEl();
  return bar ? ([...bar.querySelectorAll('ion-tab-button')] as HTMLElement[]) : [];
}

function applyPill(x: number, y: number): void {
  const pill = pillRef.value;
  if (!pill) return;
  pill.style.transform = `translate(${x}px, ${y}px)`;
}

// 把胶囊放到某个标签上；animate=true 时带弹性动画
function movePillTo(index: number, animate: boolean): void {
  const pill = pillRef.value;
  const bar = barEl();
  const btns = tabButtons();
  if (!pill || !bar || !btns[index]) return;

  const ind = (btns[index].querySelector('.ind') as HTMLElement) ?? btns[index];
  const barBox = bar.getBoundingClientRect();
  const box = ind.getBoundingClientRect();
  if (!box.width) return;

  pillX = box.left - barBox.left;
  pillY = box.top - barBox.top;
  pillW = box.width;
  pillH = box.height;

  pill.style.transition = animate ? SPRING : 'none';
  pill.style.width = pillW + 'px';
  pill.style.height = pillH + 'px';
  applyPill(pillX, pillY);
  lastIndex = index;
}

function refresh(animate: boolean): void {
  void nextTick(() => movePillTo(activeIndex(), animate));
}

// ---------- 拖动胶囊 ----------
let drag: { id: number; startX: number; x0: number; moved: boolean } | null = null;
let dragX = 0;                    // 拖动过程中的实时 X（关键：松手时用它判断落点）
let suppressClickUntil = 0;       // 拖动刚结束时，压掉按钮自带的 click 跳转

function onBarDown(e: PointerEvent): void {
  const pill = pillRef.value;
  const bar = barEl();
  if (!pill || !bar) return;
  const ind = (e.target as HTMLElement).closest('.ind') as HTMLElement | null;
  if (!ind) return;
  const btns = tabButtons();
  const idx = btns.findIndex(b => b.contains(ind));
  if (idx !== activeIndex()) return;   // 只能拖「当前选中的胶囊」

  drag = { id: e.pointerId, startX: e.clientX, x0: pillX, moved: false };
  dragX = pillX;
  bar.setPointerCapture?.(e.pointerId);
  pill.style.transition = 'none';
}

function onBarMove(e: PointerEvent): void {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.startX;
  if (Math.abs(dx) > 4) drag.moved = true;
  const bar = barEl();
  if (!bar) return;
  const maxX = bar.clientWidth - pillW;
  const x = Math.max(0, Math.min(maxX, drag.x0 + dx));
  dragX = x;
  applyPill(x, pillY);
}

function onBarUp(e: PointerEvent): void {
  if (!drag || drag.id !== e.pointerId) return;
  const moved = drag.moved;
  drag = null;
  if (!moved) { refresh(false); return; }

  // 松手：吸附到最近的标签
  const btns = tabButtons();
  const pill = pillRef.value;
  const bar = barEl();
  if (!btns.length || !pill || !bar) return;
  const barBox = bar.getBoundingClientRect();
  const center = barBox.left + dragX + pillW / 2;   // 用拖动中的实时位置
  let best = activeIndex();
  let bestDist = Infinity;
  btns.forEach((b, i) => {
    const r = b.getBoundingClientRect();
    const d = Math.abs(r.left + r.width / 2 - center);
    if (d < bestDist) { bestDist = d; best = i; }
  });

  const nearEnough = bestDist <= SNAP_PX;
  if (best !== activeIndex() && nearEnough) {
    // 1) 先让胶囊吸附到目标图标上；2) 再切页面
    suppressClickUntil = Date.now() + 500;
    movePillTo(best, true);
    window.setTimeout(() => { void router.push(PATHS[best]); }, 120);
  } else {
    movePillTo(activeIndex(), true);   // 不够近 / 拖回原位：弹回当前标签
  }
}

// 拖动结束后，拦掉原按钮的 click（否则会跳到手指按下的那个标签）
function onBarClickCapture(e: MouseEvent): void {
  if (Date.now() < suppressClickUntil) {
    e.preventDefault();
    e.stopPropagation();
  }
}

onMounted(() => {
  refresh(false);
  window.setTimeout(() => movePillTo(activeIndex(), false), 120);
  window.addEventListener('resize', onResize);
  barEl()?.addEventListener('click', onBarClickCapture, true);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  barEl()?.removeEventListener('click', onBarClickCapture, true);
});

function onResize(): void {
  movePillTo(activeIndex(), false);
}

watch(() => route.path, () => refresh(true));
</script>

<style scoped>
ion-tab-bar.m3-nav {
  --background: var(--md-surface-container);
  --border: 0;
  height: 62px;
  width: calc(100% - 40px);
  margin: 0 auto calc(10px + var(--ion-safe-area-bottom, 0px));
  border-radius: 31px;
  padding: 0 6px;
  contain: none;
  border-top: 0;
  align-items: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(17, 24, 39, 0.16);
  touch-action: none;
}

/* 会滑动 / 可拖动的胶囊 */
.pill {
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 26px;
  background: var(--md-primary, #2563eb);
  pointer-events: none;
  z-index: 0;
  will-change: transform, width, height;
}

ion-tab-button {
  --color: var(--md-on-surface-variant);
  --color-selected: #fff;
  --ripple-color: transparent;
  --padding-top: 0;
  --padding-bottom: 0;
  max-width: none;
  background: transparent;
  position: relative;
  z-index: 1;
}

.ind {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 64px;
  padding: 6px 14px;
  border-radius: 26px;
}
.ind ion-icon { font-size: 20px; }
.ind ion-label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  margin: 0;
}
.ind .on { display: none; color: #fff; }
ion-tab-button.tab-selected .ind .on { display: block; }
ion-tab-button.tab-selected .ind .off { display: none; }
ion-tab-button.tab-selected .ind ion-label { color: #fff; font-weight: 600; }

/* 小红点 / 数字角标 */
.dot {
  position: absolute;
  top: 2px;
  right: 6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--md-error);
  color: var(--md-on-error);
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  text-align: center;
  box-sizing: border-box;
}
</style>
