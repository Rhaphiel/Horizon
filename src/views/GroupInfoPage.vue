<template>
  <ion-page>
    <ion-header>
      <ion-toolbar class="ghost-bar">
        <ion-buttons slot="start">
          <ion-button fill="clear" @click="backToChat"><ion-icon :icon="arrowBack" /></ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button fill="clear" aria-label="更多" @click="moreMenu($event)"><ion-icon :icon="ellipsisVertical" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="gi">
      <template v-if="chat">
        
        <div class="hero">
          <button class="ava" type="button" :disabled="!isOwner || uploading" @click="pickAvatar">
            <Avatar :name="chat.name || '群聊'" :size="108" :src="chat.avatarUrl" />

          </button>
          <h1 v-if="!isOwner">{{ chat.name || '群聊' }}</h1>
          <button v-else class="name-btn" type="button" :disabled="renaming" @click="rename">
            <span>{{ chat.name || '群聊' }}</span><span class="pen">✎</span>
          </button>
          <p>{{ chat.members.length }} 位成员</p>
          <input ref="fileEl" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onAvatarPick" />
          <AvatarCropper :open="cropOpen" :src="cropSrc" @cancel="closeCrop" @done="onCropped" @failed="onCropFailed" />
        </div>

        
        <div class="acts">
          <button type="button" @click="backToChat">
            <ion-icon class="ico" :icon="chatbubbleEllipsesOutline" /><span>消息</span>
          </button>
          <button type="button" :disabled="muteBusy" @click="toggleMute">
            <ion-icon class="ico" :icon="muted ? notificationsOffOutline : notificationsOutline" /><span>{{ muted ? '已静音' : '静音' }}</span>
          </button>
          <button type="button" @click="searchChat">
            <ion-icon class="ico" :icon="searchOutline" /><span>查找记录</span>
          </button>
          <button type="button" class="danger" @click="leave">
            <ion-icon class="ico" :icon="exitOutline" /><span>退出</span>
          </button>
        </div>

        
        <div class="card">
          <button v-if="isOwner" class="add" type="button" @click="addOpen = true">
            <span class="plus">＋</span>
            <span>添加成员</span>
          </button>
          <div v-for="m in members" :key="m.user_id" class="mem">
            <Avatar :name="nameOf(m.user_id)" :src="avatarOf(m.user_id)" :size="42" />
            <div class="mi">
              <b>
              <span :style="nameStyle(titleOf(m.user_id))">{{ nameOf(m.user_id) }}</span><em v-if="m.user_id === me">（我）</em>
              <span v-if="titleOf(m.user_id)" class="ttl" :style="titleStyle(titleOf(m.user_id)!)">{{ titleOf(m.user_id)!.text }}</span>
            </b>
              <small>{{ m.role === 'owner' ? '群主' : '成员' }}</small>
            </div>
            <span v-if="m.role === 'owner'" class="owner">所有者</span>
            <button v-if="isOwner && m.user_id !== me" class="kick" type="button" @click="kick(m.user_id)">移出</button>
          </div>
        </div>

        
        <div class="seg">
          <button type="button" :class="{ on: tab === 'media' }" @click="tab = 'media'">媒体</button>
          <button type="button" :class="{ on: tab === 'links' }" @click="tab = 'links'">链接</button>
        </div>
        <template v-if="tab === 'media'">
          <div v-if="images.length" class="grid">
            <MediaThumb v-for="(m, i) in images" :key="m.id" :path="m.media_path" @open="openViewer(i)" />
          </div>
          <p v-else class="hint">{{ tabNote || '最近 24 小时没有图片。图片发出 24 小时后会自动清理，所以这里只显示最近一天的。' }}</p>
        </template>
        <template v-else>
          <div v-if="links.length" class="links">
            <button v-for="l in links" :key="l.key" type="button" class="link" @click="pickLink(l.url)">
              <span class="url">{{ l.url }}</span>
              <small>{{ nameOf(l.sender) }} · {{ fmtDateTime(l.at) }}</small>
            </button>
          </div>
          <p v-else class="hint">{{ tabNote || '在这个群里发过的链接会显示在这里（最近 100 条带链接的消息）。' }}</p>
        </template>
        <ImageViewer :open="viewerOpen" :paths="imagePaths" :index="viewerIndex" @close="viewerOpen = false" @change="viewerIndex = $event" />

        <div class="bottom">
          <button type="button" @click="clearChat">清空聊天记录</button>
          <button v-if="isOwner" type="button" class="danger-text" @click="dissolve">解散群聊</button>
        </div>
      </template>

      <PickFriendsModal
        :open="addOpen"
        title="添加成员"
        confirm-text="添加"
        :friends="candidates"
        :busy="busy"
        empty-text="没有可添加的好友（只能添加你的好友，且对方不在群里）"
        @close="addOpen = false"
        @submit="onAdd"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import { IonPage, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonContent, useIonRouter, actionSheetController, alertController, onIonViewWillEnter, } from '@ionic/vue';
import { arrowBack, chatbubbleEllipsesOutline, ellipsisVertical, exitOutline, notificationsOffOutline, notificationsOutline, searchOutline } from 'ionicons/icons';
import PickFriendsModal from '@/components/PickFriendsModal.vue';
import Avatar from '@/components/Avatar.vue';
import AvatarCropper from '@/components/AvatarCropper.vue';
import MediaThumb from '@/components/MediaThumb.vue';
import ImageViewer from '@/components/ImageViewer.vue';
import { emit } from '@/lib/bus';
import { copyText } from '@/lib/clipboard';
import { fmtDateTime } from '@/lib/format';
import type { MessageRow } from '@/types/database';
import { fetchGroupImages, fetchLinkMessages } from '@/services/messagesApi';
import { chatTitle, getChat, myRole, loadChats } from '@/stores/chats';
import { friendState } from '@/stores/friends';
import { nameOf, avatarOf } from '@/stores/directory';
import { ensureTitles, titleOf, titleStyle, nameStyle } from '@/stores/titles';
import { myId } from '@/stores/session';
import { confirmDialog, showToast } from '@/lib/toast';
import { uploadGroupAvatar, isStaticImage } from '@/services/avatarApi';
import { addMembers, clearConversation, dissolveGroup, leaveGroup, removeMember, renameGroup, setMuted } from '@/services/chatApi';
const route = useRoute();
const ionRouter = useIonRouter();
const cid = ref('');
const addOpen = ref(false);
const busy = ref(false);
const fileEl = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const cropOpen = ref(false);
const cropSrc = ref('');
const tab = ref<'media' | 'links'>('media');
const muteBusy = ref(false);
const renaming = ref(false);
const me = computed(() => myId());
const chat = computed(() => getChat(cid.value));
const isOwner = computed(() => (chat.value ? myRole(chat.value) === 'owner' : false));
const muted = computed(() => chat.value?.muted ?? false);
const members = computed(() => [...(chat.value?.members ?? [])].sort((a, b) => (a.role === b.role ? 0 : a.role === 'owner' ? -1 : 1)));
watch(members, list => { void ensureTitles(list.map(m => m.user_id)); }, { immediate: true });
const candidates = computed(() => friendState.friends.filter(f => !chat.value?.members.some(m => m.user_id === f.id)));
const toChats = (): void => ionRouter.navigate('/tabs/chats?force=1', 'root', 'replace');
const backToChat = (): void => ionRouter.back();
async function toggleMute(): Promise<void> {
    if (muteBusy.value || !cid.value)
        return;
    const on = !muted.value;
    muteBusy.value = true;
    const err = await setMuted(cid.value, on);
    muteBusy.value = false;
    void showToast(err || (on ? '已静音这个聊天' : '已恢复通知'));
}
function searchChat(): void {
    emit('chat-search', cid.value);
    backToChat();
}
async function rename(): Promise<void> {
    const c = chat.value;
    if (!c || !isOwner.value || renaming.value)
        return;
    const alert = await alertController.create({
        header: '修改群名',
        inputs: [{ name: 'name', type: 'text', value: c.name ?? '', placeholder: '1–30 个字', attributes: { maxlength: 60 } }],
        buttons: [
            { text: '取消', role: 'cancel' },
            { text: '保存', role: 'confirm' },
        ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{
        values?: {
            name?: string;
        };
    }>();
    if (role !== 'confirm')
        return;
    const name = (data?.values?.name ?? '').trim();
    if (!name || name === (c.name ?? ''))
        return;
    if (Array.from(name).length > 30) {
        void showToast('群名称需要 1–30 个字');
        return;
    }
    renaming.value = true;
    const err = await renameGroup(c.id, name);
    renaming.value = false;
    void showToast(err || '群名已修改');
}
type LinkItem = {
    key: string;
    url: string;
    sender: string;
    at: string;
};
const images = ref<MessageRow[]>([]);
const links = ref<LinkItem[]>([]);
const tabNote = ref('');
const viewerOpen = ref(false);
const viewerIndex = ref(0);
const imagePaths = computed(() => images.value.map(m => m.media_path as string));
let tabSeq = 0;
const URL_RE = /https?:\/\/[^\s<>"'，。！？、；：）】」』]+/gi;
function extractLinks(rows: MessageRow[]): LinkItem[] {
    const out: LinkItem[] = [];
    for (const m of rows) {
        const found = m.body.match(URL_RE) ?? [];
        found.forEach((raw, i) => {
            const url = raw.replace(/[.,!?;:)\]}]+$/, '');
            if (url.length > 10)
                out.push({ key: `${m.id}-${i}`, url, sender: m.sender_id, at: m.created_at });
        });
    }
    return out;
}
async function loadTab(): Promise<void> {
    const id = cid.value;
    if (!id)
        return;
    const seq = ++tabSeq;
    tabNote.value = '加载中…';
    if (tab.value === 'media') {
        const { data, error } = await fetchGroupImages(id);
        if (seq !== tabSeq)
            return;
        images.value = error ? [] : data;
        tabNote.value = error ? '加载失败：' + error.message : '';
    }
    else {
        const { data, error } = await fetchLinkMessages(id);
        if (seq !== tabSeq)
            return;
        links.value = error ? [] : extractLinks(data);
        tabNote.value = error ? '加载失败：' + error.message : '';
    }
}
function openViewer(i: number): void {
    viewerIndex.value = i;
    viewerOpen.value = true;
}
function openExternal(url: string): void {
    if (Capacitor.isNativePlatform())
        window.location.href = url;
    else
        window.open(url, '_blank', 'noopener');
}
async function pickLink(url: string): Promise<void> {
    const sheet = await actionSheetController.create({
        header: url.length > 80 ? url.slice(0, 80) + '…' : url,
        buttons: [
            { text: '在浏览器打开', handler: () => openExternal(url) },
            {
                text: '复制链接',
                handler: () => {
                    void copyText(url).then(ok => showToast(ok ? '已复制' : '复制失败'));
                },
            },
            { text: '取消', role: 'cancel' },
        ],
    });
    await sheet.present();
}
watch([cid, tab], () => void loadTab());
onIonViewWillEnter(() => void loadTab());
async function moreMenu(ev: Event): Promise<void> {
    const sheet = await actionSheetController.create({
        header: '更多操作',
        buttons: [
            ...(isOwner.value ? [{ text: '修改群名', handler: () => { void rename(); } }] : []),
            { text: '清空聊天记录', handler: () => { void clearChat(); } },
            ...(isOwner.value ? [{ text: '解散群聊', role: 'destructive' as const, handler: () => { void dissolve(); } }] : []),
            { text: '取消', role: 'cancel' },
        ],
    });
    await sheet.present();
    void ev;
}
function pickAvatar(): void {
    if (!isOwner.value)
        return;
    fileEl.value?.click();
}
function closeCrop(): void {
    cropOpen.value = false;
    if (cropSrc.value)
        URL.revokeObjectURL(cropSrc.value);
    cropSrc.value = '';
}
function onAvatarPick(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !cid.value)
        return;
    if (!isStaticImage(file)) {
        void showToast('只能选 JPG / PNG / WebP 静态图片（不支持视频和 GIF）');
        return;
    }
    cropSrc.value = URL.createObjectURL(file);
    cropOpen.value = true;
}
function onCropFailed(): void {
    closeCrop();
    void showToast('这张图片格式不支持，请换一张 JPG / PNG');
}
async function onCropped(blob: Blob): Promise<void> {
    uploading.value = true;
    try {
        const url = await uploadGroupAvatar(cid.value, blob);
        if (url) {
            await loadChats();
            void showToast('群头像已更新');
        }
        else {
            void showToast('上传失败，请检查网络或存储权限');
        }
    }
    catch (err) {
        void showToast(err instanceof Error ? err.message : '上传失败');
    }
    finally {
        uploading.value = false;
        closeCrop();
    }
}
async function onAdd(p: {
    ids: string[];
    name: string;
}): Promise<void> {
    if (busy.value)
        return;
    busy.value = true;
    const err = await addMembers(cid.value, p.ids);
    busy.value = false;
    if (err) {
        void showToast(err);
        return;
    }
    addOpen.value = false;
    void showToast('已添加成员');
}
async function kick(userId: string): Promise<void> {
    const name = nameOf(userId);
    if (!(await confirmDialog('移出成员', `确定把“${name}”移出群聊吗？`, '移出')))
        return;
    const err = await removeMember(cid.value, userId);
    void showToast(err || `已移出“${name}”`);
}
async function clearChat(): Promise<void> {
    if (!(await confirmDialog('清空聊天记录', '只会清空你这边的记录，群里其他人不受影响。确定清空吗？', '清空')))
        return;
    const err = await clearConversation(cid.value);
    void showToast(err || '已清空聊天记录');
}
async function leave(): Promise<void> {
    const c = chat.value;
    if (!c)
        return;
    const tip = isOwner.value
        ? '你是群主。退出后，群主会自动转给最早加入的成员；如果群里没有其他人，群聊会被解散。确定退出吗？'
        : '退出后将不再收到这个群的消息。确定退出吗？';
    if (!(await confirmDialog('退出群聊', tip, '退出')))
        return;
    const title = chatTitle(c);
    const err = await leaveGroup(cid.value);
    if (err) {
        void showToast(err);
        return;
    }
    void showToast(`已退出群聊“${title}”`);
}
async function dissolve(): Promise<void> {
    const c = chat.value;
    if (!c)
        return;
    if (!(await confirmDialog('解散群聊', '解散后，所有成员的聊天记录都会被删除，无法恢复。确定解散吗？', '解散')))
        return;
    const title = chatTitle(c);
    const err = await dissolveGroup(cid.value);
    if (err) {
        void showToast(err);
        return;
    }
    void showToast(`群聊“${title}”已解散`);
}
watch(chat, (c, old) => {
    if (old && !c)
        toChats();
});
watch(() => route.params.id, v => {
    if (typeof v === 'string' && route.path.endsWith('/info'))
        cid.value = v;
}, { immediate: true });
</script>

<style scoped>
.ghost-bar { --background: transparent; --border-width: 0; }
.ghost-bar ion-button { --color: var(--md-on-surface); }

.gi { --background: var(--md-surface); }


.hero { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 28px 20px 18px; }
.hero h1 { margin: 10px 0 0; font-size: 24px; font-weight: 700; letter-spacing: 0.01em; }
.hero p { margin: 0; font-size: 13px; color: var(--md-on-surface-variant); }
.ava-tip { font-size: 12px; color: var(--md-on-surface-variant); }
.ava { position: relative; padding: 0; border: 0; background: transparent; }
.ava-edit {
  position: absolute; right: -2px; bottom: -2px;
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--md-primary); color: #fff;
  font-size: 12px; line-height: 28px; text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,.25);
}


.acts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 4px 16px 18px; }
.acts button {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 14px 6px; border: 0; border-radius: 16px;
  background: var(--md-surface-container); color: var(--md-on-surface);
  font-size: 12px;
}
.acts .ico { font-size: 20px; }
.acts button.danger { color: #ff6b6b; }
.acts button:disabled { opacity: .45; }


.card {
  margin: 0 16px 18px; border-radius: 18px; overflow: hidden;
  background: var(--md-surface-container);
}
.add {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 16px; border: 0; background: transparent;
  color: var(--md-on-surface); font-size: 15px; text-align: left;
}
.add .plus { font-size: 20px; color: var(--md-on-surface-variant); }
.mem { display: flex; align-items: center; gap: 12px; padding: 12px 16px; }
.mem + .mem, .add + .mem { border-top: 1px solid rgba(255,255,255,.06); }
.mi { flex: 1; min-width: 0; }
.mi b { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mi b em { font-style: normal; color: var(--md-on-surface-variant); font-weight: 400; }
.mi small { font-size: 12px; color: var(--md-on-surface-variant); }
.owner {
  font-size: 11px; padding: 3px 8px; border-radius: 10px;
  background: rgba(167,139,250,.18); color: #c4b5fd;
}
.kick { border: 0; background: transparent; color: #ff6b6b; font-size: 12px; }


.seg {
  display: inline-flex; gap: 4px; margin: 0 16px;
  padding: 4px; border-radius: 999px; background: var(--md-surface-container);
}
.seg button {
  border: 0; background: transparent; color: var(--md-on-surface-variant);
  font-size: 13px; padding: 8px 22px; border-radius: 999px;
}
.seg button.on { background: rgba(167,139,250,.22); color: #c4b5fd; }
.hint { margin: 18px 20px; font-size: 13px; line-height: 1.6; color: var(--md-on-surface-variant); text-align: center; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 14px 16px 18px; }
.links {
  margin: 14px 16px 18px; border-radius: 18px; overflow: hidden;
  background: var(--md-surface-container);
}
.link {
  display: flex; flex-direction: column; gap: 4px; width: 100%;
  padding: 12px 16px; border: 0; background: transparent; text-align: left;
}
.link + .link { border-top: 1px solid rgba(255,255,255,.06); }
.link .url { font-size: 14px; color: var(--md-primary); overflow-wrap: anywhere; }
.link small { font-size: 12px; color: var(--md-on-surface-variant); }


.hero h1 { max-width: 100%; text-align: center; overflow-wrap: anywhere; }
.name-btn {
  display: inline-flex; align-items: center; gap: 6px; margin: 10px 0 0; padding: 0;
  max-width: 100%; text-align: center; overflow-wrap: anywhere;
  border: 0; background: transparent; color: var(--md-on-surface);
  font-size: 24px; font-weight: 700; letter-spacing: 0.01em;
}
.name-btn .pen { font-size: 15px; color: var(--md-on-surface-variant); }

.bottom { display: flex; flex-direction: column; gap: 10px; padding: 8px 16px 28px; }
.bottom button {
  padding: 14px; border: 1px solid var(--md-outline); border-radius: 14px;
  background: transparent; color: var(--md-on-surface); font-size: 14px;
}
.bottom .danger-text { color: #ff6b6b; border-color: rgba(255,107,107,.4); }
.ttl { margin-left: 6px; padding: 1px 6px; border-radius: 8px; font-size: 11px; font-weight: 600; background: rgba(127,127,127,.16); }
</style>
