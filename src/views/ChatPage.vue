<template>
  <ion-page ref="page" :style="bubbleVars">
    <ion-header class="chat-head">
      <div v-if="mode === 'chat'" class="head-row">
        <button class="glass circ" type="button" aria-label="返回" @click="leaveChat">
          <ion-icon :icon="arrowBack" />
        </button>

        <div class="glass title-cap">
          <Avatar :name="title || '?'" :size="34" :src="headerAvatar" />
          <div class="tt">
            <b>
              <span :style="nameStyle(peerTitle)">{{ title }}</span>
              <span v-if="peerTitle" class="ttl" :style="titleStyle(peerTitle)">{{ peerTitle.text }}</span>
            </b>
            <small v-if="isGroup">{{ chat ? chat.members.length : 0 }} 位成员</small>
            <small v-else-if="muted">已静音</small>
          </div>
        </div>

        <button class="glass circ" type="button" aria-label="更多" @click="openMore">
          <ion-icon :icon="ellipsisVertical" />
        </button>
      </div>
      <div v-else class="head-row search-row">
        <button class="glass circ" type="button" aria-label="返回" @click="closeSearch">
          <ion-icon :icon="arrowBack" />
        </button>
        <ion-searchbar v-model="kw" class="glass-search" placeholder="搜索本聊天的消息" :debounce="0" @keydown="onSearchKey" />
      </div>
    </ion-header>

    <ion-content ref="content" :class="{ plain: mode === 'search' }">
      
      <div v-if="mode === 'chat'" class="msgs">
        <div v-if="hasOlder" class="more">
          <ion-button size="small" class="tonal" :disabled="loadingMore" @click="loadOlder">加载更早的消息</ion-button>
        </div>

        <template v-for="it in items" :key="it.key">
          <div v-if="it.day" class="day">{{ it.day }}</div>
          <div v-else-if="it.msg && it.msg.recalled_at" class="recalled">
            {{ recallText(it.msg) }}
          </div>
          <div v-else-if="it.msg" :class="['msg', { mine: it.msg.sender_id === me, flash: it.msg.id === flashId, cont: !!it.cont }]" :data-id="it.msg.id">
            <div v-if="it.msg.sender_id !== me && isGroup" class="ava-slot">
              <Avatar
                v-if="!it.cont"
                :size="30"
                :name="nameOf(it.msg.sender_id)"
                :src="avatarOf(it.msg.sender_id)"
              />
            </div>
            <div
              class="bubble"
              @pointerdown="pressStart($event, it.msg)"
              @pointermove="pressMove"
              @pointerup="cancelPress"
              @pointercancel="cancelPress"
              @pointerleave="cancelPress"
              @contextmenu.prevent="onContext(it.msg)"
            >
              <div v-if="it.msg.sender_id !== me && isGroup" class="who">
                <span :style="nameStyle(titleOf(it.msg.sender_id))">{{ nameOf(it.msg.sender_id) }}</span>
                <span v-if="titleOf(it.msg.sender_id)" class="ttl" :style="titleStyle(titleOf(it.msg.sender_id)!)">{{ titleOf(it.msg.sender_id)!.text }}</span>
              </div>
              <div v-if="it.msg.reply_preview" class="quote">
                <span>{{ it.msg.reply_preview }}</span>
              </div>
              <MediaBubble
                v-if="it.msg.media_type && it.msg.media_type !== 'text'"
                :kind="it.msg.media_type === 'audio' ? 'audio' : 'image'"
                :path="it.msg.media_path"
                :duration="it.msg.media_duration"
                :expired="it.msg.is_expired"
                :expires-at="it.msg.expires_at"
                @open="openViewer(it.msg)"
              />
              <div v-else class="body">{{ it.msg.body }}</div>
              <div class="meta">{{ fmtTime(it.msg.created_at) }}</div>
            </div>
          </div>
        </template>

        <div v-if="hasNewer" class="more">
          <ion-button size="small" class="tonal" :disabled="loadingMore" @click="loadNewer">加载更新的消息</ion-button>
        </div>
        <div v-if="!rows.length && !hasOlder && !hasNewer" class="empty-tip">还没有消息。</div>
      </div>

      
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

    <ion-footer v-if="mode === 'chat'" class="chat-foot">
      <div v-if="reedit && !blocked" class="reedit">
        <span class="rtext">你撤回了一条消息</span>
        <button type="button" class="rdo" @click="doReedit">重新编辑</button>
        <button type="button" class="rx" aria-label="关闭" @click="dismissReedit">✕</button>
      </div>
      <div v-if="note" class="note">{{ note }}</div>

      
      <div v-if="blocked" class="blocked glass">你们已不是好友，不能再发消息。重新加为好友后可以继续聊天。</div>
      <template v-else>
      
      <div v-if="replyTo" class="quote-bar glass">
        <span class="q-line" />
        <div class="q-text">
          <b>{{ replyTo.who }}</b>
          <span>{{ replyTo.preview }}</span>
        </div>
        <button type="button" class="q-x" aria-label="取消引用" @click="clearReply">✕</button>
      </div>

      <div v-if="drawerOpen && !blocked" class="attach-drawer glass">
        <button type="button" class="attach-item" :disabled="busyMedia" @click="drawerImage">
          <span class="attach-ico"><ion-icon :icon="imageOutline" /></span>
          <span>相册图片</span>
        </button>
        <button type="button" class="attach-item" :disabled="busyMedia" @click="drawerCamera">
          <span class="attach-ico"><ion-icon :icon="cameraOutline" /></span>
          <span>拍摄</span>
        </button>
      </div>

      <div class="composer glass">

        <button class="cbtn" :class="{ open: drawerOpen }" type="button" aria-label="更多功能" @click="drawerOpen = !drawerOpen">
          <ion-icon :icon="addCircleOutline" />
        </button>
        <input ref="imgEl" type="file" accept="image/*" hidden @change="onImagePick" />
        <input ref="camEl" type="file" accept="image/*" capture="environment" hidden @change="onCameraPick" />

        
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

        
        <button
          class="cbtn"
          :class="{ rec: recording }"
          type="button"
          :aria-label="recording ? '停止并发送语音' : '录语音'"
          :disabled="busyMedia"
          @click="toggleRecord"
        >
          <ion-icon :icon="recording ? stopCircle : micOutline" />
        </button>

          <ion-button class="send" :class="{ active: (text ?? '').trim().length > 0 }" :disabled="sending || !(text ?? '').trim()" aria-label="发送" @click="send">
            <ion-icon slot="icon-only" :icon="sendIcon" />
          </ion-button>
      </div>
      </template>
    </ion-footer>

    
    <Teleport to="body">
    <div v-if="moreOpen" class="menu-backdrop" @click="closeMore" />
    <div v-if="moreOpen" class="more-pop glass" :style="morePos">
      <button type="button" @click="menuSearch">
        <ion-icon :icon="searchOutline" /><span>搜索聊天记录</span>
      </button>
      <button type="button" @click="menuMute">
        <ion-icon :icon="muted ? notificationsOffOutline : notificationsOutline" />
        <span>{{ muted ? '关闭静音' : '静音' }}</span>
      </button>
      <button v-if="isGroup" type="button" @click="menuInfo">
        <ion-icon :icon="informationCircleOutline" /><span>群聊信息</span>
      </button>
      <button type="button" class="danger" @click="menuClear">
        <ion-icon :icon="trashOutline" /><span>清空聊天记录</span>
      </button>
    </div>
    </Teleport>

    <ImageViewer :open="viewerOpen" :paths="imagePaths" :index="viewerIndex" @close="viewerOpen = false" @change="viewerIndex = $event" />

    <SelectTextModal :open="selectOpen" :text="picked?.body ?? ''" @close="selectOpen = false" />
    <ForwardModal :open="forwardOpen" :body="picked?.body ?? ''" :busy="forwarding" @close="forwardOpen = false" @submit="forwardTo" />
  </ion-page>
</template>

<script setup lang="ts">import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonHeader, IonToolbar, IonButtons, IonButton, IonTitle, IonContent, IonFooter, IonSearchbar, IonList, IonItem, IonLabel, IonIcon, actionSheetController, onIonViewDidEnter, onIonViewWillEnter, onIonViewWillLeave, useIonRouter, } from '@ionic/vue';
import { arrowBack, arrowRedoOutline, addCircleOutline, cameraOutline, closeOutline, copyOutline, ellipsisVertical, imageOutline, micOutline, searchOutline, send as sendIcon, stopCircle, textOutline, arrowUndoOutline, returnUpBackOutline, notificationsOutline, notificationsOffOutline, informationCircleOutline, trashOutline } from 'ionicons/icons';
import Avatar from '@/components/Avatar.vue';
import SelectTextModal from '@/components/SelectTextModal.vue';
import ForwardModal from '@/components/ForwardModal.vue';
import MediaBubble from '@/components/MediaBubble.vue';
import ImageViewer from '@/components/ImageViewer.vue';
import { bubbleVars } from '@/theme/appearance';
import { copyText } from '@/lib/clipboard';
import { leaveChat } from '@/services/navigation';
import type { MessageRow } from '@/types/database';
import { canMessage, chats, chatTitle, getChat, loadChats, markRead, touchChat } from '@/stores/chats';
import { friendlySendError } from '@/lib/errors';
import { nameOf, avatarOf } from '@/stores/directory';
import { myId } from '@/stores/session';
import { ensureTitles, titleOf, titleStyle, nameStyle } from '@/stores/titles';
import { fmtDateTime, fmtDay, fmtTime, highlightParts, makeSnippet, oneLine } from '@/lib/format';
import { confirmDialog, showToast } from '@/lib/toast';
import { on } from '@/lib/bus';
import { registerBackHandler } from '@/services/backButton';
import { clearDelivered } from '@/services/notify';
import { clearConversation, setMuted } from '@/services/chatApi';
import { downloadMedia, uploadChatMedia, sendMediaMessage } from '@/services/mediaApi';
import { compressImage, isImageFile } from '@/services/avatarApi';
import { AROUND_AFTER, AROUND_BEFORE, PAGE, fetchAfter, fetchBefore, fetchLatest, fetchNewer, fetchOlder, recallMessage, searchMessages, sendMessage, } from '@/services/messagesApi';
type ContentEl = {
    getScrollElement: () => Promise<HTMLElement>;
    scrollToBottom: (duration?: number) => Promise<void>;
};
type Item = {
    key: string;
    day?: string;
    msg?: MessageRow;
    cont?: boolean;
};
const route = useRoute();
const router = useRouter();
const ionRouter = useIonRouter();
const page = ref<{
    $el: HTMLElement;
} | null>(null);
const content = ref<{
    $el: ContentEl;
} | null>(null);
const cid = ref('');
const rows = ref<MessageRow[]>([]);
let ids = new Set<string>();
const hasOlder = ref(false);
const hasNewer = ref(false);
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
const blocked = computed(() => !!chat.value && !canMessage(chat.value));
const peerId = computed<string | null>(() => {
    const c = chat.value;
    if (!c || c.type === 'group')
        return null;
    return c.members.find(m => m.user_id !== myId())?.user_id ?? null;
});
const peerTitle = computed(() => titleOf(peerId.value));
const headerAvatar = computed<string | null>(() => {
    const c = getChat(cid.value);
    if (!c)
        return null;
    if (c.type === 'group')
        return c.avatarUrl;
    const other = c.members.find(m => m.user_id !== myId());
    return avatarOf(other?.user_id);
});
const title = computed(() => {
    const c = chat.value;
    if (!c)
        return '';
    return c.type === 'group' ? `${chatTitle(c)}（${c.members.length}人）` : chatTitle(c);
});
const items = computed<Item[]>(() => {
    const out: Item[] = [];
    let day = '';
    let prev: MessageRow | null = null;
    for (const m of rows.value) {
        const d = fmtDay(m.created_at);
        if (d !== day) {
            day = d;
            out.push({ key: 'd-' + m.id, day: d });
            prev = null;
        }
        const gapMs = prev ? (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) : Number.MAX_SAFE_INTEGER;
        const cont = !!prev && prev.sender_id === m.sender_id && !prev.recalled_at && gapMs >= 0 && gapMs < 5 * 60 * 1000;
        out.push({ key: m.id, msg: m, cont });
        prev = m;
    }
    return out;
});
const parts = (body: string) => highlightParts(makeSnippet(body, lastKw.value), lastKw.value);
const sleep = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));
const byTime = (a: MessageRow, b: MessageRow): number => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0);
function mergeRows(list: MessageRow[]): void {
    const add = list.filter(m => !ids.has(m.id));
    if (!add.length)
        return;
    add.forEach(m => ids.add(m.id));
    rows.value = [...rows.value, ...add].sort(byTime);
}
function resetRows(): void {
    rows.value = [];
    ids = new Set<string>();
    hasOlder.value = false;
    hasNewer.value = false;
}
function recallText(m: MessageRow): string {
    if (m.sender_id === myId())
        return '你撤回了一条消息';
    return isGroup.value ? `${nameOf(m.sender_id)} 撤回了一条消息` : '对方撤回了一条消息';
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
    if (!el)
        return;
    el.scrollIntoView({ block: 'center' });
    flashId.value = id;
    window.setTimeout(() => {
        flashId.value = '';
    }, 1800);
}
async function init(): Promise<void> {
    if (!cid.value)
        return;
    resetRows();
    note.value = '';
    mode.value = 'chat';
    if (!getChat(cid.value))
        await loadChats();
    if (!getChat(cid.value)) {
        void showToast('找不到这个聊天');
        ionRouter.navigate('/tabs/chats?force=1', 'root', 'replace');
        return;
    }
    const msg = typeof route.query.msg === 'string' ? route.query.msg : '';
    const at = typeof route.query.at === 'string' ? route.query.at : '';
    if (msg && at)
        await openAround({ id: msg, created_at: at });
    else
        await openLatest();
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
async function openAround(target: {
    id: string;
    created_at: string;
}): Promise<void> {
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
    if (!first || loadingMore.value)
        return;
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
    if (sc)
        sc.scrollTop = sc.scrollHeight - prevH + prevTop;
}
async function loadNewer(): Promise<void> {
    const last = rows.value[rows.value.length - 1];
    if (!last || loadingMore.value)
        return;
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
const isTouch = window.matchMedia('(pointer: coarse)').matches;
function onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isTouch) {
        e.preventDefault();
        void send();
    }
}
const MAX_TA = 132;
function fitTextarea(): void {
    const el = ta.value;
    if (!el)
        return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, MAX_TA) + 'px';
    el.style.overflowY = el.scrollHeight > MAX_TA ? 'auto' : 'hidden';
}
watch(text, () => void nextTick(fitTextarea));
async function send(): Promise<void> {
    const body = (text.value ?? '').trim();
    const uid = myId();
    if (!body || sending.value || !uid || !chat.value)
        return;
    sending.value = true;
    note.value = '';
    try {
        if (hasNewer.value)
            await openLatest();
        const { data, error } = await sendMessage(cid.value, uid, body, replyTo.value?.id, replyTo.value?.preview);
        if (error) {
            note.value = friendlySendError(error.message);
            return;
        }
        text.value = '';
        clearReply();
        void nextTick(fitTextarea);
        mergeRows([data]);
        touchChat(data);
        await scrollBottom();
    }
    finally {
        sending.value = false;
    }
}
const replyTo = ref<{
    id: string;
    who: string;
    preview: string;
} | null>(null);
function startReply(m: MessageRow): void {
    replyTo.value = {
        id: m.id,
        who: m.sender_id === myId() ? '你' : nameOf(m.sender_id),
        preview: (m.media_type && m.media_type !== 'text') ? (m.media_type === 'image' ? '[图片]' : '[语音]') : oneLine(m.body).slice(0, 60),
    };
    void nextTick(() => ta.value?.focus());
}
function clearReply(): void {
    replyTo.value = null;
}
const viewerOpen = ref(false);
const viewerIndex = ref(0);
const imageMsgs = computed(() => rows.value.filter(m => m.media_type === 'image' && !m.is_expired && m.media_path));
const imagePaths = computed(() => imageMsgs.value.map(m => m.media_path as string));
function openViewer(m: MessageRow): void {
    const i = imageMsgs.value.findIndex(x => x.id === m.id);
    viewerIndex.value = i < 0 ? 0 : i;
    viewerOpen.value = true;
}
const imgEl = ref<HTMLInputElement | null>(null);
const camEl = ref<HTMLInputElement | null>(null);
const drawerOpen = ref(false);
const busyMedia = ref(false);
const recording = ref(false);
let recorder: MediaRecorder | null = null;
let recStream: MediaStream | null = null;
let recStarting = false;
let discarded: MediaRecorder | null = null;
let pageLeft = false;
function pickImage(): void {
    imgEl.value?.click();
}
function drawerImage(): void {
    drawerOpen.value = false;
    pickImage();
}
function drawerCamera(): void {
    drawerOpen.value = false;
    camEl.value?.click();
}
async function onCameraPick(e: Event): Promise<void> {
    await onImagePick(e);
}
async function onImagePick(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file)
        return;
    if (!isImageFile(file)) {
        void showToast('只能选图片');
        return;
    }
    if (busyMedia.value)
        return;
    const target = cid.value;
    busyMedia.value = true;
    note.value = '正在发送图片…';
    try {
        let blob: Blob;
        try {
            blob = await compressImage(file, 1600);
        }
        catch {
            note.value = '';
            void showToast('这张图片无法处理（可能是 HEIC 等格式），请换一张 JPG / PNG', 3000);
            return;
        }
        const up = await uploadChatMedia(target, blob, 'image');
        if (up.error || !up.data) {
            note.value = '图片上传失败：' + (up.error || '未知错误');
            return;
        }
        const { data, error } = await sendMediaMessage(target, up.data, 'image');
        if (error) {
            note.value = friendlySendError(error.message);
            return;
        }
        note.value = '';
        touchChat(data as MessageRow);
        if (target !== cid.value)
            return;
        if (hasNewer.value)
            await openLatest();
        mergeRows([data as MessageRow]);
        await scrollBottom();
    }
    catch (err) {
        note.value = '图片发送失败：' + (err instanceof Error ? err.message : '未知错误');
    }
    finally {
        busyMedia.value = false;
    }
}
async function toggleRecord(): Promise<void> {
    if (recording.value) {
        recorder?.stop();
        return;
    }
    if (recStarting)
        return;
    recStarting = true;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (pageLeft) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }
        const target = cid.value;
        recStream = stream;
        const parts: Blob[] = [];
        const startedAt = Date.now();
        const mr = new MediaRecorder(stream);
        recorder = mr;
        mr.ondataavailable = ev => {
            if (ev.data.size)
                parts.push(ev.data);
        };
        mr.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            if (recStream === stream)
                recStream = null;
            if (recorder === mr) {
                recorder = null;
                recording.value = false;
            }
            if (discarded === mr) {
                discarded = null;
                return;
            }
            const dur = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
            const blob = new Blob(parts, { type: mr.mimeType || 'audio/webm' });
            void sendVoice(blob, dur, target);
        };
        mr.start();
        recording.value = true;
        note.value = '录音中… 再点一下麦克风发送';
    }
    catch (err) {
        const e = err as {
            name?: string;
            message?: string;
        };
        if (e?.name === 'NotAllowedError' || /permission/i.test(e?.message || '')) {
            note.value = '麦克风权限被拒绝：请到 系统设置 → 应用 → Horizon → 权限 → 麦克风 里打开';
            void showToast('需要麦克风权限才能发语音', 2400);
        }
        else if (e?.name === 'NotFoundError') {
            note.value = '没有找到麦克风设备';
        }
        else {
            note.value = '无法录音：' + (e?.message || '请检查麦克风权限');
        }
    }
    finally {
        recStarting = false;
    }
}
function discardRecording(): void {
    if (recorder && recorder.state !== 'inactive') {
        discarded = recorder;
        recorder.stop();
        recorder = null;
    }
    else if (recStream) {
        recStream.getTracks().forEach(t => t.stop());
        recStream = null;
    }
    if (recording.value) {
        recording.value = false;
        note.value = '';
    }
}
async function sendVoice(blob: Blob, dur: number, target: string): Promise<void> {
    if (!blob.size)
        return;
    busyMedia.value = true;
    note.value = '正在发送语音…';
    try {
        const up = await uploadChatMedia(target, blob, 'audio');
        if (up.error || !up.data) {
            note.value = '语音上传失败：' + (up.error || '未知错误');
            return;
        }
        const { data, error } = await sendMediaMessage(target, up.data, 'audio', dur);
        if (error) {
            note.value = friendlySendError(error.message);
            return;
        }
        note.value = '';
        touchChat(data as MessageRow);
        if (target !== cid.value)
            return;
        if (hasNewer.value)
            await openLatest();
        mergeRows([data as MessageRow]);
        await scrollBottom();
    }
    catch (err) {
        note.value = '语音发送失败：' + (err instanceof Error ? err.message : '未知错误');
    }
    finally {
        busyMedia.value = false;
    }
}
const selectOpen = ref(false);
const forwardOpen = ref(false);
const forwarding = ref(false);
const picked = ref<MessageRow | null>(null);
const isMedia = (m: MessageRow): boolean => !!m.media_type && m.media_type !== 'text';
const canForwardMedia = (m: MessageRow): boolean => !!m.media_path && !m.is_expired && !(m.expires_at && Date.parse(m.expires_at) <= Date.now());
let pressTimer = 0;
let pressX = 0;
let pressY = 0;
let lastMenuAt = 0;
function pressStart(e: PointerEvent, m: MessageRow): void {
    if (e.pointerType === 'mouse' && e.button !== 0)
        return;
    cancelPress();
    pressX = e.clientX;
    pressY = e.clientY;
    pressTimer = window.setTimeout(() => {
        pressTimer = 0;
        void openMsgMenu(m);
    }, 450);
}
function pressMove(e: PointerEvent): void {
    if (pressTimer && Math.hypot(e.clientX - pressX, e.clientY - pressY) > 10)
        cancelPress();
}
function cancelPress(): void {
    if (pressTimer)
        window.clearTimeout(pressTimer);
    pressTimer = 0;
}
function onContext(m: MessageRow): void {
    if (Date.now() - lastMenuAt > 800)
        void openMsgMenu(m);
}
async function openMsgMenu(m: MessageRow): Promise<void> {
    lastMenuAt = Date.now();
    navigator.vibrate?.(12);
    const canRecall = m.sender_id === myId()
        && !m.recalled_at
        && Date.now() - Date.parse(m.created_at) < 60 * 60 * 1000;
    const media = isMedia(m);
    const textButtons = media
        ? []
        : [
            {
                text: '复制',
                icon: copyOutline,
                handler: () => {
                    void copyText(m.body).then(ok => showToast(ok ? '已复制' : '复制失败'));
                },
            },
            { text: '选择文本', icon: textOutline, data: 'select' },
        ];
    const canForward = !media || canForwardMedia(m);
    const canReply = !blocked.value;
    if (!textButtons.length && !canForward && !canReply && !canRecall)
        return;
    const sheet = await actionSheetController.create({
        buttons: [
            ...textButtons,
            ...(canForward ? [{ text: '转发', icon: arrowRedoOutline, data: 'forward' }] : []),
            ...(canReply ? [{ text: '引用回复', icon: returnUpBackOutline, data: 'reply' }] : []),
            ...(canRecall ? [{ text: '撤回', icon: arrowUndoOutline, data: 'recall' }] : []),
            { text: '取消', icon: closeOutline, role: 'cancel' },
        ],
    });
    await sheet.present();
    const { data } = await sheet.onDidDismiss<string>();
    picked.value = m;
    if (data === 'select')
        selectOpen.value = true;
    if (data === 'forward')
        forwardOpen.value = true;
    if (data === 'recall')
        await recall(m);
    if (data === 'reply')
        startReply(m);
}
const muted = computed(() => chat.value?.muted ?? false);
let muteBusy = false;
async function toggleMute(): Promise<void> {
    if (muteBusy || !cid.value)
        return;
    const on = !muted.value;
    muteBusy = true;
    const err = await setMuted(cid.value, on);
    muteBusy = false;
    void showToast(err || (on ? '已静音这个聊天' : '已恢复通知'));
}
const reedit = ref<{
    text: string;
    at: number;
} | null>(null);
let reeditTimer = 0;
async function recall(m: MessageRow): Promise<void> {
    const { data, error } = await recallMessage(m.id);
    if (error) {
        void showToast(error.code === 'PGRST116' ? '超过 1 小时的消息不能撤回' : '撤回失败：' + error.message);
        return;
    }
    const i = rows.value.findIndex(r => r.id === m.id);
    if (i >= 0)
        rows.value[i] = data as MessageRow;
    if (m.media_type === 'text' || !m.media_type) {
        reedit.value = { text: m.body, at: Date.now() };
        window.clearTimeout(reeditTimer);
        reeditTimer = window.setTimeout(() => { reedit.value = null; }, 10 * 60 * 1000);
    }
    else {
        reedit.value = null;
    }
}
function doReedit(): void {
    if (!reedit.value)
        return;
    text.value = reedit.value.text;
    reedit.value = null;
    window.clearTimeout(reeditTimer);
    void nextTick(() => { fitTextarea(); ta.value?.focus(); });
}
function dismissReedit(): void {
    reedit.value = null;
    window.clearTimeout(reeditTimer);
}
function onUpdated(m: MessageRow): void {
    if (m.conversation_id !== cid.value)
        return;
    const i = rows.value.findIndex(r => r.id === m.id);
    if (i >= 0)
        rows.value[i] = m;
}
async function forwardOne(target: string, m: MessageRow, blob: Blob | null): Promise<MessageRow | null> {
    const uid = myId();
    if (!isMedia(m)) {
        const { data, error } = await sendMessage(target, uid, m.body);
        return error || !data ? null : data;
    }
    if (!blob)
        return null;
    const kind = m.media_type === 'audio' ? 'audio' : 'image';
    const file = new Blob([blob], { type: m.media_mime || blob.type });
    const up = await uploadChatMedia(target, file, kind);
    if (up.error || !up.data)
        return null;
    if (m.media_name)
        up.data.name = m.media_name;
    const { data, error } = await sendMediaMessage(target, up.data, kind, m.media_duration ?? undefined);
    return error || !data ? null : (data as MessageRow);
}
async function forwardTo(ids: string[]): Promise<void> {
    const uid = myId();
    const m = picked.value;
    if (!uid || !m || !ids.length || forwarding.value)
        return;
    forwarding.value = true;
    let ok = 0;
    let fail = 0;
    try {
        let blob: Blob | null = null;
        if (isMedia(m)) {
            const dl = m.media_path ? await downloadMedia(m.media_path) : { blob: null, error: '文件已过期' };
            if (!dl.blob) {
                void showToast('转发失败：' + (dl.error || '文件已过期'));
                return;
            }
            blob = dl.blob;
        }
        for (const id of ids) {
            const data = await forwardOne(id, m, blob);
            if (!data) {
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
    }
    finally {
        forwarding.value = false;
    }
    forwardOpen.value = false;
    void showToast(fail ? `已转发到 ${ok} 个聊天，${fail} 个失败` : `已转发到 ${ok} 个聊天`);
}
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
    if (e.key === 'Enter' && !e.isComposing)
        void doSearch();
}
async function doSearch(): Promise<void> {
    const q = (kw.value ?? '').trim();
    if (!q)
        return;
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
const moreOpen = ref(false);
const morePos = ref<Record<string, string>>({});
function openMore(ev: Event): void {
    const el = ev.currentTarget as HTMLElement | null;
    const r = el?.getBoundingClientRect();
    if (r) {
        morePos.value = {
            top: `${r.bottom + 8}px`,
            right: `${Math.max(12, window.innerWidth - r.right)}px`,
        };
    }
    moreOpen.value = true;
}
function closeMore(): void {
    moreOpen.value = false;
}
function menuSearch(): void { closeMore(); openSearch(); }
function menuMute(): void { closeMore(); void toggleMute(); }
function menuInfo(): void {
    closeMore();
    void router.push({ path: `/chat/${cid.value}/info`, query: route.query });
}
function menuClear(): void { closeMore(); void clearChat(); }
async function clearChat(): Promise<void> {
    const ok = await confirmDialog('清空聊天记录', '只会清空你这边的记录，对方和群里其他人不受影响。确定清空吗？', '清空');
    if (!ok)
        return;
    const err = await clearConversation(cid.value);
    if (err) {
        void showToast(err);
        return;
    }
    resetRows();
    void showToast('已清空聊天记录');
}
function refreshSenderTitles(): void {
    const ids = [...new Set(rows.value.map(r => r.sender_id))];
    void ensureTitles(ids);
    if (peerId.value)
        void ensureTitles([peerId.value]);
}
watch(() => rows.value.length, () => refreshSenderTitles());
async function onIncoming(m: MessageRow): Promise<void> {
    if (m.conversation_id !== cid.value || hasNewer.value)
        return;
    const near = await nearBottom();
    mergeRows([m]);
    if (m.sender_id === myId() || near)
        await scrollBottom();
}
async function onResume(): Promise<void> {
    if (chats.openId !== cid.value || hasNewer.value)
        return;
    const target = cid.value;
    const { data } = await fetchLatest(target);
    if (!data || target !== cid.value)
        return;
    const fresh = [...data].reverse();
    const last = rows.value[rows.value.length - 1];
    if (last && data.length === PAGE && fresh[0].created_at > last.created_at) {
        resetRows();
        mergeRows(fresh);
        hasOlder.value = true;
        await scrollBottom();
        return;
    }
    const byId = new Map(fresh.map(m => [m.id, m]));
    if (rows.value.some(r => byId.has(r.id)))
        rows.value = rows.value.map(r => byId.get(r.id) ?? r);
    const near = await nearBottom();
    mergeRows(fresh);
    if (near)
        await scrollBottom();
}
let offBack: (() => void) | null = null;
let offMsg: (() => void) | null = null;
let offResume: (() => void) | null = null;
let offUpdated: (() => void) | null = null;
let offSearch: (() => void) | null = null;
onMounted(() => {
    offBack = registerBackHandler(() => {
        if (viewerOpen.value) {
            viewerOpen.value = false;
            return true;
        }
        if (moreOpen.value) {
            closeMore();
            return true;
        }
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
    offUpdated = on<MessageRow>('message-updated', onUpdated);
    offSearch = on<string>('chat-search', id => {
        if (id === cid.value)
            openSearch();
    });
});
onUnmounted(() => {
    pageLeft = true;
    discardRecording();
    cancelPress();
    offBack?.();
    offMsg?.();
    offResume?.();
    offUpdated?.();
    offSearch?.();
});
onIonViewWillEnter(() => {
    pageLeft = false;
});
onIonViewDidEnter(() => {
    chats.openId = cid.value;
    markRead(cid.value);
    void clearDelivered();
});
onIonViewWillLeave(() => {
    pageLeft = true;
    discardRecording();
    if (chats.openId === cid.value)
        chats.openId = null;
});
watch(blocked, v => {
    if (v)
        discardRecording();
});
watch(chat, (c, old) => {
    if (old && !c)
        ionRouter.navigate('/tabs/chats?force=1', 'root', 'replace');
});
watch(() => route.params.id, v => {
    if (typeof v === 'string' && route.path.startsWith('/chat/') && v !== cid.value) {
        cid.value = v;
        void init();
    }
}, { immediate: true });
</script>

<style scoped>

.ttl {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.18);
  vertical-align: middle;
}

.menu-backdrop { position: fixed; inset: 0; z-index: 9998; background: transparent; }
.more-pop {
  position: fixed;
  z-index: 9999;
  min-width: 196px;
  padding: 6px;
  border-radius: 18px;
  display: flex;
  flex-direction: column;
}
.more-pop button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--md-on-surface);
  font-size: 15px;
  text-align: left;
}
.more-pop button:active { background: rgba(127, 127, 127, 0.16); }
.more-pop button ion-icon { font-size: 20px; color: var(--md-on-surface-variant); }
.more-pop button.danger, .more-pop button.danger ion-icon { color: #e5484d; }

.chat-head { background: transparent; box-shadow: none; }
.chat-head::after { display: none; }
.head-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: calc(8px + var(--ion-safe-area-top, 0px)) 12px 8px;
}
.circ {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,.18);
  color: var(--md-on-surface);
  display: grid;
  place-items: center;
  font-size: 21px;
  padding: 0;
}
.title-cap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 8px 0 8px;
  border-radius: 999px;
}
.title-cap .tt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.title-cap b { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.title-cap small { font-size: 11px; color: var(--md-on-surface-variant); }
.cap-btn {
  flex: none;
  width: 34px;
  height: 34px;
  border: 0;
  background: transparent;
  color: var(--md-on-surface-variant);
  font-size: 19px;
  display: grid;
  place-items: center;
}
.search-row { padding: calc(6px + var(--ion-safe-area-top, 0px)) 12px 6px; }
.glass-search { flex: 1; --background: transparent; --box-shadow: none; padding: 0; }


.chat-foot { background: transparent; box-shadow: none; padding: 0 10px calc(8px + var(--ion-safe-area-bottom, 0px)); }
.chat-foot::before { display: none; }
.composer {
  border-radius: 999px;
  padding: 4px 8px;
}

.quote-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  padding: 8px 12px;
  border-radius: 16px;
}
.q-line { width: 3px; align-self: stretch; border-radius: 3px; background: var(--md-primary); }
.q-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.q-text b { font-size: 12px; color: var(--md-primary); font-weight: 600; }
.q-text span { font-size: 12px; color: var(--md-on-surface-variant); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.q-x { border: 0; background: transparent; color: var(--md-on-surface-variant); font-size: 14px; padding: 2px 4px; }


.quote {
  display: flex;
  align-items: stretch;
  gap: 8px;
  margin: 0 0 6px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 12px;
  line-height: 1.35;
  opacity: 0.92;
}
.quote::before {
  content: '';
  flex: none;
  width: 3px;
  border-radius: 3px;
  background: currentColor;
  opacity: 0.5;
}
.quote span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }

ion-content { --background: var(--chat-bg); }
ion-content.plain { --background: var(--md-surface); }

.head { display: flex; align-items: center; gap: 12px; min-width: 0; }
.head .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }


.recalled {
  align-self: center;
  margin: 6px 12px;
  font-size: 12px;
  color: var(--md-on-surface-variant);
  background: rgba(127, 127, 127, 0.12);
  padding: 5px 10px;
  border-radius: 10px;
}


.reedit {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 12px 6px;
  padding: 8px 12px;
  border-radius: 14px;
  background: var(--md-surface-container-high);
  font-size: 13px;
  color: var(--md-on-surface-variant);
}
.reedit .rtext { flex: 1; }
.reedit .rdo {
  border: 0; background: transparent; color: var(--md-primary);
  font-size: 13px; font-weight: 500; padding: 4px 6px;
}
.reedit .rx {
  border: 0; background: transparent; color: var(--md-on-surface-variant);
  font-size: 14px; padding: 2px 4px;
}

.msgs { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px 18px; }
.msgs::before,
.msgs::after {
  content: '';
  position: sticky;
  flex: none;
  height: 16px;
  margin: 0 -14px;
  pointer-events: none;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 1;
}
.msgs::before { top: 0; margin-top: -12px; -webkit-mask-image: linear-gradient(to bottom, #000 20%, transparent); mask-image: linear-gradient(to bottom, #000 20%, transparent); }
.msgs::after { bottom: 0; margin-bottom: -14px; -webkit-mask-image: linear-gradient(to top, #000 20%, transparent); mask-image: linear-gradient(to top, #000 20%, transparent); }
.more { align-self: center; margin: 6px 0; }
.day {
  align-self: center; margin: 8px 0 4px; padding: 3px 12px; border-radius: 12px;
  background: var(--pill-bg); color: var(--pill-fg); font-size: 12px;
}
.msg { max-width: 84%; min-width: 0; display: flex; flex-direction: row; align-items: flex-end; gap: 8px; }
.msg.mine { justify-content: flex-end; }
.ava-slot { flex: none; width: 30px; display: flex; align-items: flex-end; }
.ava-slot :deep(.avatar) { border-radius: 50%; }
.msg .bubble { min-width: 0; }
.msg.cont { margin-top: 2px; }
.msg.cont .bubble { border-top-left-radius: 8px; }
.msg.mine.cont .bubble { border-top-left-radius: 18px; border-top-right-radius: 8px; }
.msg.mine { align-self: flex-end; align-items: flex-end; }


.bubble {
  background: linear-gradient(135deg, var(--in-bg), var(--in-bg2));
  color: var(--in-fg);
  padding: 8px 12px 6px;
  min-width: 64px;
  border-radius: 18px 18px 18px 4px;
  box-shadow: 0 0 0 1px var(--bubble-edge), 0 1px 2px rgba(0, 0, 0, 0.18);
  
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: pan-y;
}
.msg.mine .bubble { background: linear-gradient(135deg, var(--out-bg), var(--out-bg2)); color: var(--out-fg); border-radius: 18px 18px 4px 18px; }
.msg.flash .bubble { outline: 2px solid var(--md-primary); outline-offset: 2px; }
.who { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; opacity: 0.78; margin-bottom: 3px; letter-spacing: .01em; }
.body { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 15.5px; line-height: 1.45; }
.meta { font-size: 11px; line-height: 1.2; opacity: 0.62; margin-top: 3px; align-self: flex-start; letter-spacing: .01em; }
.msg.mine .meta { align-self: flex-end; }

.note { padding: 4px 16px; font-size: 12px; color: var(--md-error); }

.blocked {
  border-radius: 22px;
  padding: 12px 16px;
  font-size: 13px; line-height: 1.5; text-align: center;
  color: var(--md-on-surface-variant);
}
.composer { display: flex; align-items: flex-end; gap: 6px; padding: 6px 8px; }
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
  white-space: pre-wrap;        
  overflow-wrap: anywhere;
  overflow-y: hidden;
}
.ta::placeholder { color: var(--md-on-surface-variant); }
.cbtn {
  flex: none;
  align-self: flex-end;
  width: 44px;
  height: 48px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--md-on-surface-variant);
  display: grid;
  place-items: center;
  font-size: 21px;
}
.cbtn:disabled { opacity: .45; }
.cbtn.open ion-icon { transform: rotate(45deg); transition: transform .18s ease; }
.cbtn.rec { color: #e5484d; animation: pulse 1s infinite; }
.attach-drawer {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 0 2px 8px;
  padding: 12px 10px;
  border-radius: 20px;
}
.attach-item {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 10px 4px; border: 0; border-radius: 14px;
  background: var(--md-surface-container); color: var(--md-on-surface);
  font-size: 12px;
}
.attach-item:disabled { opacity: .45; }
.attach-ico { font-size: 22px; color: var(--md-on-surface-variant); display: grid; place-items: center; }
@keyframes pulse { 50% { opacity: .45; } }

.send { --padding-start: 0; --padding-end: 0; --border-radius: 16px; width: 48px; height: 48px; margin: 0; align-self: flex-end; opacity: .55; transition: opacity .18s ease, background-color .18s ease; }
.send.active { --background: var(--md-primary); --color: var(--md-on-primary); opacity: 1; }
</style>
