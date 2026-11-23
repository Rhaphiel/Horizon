<template>
  <ion-page ref="page" :style="bubbleVars">
    <ion-header>
      <ion-toolbar v-if="mode === 'chat'">
        <ion-buttons slot="start">
          <ion-button class="icon-btn" aria-label="返回" @click="leaveChat"><ion-icon slot="icon-only" :icon="arrowBack" /></ion-button>
        </ion-buttons>
        <ion-title>
          <div class="head">
            <Avatar :name="title || '?'" :size="38" />
            <span class="t">{{ title }}</span>
          </div>
        </ion-title>
        <ion-buttons slot="end">
          <ion-button class="icon-btn" aria-label="搜索" @click="openSearch"><ion-icon slot="icon-only" :icon="searchOutline" /></ion-button>
          <ion-button class="icon-btn" aria-label="更多" @click="openMenu"><ion-icon slot="icon-only" :icon="ellipsisVertical" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar v-else>
        <ion-searchbar v-model="kw" placeholder="搜索本聊天的消息" :debounce="0" @keydown="onSearchKey" />
        <ion-buttons slot="end">
          <ion-button @click="closeSearch">取消</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content ref="content" :class="{ plain: mode === 'search' }">
      <!-- 消息 -->
      <div v-if="mode === 'chat'" class="msgs">
        <div v-if="hasOlder" class="more">
          <ion-button size="small" class="tonal" :disabled="loadingMore" @click="loadOlder">加载更早的消息</ion-button>
        </div>

        <template v-for="it in items" :key="it.key">
          <div v-if="it.day" class="day">{{ it.day }}</div>
          <div v-else-if="it.msg" :class="['msg', { mine: it.msg.sender_id === me, flash: it.msg.id === flashId }]" :data-id="it.msg.id">
            <div
              class="bubble"
              @pointerdown="pressStart($event, it.msg)"
              @pointermove="pressMove"
              @pointerup="cancelPress"
              @pointercancel="cancelPress"
              @pointerleave="cancelPress"
              @contextmenu.prevent="onContext(it.msg)"
            >
              <div v-if="it.msg.sender_id !== me && isGroup" class="who">{{ nameOf(it.msg.sender_id) }}</div>
              <div class="body">{{ it.msg.body }}</div>
              <div class="meta">{{ fmtTime(it.msg.created_at) }}</div>
            </div>
          </div>
        </template>

        <div v-if="hasNewer" class="more">
          <ion-button size="small" class="tonal" :disabled="loadingMore" @click="loadNewer">加载更新的消息</ion-button>
        </div>
        <div v-if="!rows.length && !hasOlder && !hasNewer" class="empty-tip">还没有消息。</div>
      </div>

      <!-- 搜索结果 -->
      <ion-list v-else>
        <ion-item v-for="h in hits" :key="h.id" button :detail="false" @click="pickHit(h)">
          <ion-label class="ion-text-wrap">
            <p>{{ nameOf(h.sender_id) }} · {{ fmtDateTime(h.created_at) }}</p>
            <h3>
              <span v-for="(p, i) in parts(h.body)" :key="i" :class="{ 'hit-mark': p.hit }">{{ p.text }}</span>
            </h3>
          </ion-label>
        </ion-item>
        <ion-item v-if="searched && !hits.length" lines="none"><ion-label color="medium">没有找到相关消息</ion-label></ion-item>
        <ion-item v-if="hits.length >= 50" lines="none"><ion-label color="medium">只显示最近 50 条，可以换更具体的关键词</ion-label></ion-item>
      </ion-list>
    </ion-content>

    <ion-footer v-if="mode === 'chat'">
      <div v-if="note" class="note">{{ note }}</div>
      <ion-toolbar>
        <div class="composer">
          <!-- 原生 textarea：按屏幕宽度自动换行，内容多时向上长高（最高约 5 行，再多就在框内滚动） -->
          <textarea
            ref="ta"
            v-model="text"
            class="ta"
            rows="1"
            maxlength="1000"
            placeholder="输入消息"
            autocomplete="off"
            autocapitalize="sentences"
            @keydown="onKey"
          />
          <ion-button class="send" :disabled="sending || !(text ?? '').trim()" aria-label="发送" @click="send">
            <ion-icon slot="icon-only" :icon="sendIcon" />
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>

    <SelectTextModal :open="selectOpen" :text="pickedBody" @close="selectOpen = false" />
    <ForwardModal :open="forwardOpen" :body="pickedBody" :busy="forwarding" @close="forwardOpen = false" @submit="forwardTo" />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonButton, IonTitle, IonContent, IonFooter,
  IonSearchbar, IonList, IonItem, IonLabel, IonIcon,
  actionSheetController, onIonViewDidEnter, onIonViewWillLeave, useIonRouter,
} from '@ionic/vue';
import { arrowBack, arrowRedoOutline, closeOutline, copyOutline, ellipsisVertical, searchOutline, send as sendIcon, textOutline } from 'ionicons/icons';
import Avatar from '@/components/Avatar.vue';
import SelectTextModal from '@/components/SelectTextModal.vue';
import ForwardModal from '@/components/ForwardModal.vue';
import { bubbleVars } from '@/theme/appearance';
import { copyText } from '@/lib/clipboard';
import { leaveChat } from '@/services/navigation';
import type { MessageRow } from '@/types/database';
import { chats, chatTitle, getChat, loadChats, markRead, touchChat } from '@/stores/chats';
import { nameOf } from '@/stores/directory';
import { myId } from '@/stores/session';
import { fmtDateTime, fmtDay, fmtTime, highlightParts, makeSnippet } from '@/lib/format';
import { confirmDialog, showToast } from '@/lib/toast';
import { on } from '@/lib/bus';
import { registerBackHandler } from '@/services/backButton';
import { clearDelivered } from '@/services/notify';
import { clearConversation } from '@/services/chatApi';
import {
  AROUND_AFTER, AROUND_BEFORE, PAGE,
  fetchAfter, fetchBefore, fetchLatest, fetchNewer, fetchOlder, searchMessages, sendMessage,
} from '@/services/messagesApi';

type ContentEl = { getScrollElement: () => Promise<HTMLElement>; scrollToBottom: (duration?: number) => Promise<void> };
type Item = { key: string; day?: string; msg?: MessageRow };

const route = useRoute();
const router = useRouter();
const ionRouter = useIonRouter();

const page = ref<{ $el: HTMLElement } | null>(null);
const content = ref<{ $el: ContentEl } | null>(null);

const cid = ref('');
const rows = ref<MessageRow[]>([]);
let ids = new Set<string>();
const hasOlder = ref(false);   // 前面还有更早的消息
const hasNewer = ref(false);   // 后面还有更新的消息（只有从搜索结果跳到历史消息时才会出现）
const loadingMore = ref(false);
const text = ref('');
const sending = ref(false);
const note = ref('');
const flashId = ref('');
const ta = ref<HTMLTextAreaElement | null>(null);

const mode = ref<'chat' | 'search'>('chat');
const kw = ref('');
const lastKw = ref('');
const hits = ref<MessageRow[]>([]);
const searched = ref(false);

const me = computed(() => myId());
const chat = computed(() => getChat(cid.value));
const isGroup = computed(() => chat.value?.type === 'group');
const title = computed(() => {
  const c = chat.value;
  if (!c) return '';
  return c.type === 'group' ? `${chatTitle(c)}（${c.members.length}人）` : chatTitle(c);
});

// 把消息按日期插入分隔条
const items = computed<Item[]>(() => {
  const out: Item[] = [];
  let day = '';
  for (const m of rows.value) {
    const d = fmtDay(m.created_at);
    if (d !== day) {
      day = d;
      out.push({ key: 'd-' + m.id, day: d });
    }
    out.push({ key: m.id, msg: m });
  }
  return out;
});

const parts = (body: string) => highlightParts(makeSnippet(body, lastKw.value), lastKw.value);

// ---------- 工具 ----------
const sleep = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));
const byTime = (a: MessageRow, b: MessageRow): number => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0);

function mergeRows(list: MessageRow[]): void {
  const add = list.filter(m => !ids.has(m.id));
  if (!add.length) return;
  add.forEach(m => ids.add(m.id));
  rows.value = [...rows.value, ...add].sort(byTime);
}
function resetRows(): void {
  rows.value = [];
  ids = new Set<string>();
  hasOlder.value = false;
  hasNewer.value = false;
}

async function scrollEl(): Promise<HTMLElement | null> {
  const el = content.value?.$el;
  return el ? await el.getScrollElement() : null;
}
async function nearBottom(): Promise<boolean> {
  const sc = await scrollEl();
  return !sc || sc.scrollHeight - sc.scrollTop - sc.clientHeight < 120;
}
async function scrollBottom(): Promise<void> {
  await nextTick();
  await sleep(40);
  await content.value?.$el.scrollToBottom(0);
}
async function jumpTo(id: string): Promise<void> {
  await nextTick();
  await sleep(40);
  const el = page.value?.$el.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  flashId.value = id;
  window.setTimeout(() => {
    flashId.value = '';
  }, 1800);
}

// ---------- 加载消息 ----------
async function init(): Promise<void> {
  if (!cid.value) return;
  resetRows();
  note.value = '';
  mode.value = 'chat';
  if (!getChat(cid.value)) await loadChats();
  if (!getChat(cid.value)) {
    void showToast('找不到这个聊天');
    ionRouter.navigate('/tabs/chats', 'root', 'replace');
    return;
  }
  const msg = typeof route.query.msg === 'string' ? route.query.msg : '';
  const at = typeof route.query.at === 'string' ? route.query.at : '';
  if (msg && at) await openAround({ id: msg, created_at: at });
  else await openLatest();
}

async function openLatest(): Promise<void> {
  const { data, error } = await fetchLatest(cid.value);
  if (error) {
    note.value = '加载消息失败：' + error.message;
    return;
  }
  resetRows();
  mergeRows([...data].reverse());
  hasOlder.value = data.length === PAGE;
  await scrollBottom();
}

// 打开聊天并直接跳到某条消息（从搜索结果点进来时）
async function openAround(target: { id: string; created_at: string }): Promise<void> {
  const [b, a] = await Promise.all([fetchBefore(cid.value, target.created_at), fetchAfter(cid.value, target.created_at)]);
  if (b.error || a.error) {
    note.value = '加载消息失败：' + (b.error || a.error)?.message;
    return;
  }
  const before = b.data ?? [];
  const after = a.data ?? [];
  resetRows();
  mergeRows([...before].reverse().concat(after));
  hasOlder.value = before.length === AROUND_BEFORE;
  hasNewer.value = after.length === AROUND_AFTER;
  await jumpTo(target.id);
}

async function loadOlder(): Promise<void> {
  const first = rows.value[0];
  if (!first || loadingMore.value) return;
  loadingMore.value = true;
  const sc = await scrollEl();
  const prevH = sc?.scrollHeight ?? 0;
  const prevTop = sc?.scrollTop ?? 0;
  const { data, error } = await fetchOlder(cid.value, first.created_at);
  loadingMore.value = false;
  if (error) {
    note.value = '加载失败：' + error.message;
    return;
  }
  hasOlder.value = data.length === PAGE;
  mergeRows(data);
  await nextTick();
  if (sc) sc.scrollTop = sc.scrollHeight - prevH + prevTop;   // 保持当前位置不跳动
}

async function loadNewer(): Promise<void> {
  const last = rows.value[rows.value.length - 1];
  if (!last || loadingMore.value) return;
  loadingMore.value = true;
  const { data, error } = await fetchNewer(cid.value, last.created_at);
  loadingMore.value = false;
  if (error) {
    note.value = '加载失败：' + error.message;
    return;
  }
  hasNewer.value = data.length === PAGE;
  mergeRows(data);
}

// ---------- 发送 ----------
// 手机上回车 = 换行（用右边的发送按钮发送）；电脑上回车发送，Shift+回车换行
const isTouch = window.matchMedia('(pointer: coarse)').matches;
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isTouch) {
    e.preventDefault();
    void send();
  }
}

const MAX_TA = 132;   // 输入框最高像素（约 5 行）
function fitTextarea(): void {
  const el = ta.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, MAX_TA) + 'px';
  el.style.overflowY = el.scrollHeight > MAX_TA ? 'auto' : 'hidden';
}
watch(text, () => void nextTick(fitTextarea));

async function send(): Promise<void> {
  const body = (text.value ?? '').trim();
  const uid = myId();
  if (!body || sending.value || !uid || !chat.value) return;
  sending.value = true;
  note.value = '';
  try {
    if (hasNewer.value) await openLatest();   // 正在看历史消息时发送，先回到最新
    const { data, error } = await sendMessage(cid.value, uid, body);
    if (error) {
      note.value = '发送失败：' + error.message;
      return;
    }
    text.value = '';
    void nextTick(fitTextarea);
    mergeRows([data]);
    touchChat(data);
    await scrollBottom();
  } finally {
    sending.value = false;
  }
}

// ---------- 长按消息：复制 / 选择文本 / 转发 ----------
const selectOpen = ref(false);
const forwardOpen = ref(false);
const forwarding = ref(false);
const pickedBody = ref('');

let pressTimer = 0;
let pressX = 0;
let pressY = 0;
let lastMenuAt = 0;

function pressStart(e: PointerEvent, m: MessageRow): void {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  cancelPress();
  pressX = e.clientX;
  pressY = e.clientY;
  pressTimer = window.setTimeout(() => {
    pressTimer = 0;
    void openMsgMenu(m);
  }, 450);
}
function pressMove(e: PointerEvent): void {
  if (pressTimer && Math.hypot(e.clientX - pressX, e.clientY - pressY) > 10) cancelPress();   // 手指在滑动：不算长按
}
function cancelPress(): void {
  if (pressTimer) window.clearTimeout(pressTimer);
  pressTimer = 0;
}
// 有些系统会额外触发 contextmenu；刚弹过菜单就忽略，避免弹两次
function onContext(m: MessageRow): void {
  if (Date.now() - lastMenuAt > 800) void openMsgMenu(m);
}

async function openMsgMenu(m: MessageRow): Promise<void> {
  lastMenuAt = Date.now();
  navigator.vibrate?.(12);
  const sheet = await actionSheetController.create({
    buttons: [
      {
        text: '复制',
        icon: copyOutline,
        // 复制要在点击的当下执行，系统才允许写剪贴板
        handler: () => {
          void copyText(m.body).then(ok => showToast(ok ? '已复制' : '复制失败'));
        },
      },
      { text: '选择文本', icon: textOutline, data: 'select' },
      { text: '转发', icon: arrowRedoOutline, data: 'forward' },
      { text: '取消', icon: closeOutline, role: 'cancel' },
    ],
  });
  await sheet.present();
  const { data } = await sheet.onDidDismiss<string>();
  pickedBody.value = m.body;
  if (data === 'select') selectOpen.value = true;
  if (data === 'forward') forwardOpen.value = true;
}

async function forwardTo(ids: string[]): Promise<void> {
  const uid = myId();
  const body = pickedBody.value;
  if (!uid || !body || !ids.length || forwarding.value) return;
  forwarding.value = true;
  let ok = 0;
  let fail = 0;
  try {
    for (const id of ids) {
      const { data, error } = await sendMessage(id, uid, body);
      if (error || !data) {
        fail += 1;
        continue;
      }
      ok += 1;
      touchChat(data);
      if (id === cid.value && !hasNewer.value) {
        mergeRows([data]);
        await scrollBottom();
      }
    }
  } finally {
    forwarding.value = false;
  }
  forwardOpen.value = false;
  void showToast(fail ? `已转发到 ${ok} 个聊天，${fail} 个失败` : `已转发到 ${ok} 个聊天`);
}

// ---------- 搜索本聊天 ----------
function openSearch(): void {
  mode.value = 'search';
}
function closeSearch(): void {
  mode.value = 'chat';
  kw.value = '';
  lastKw.value = '';
  hits.value = [];
  searched.value = false;
}
function onSearchKey(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.isComposing) void doSearch();
}
async function doSearch(): Promise<void> {
  const q = (kw.value ?? '').trim();
  if (!q) return;
  const { data, error } = await searchMessages(q, cid.value);
  if (error) {
    void showToast('搜索失败：' + error.message);
    return;
  }
  lastKw.value = q;
  hits.value = data;
  searched.value = true;
}
function pickHit(h: MessageRow): void {
  const target = { id: h.id, created_at: h.created_at };
  closeSearch();
  void openAround(target);
}

// ---------- 更多菜单 ----------
async function openMenu(): Promise<void> {
  const buttons: Array<{ text: string; role?: string; handler?: () => void }> = [];
  if (isGroup.value) {
    buttons.push({
      text: '群聊信息',
      handler: () => {
        void router.push(`/chat/${cid.value}/info`);
      },
    });
  }
  buttons.push({
    text: '清空聊天记录',
    role: 'destructive',
    handler: () => {
      void clearChat();
    },
  });
  buttons.push({ text: '取消', role: 'cancel' });
  const sheet = await actionSheetController.create({ header: title.value, buttons });
  await sheet.present();
}

async function clearChat(): Promise<void> {
  const ok = await confirmDialog('清空聊天记录', '只会清空你这边的记录，对方和群里其他人不受影响。确定清空吗？', '清空');
  if (!ok) return;
  const err = await clearConversation(cid.value);
  if (err) {
    void showToast(err);
    return;
  }
  resetRows();
  void showToast('已清空聊天记录');
}

// ---------- 实时 / 前后台 ----------
async function onIncoming(m: MessageRow): Promise<void> {
  if (m.conversation_id !== cid.value || hasNewer.value) return;
  const near = await nearBottom();
  mergeRows([m]);
  if (m.sender_id === myId() || near) await scrollBottom();
}

async function onResume(): Promise<void> {
  if (chats.openId !== cid.value || hasNewer.value) return;
  const { data } = await fetchLatest(cid.value);
  if (data) mergeRows(data);
}

let offBack: (() => void) | null = null;
let offMsg: (() => void) | null = null;
let offResume: (() => void) | null = null;

onMounted(() => {
  // 返回键：搜索面板打开时，先收起它
  offBack = registerBackHandler(() => {
    if (mode.value === 'search') {
      closeSearch();
      return true;
    }
    return false;
  });
  offMsg = on<MessageRow>('message', m => {
    void onIncoming(m);
  });
  offResume = on('resume', () => {
    void onResume();
  });
});
onUnmounted(() => {
  cancelPress();
  offBack?.();
  offMsg?.();
  offResume?.();
});

// 进入 / 离开页面：标记"正在看这个聊天"，进入时算已读并清掉系统通知
onIonViewDidEnter(() => {
  chats.openId = cid.value;
  markRead(cid.value);
  void clearDelivered();
});
onIonViewWillLeave(() => {
  if (chats.openId === cid.value) chats.openId = null;
});

// 这个聊天不存在了（被移出群 / 群被解散 / 自己退群）→ 回到聊天列表
watch(chat, (c, old) => {
  if (old && !c) ionRouter.navigate('/tabs/chats', 'root', 'replace');
});

// 路由里的聊天 id 变化时加载对应聊天（必须放在所有变量声明之后）
watch(
  () => route.params.id,
  v => {
    if (typeof v === 'string' && route.path.startsWith('/chat/') && v !== cid.value) {
      cid.value = v;
      void init();
    }
  },
  { immediate: true },
);
</script>

<style scoped>
/* 聊天背景：颜色 / 图片 / 透明度由「外观」设置决定（见 theme/appearance.ts） */
ion-content { --background: var(--chat-bg); }
ion-content.plain { --background: var(--md-surface); }

.head { display: flex; align-items: center; gap: 12px; min-width: 0; }
.head .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.msgs { display: flex; flex-direction: column; gap: 6px; padding: 12px 12px 16px; }
.more { align-self: center; margin: 6px 0; }
.day {
  align-self: center; margin: 8px 0 4px; padding: 3px 12px; border-radius: 12px;
  background: var(--pill-bg); color: var(--pill-fg); font-size: 12px;
}
.msg { max-width: 84%; display: flex; flex-direction: column; align-items: flex-start; }
.msg.mine { align-self: flex-end; align-items: flex-end; }

/* 气泡：颜色由变量决定，文字颜色与气泡颜色成对选取，保证看得清 */
.bubble {
  background: var(--in-bg);
  color: var(--in-fg);
  padding: 8px 12px 6px;
  min-width: 64px;
  border-radius: 18px 18px 18px 4px;
  box-shadow: 0 0 0 1px var(--bubble-edge), 0 1px 2px rgba(0, 0, 0, 0.18);
  /* 长按由我们自己处理，避免系统的选字菜单抢先弹出 */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: pan-y;
}
.msg.mine .bubble { background: var(--out-bg); color: var(--out-fg); border-radius: 18px 18px 4px 18px; }
.msg.flash .bubble { outline: 2px solid var(--md-primary); outline-offset: 2px; }
.who { font-size: 12px; font-weight: 500; opacity: 0.85; margin-bottom: 2px; }
.body { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 16px; line-height: 1.4; }
.meta { font-size: 11px; opacity: 0.7; text-align: right; margin-top: 2px; }

.note { padding: 4px 16px; font-size: 12px; color: var(--md-error); }
.composer { display: flex; align-items: flex-end; gap: 8px; padding: 4px 8px; }
.ta {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  height: 48px;
  max-height: 132px;
  padding: 12px 16px;
  border: 0;
  outline: 0;
  resize: none;
  border-radius: 24px;
  background: var(--md-surface-container-high);
  color: var(--md-on-surface);
  font: inherit;
  font-size: 16px;
  line-height: 24px;
  white-space: pre-wrap;        /* 按宽度自动换行 */
  overflow-wrap: anywhere;
  overflow-y: hidden;
}
.ta::placeholder { color: var(--md-on-surface-variant); }
.send { --padding-start: 0; --padding-end: 0; --border-radius: 16px; width: 48px; height: 48px; margin: 0; }
</style>
