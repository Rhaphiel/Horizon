<template>
  <ion-page>
    <ion-header>
      <ion-toolbar v-if="!searchMode">
        <ion-title>聊天</ion-title>
        <ion-buttons slot="end">
          <ion-button aria-label="更多" @click="openPlus">
            <ion-icon slot="icon-only" :icon="add" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar v-else class="search-bar">
        <div class="search-row">
          <button class="icon-btn" type="button" aria-label="返回" @click="exitSearch">
            <ion-icon :icon="arrowBack" />
          </button>
          <ion-searchbar
            v-model="kw"
            class="pill"
            placeholder="消息"
            :debounce="0"
            @ionInput="onInput"
            @ionClear="clearKw"
          />
          <button class="cancel" type="button" @click="exitSearch">取消</button>
        </div>
      </ion-toolbar>
      <ion-toolbar v-if="!searchMode" class="search-bar">
        <div class="search-row">
          <ion-searchbar
            class="pill"
            placeholder="搜索聊天"
            :debounce="0"
            :readonly="true"
            @ionFocus="enterSearch"
            @click="enterSearch"
          />
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content />
      </ion-refresher>

      
      <template v-if="searchMode && !detailCid">
        <div class="section-title">聊天记录</div>
        <ion-list>
          <ion-item v-for="g in groups" :key="g.cid" button :detail="false" class="row" @click="openDetail(g.cid)">
            <Avatar slot="start" :name="g.title" :size="52" :src="g.avatar" />
            <ion-label>
              <h2>{{ g.title }}</h2>
              <p>{{ g.count }} 条相关聊天记录</p>
            </ion-label>
            <ion-icon slot="end" :icon="chevronForward" class="chev" />
          </ion-item>
          <ion-item v-if="hits && !hits.length" lines="none">
            <ion-label color="medium">没有找到相关消息</ion-label>
          </ion-item>
          <ion-item v-if="hits && hits.length >= 50" lines="none">
            <ion-label color="medium">只显示最近 50 条，可以换更具体的关键词</ion-label>
          </ion-item>
        </ion-list>
      </template>

      
      <template v-else-if="searchMode && detailCid">
        <div class="detail-head">
          <Avatar :name="detailChat ? chatTitle(detailChat) : '聊天'" :size="44" :src="detailChat ? chatAvatar(detailChat) : null" />
          <span>{{ detailChat ? chatTitle(detailChat) : '聊天' }}</span>
          <ion-icon :icon="chevronForward" class="chev" />
        </div>
        <div class="section-title small">相关聊天记录</div>
        <ion-list>
          <ion-item v-for="h in detailHits" :key="h.id" button :detail="false" class="hit" @click="openHit(h)">
            <Avatar slot="start" :name="h.sender_id === myId() ? '我' : nameOf(h.sender_id)" :size="40" :src="avatarOf(h.sender_id)" />
            <ion-label class="ion-text-wrap">
              <div class="hit-top">
                <b>{{ h.sender_id === myId() ? '我' : nameOf(h.sender_id) }}</b>
                <span>{{ fmtDateTime(h.created_at) }}</span>
              </div>
              <p class="hit-body">
                <span v-for="(p, i) in parts(h.body)" :key="i" :class="{ 'hit-mark': p.hit }">{{ p.text }}</span>
              </p>
            </ion-label>
          </ion-item>
        </ion-list>
      </template>

      
      <ion-list v-if="!searchMode && sortedChats.length">
        <ion-item v-for="c in sortedChats" :key="c.id" button :detail="false" lines="none" class="row" @click="openChat(c.id)">
          <Avatar slot="start" :name="chatTitle(c)" :size="56" :src="chatAvatar(c)" />
          <ion-label>
            <h2>
              <span :style="nameStyle(titleOf(peerId(c)))">{{ chatTitle(c) }}</span>
              <span
                v-if="titleOf(peerId(c))"
                class="ttl"
                :style="titleStyle(titleOf(peerId(c))!)"
              >{{ titleOf(peerId(c))!.text }}</span>
            </h2>
            <p>{{ preview(c) }}</p>
          </ion-label>
          <div slot="end" class="end">
            <span v-if="c.lastAt" :class="['time', { hot: c.unread > 0 && !c.muted }]">{{ fmtListTime(c.lastAt) }}</span>
            <span class="badges">
              <ion-icon v-if="c.muted" :icon="notificationsOffOutline" class="muted-ico" aria-label="已静音" />
              <span v-if="c.unread > 0" :class="['unread', { quiet: c.muted }]">{{ c.unread > 99 ? '99+' : c.unread }}</span>
            </span>
          </div>
        </ion-item>
      </ion-list>
      <div v-else-if="chats.loaded" class="empty-tip">还没有聊天。点右上角 + 新建群聊，或在“好友”里点「发消息」开聊。</div>

      <Teleport to="body">
      <div v-if="plusOpen" class="menu-backdrop" @click="plusOpen = false" />
      <div v-if="plusOpen" class="plus-pop glass" :style="plusPos">
        <button type="button" @click="menuCreateGroup">
          <ion-icon :icon="chatbubbleEllipsesOutline" /><span>创建群聊</span>
        </button>
        <button type="button" @click="menuAddFriend">
          <ion-icon :icon="personAddOutline" /><span>加好友/群</span>
        </button>
        <button v-if="isOwner" type="button" @click="menuGrantTitle">
          <ion-icon :icon="ribbonOutline" /><span>为用户添加称号</span>
        </button>
      </div>
      </Teleport>

      
      <div v-if="grantOpen" class="grant-mask" @click.self="closeGrant">
        <div class="grant-card">
          <h3>{{ editingId ? '修改称号' : '称号管理' }}</h3>

          <label>用户 HorizonID
            <div class="id-row">
              <input v-model="grantId" inputmode="numeric" />
              <button type="button" class="mini" @click="loadTargetTitles">查询</button>
            </div>
          </label>

          
          <div v-if="targetName" class="titles-list">
            <div class="tl-head">给「{{ targetName }}」的称号</div>
            <p v-if="!targetTitles.length" class="tl-empty">还没有称号</p>
            <div v-for="t in targetTitles" :key="t.id" class="tl-row">
              <span class="chip" :style="titleStyle(t)">{{ t.text }}</span>
              <button type="button" class="mini" @click="editTitle(t)">修改</button>
              <button type="button" class="mini danger" @click="removeTitle(t)">删除</button>
            </div>
          </div>

          <label>{{ editingId ? '改成（10 字以内）' : '新称号（10 字以内）' }}
            <input v-model="grantText" maxlength="10" />
          </label>
          <label class="row-check">
            <input v-model="titleGrad" type="checkbox" /> 称号渐变
          </label>
          <div v-if="titleGrad" class="colors">
            <input v-model="titleFrom" type="color" />
            <input v-model="titleTo" type="color" />
          </div>

          <label class="row-check">
            <input v-model="nameGrad" type="checkbox" /> 用户名渐变
          </label>
          <div v-if="nameGrad" class="colors">
            <input v-model="nameFrom" type="color" />
            <input v-model="nameTo" type="color" />
          </div>

          
          <div v-if="previewOn" class="preview">
            <span class="pv-label">预览</span>
            <div class="pv-row">
              <Avatar :name="targetName || '用户名'" :size="34" :src="targetAvatar" />
              <span class="pv-name" :style="previewNameStyle">{{ targetName || '用户名' }}</span>
              <span v-if="grantText.trim()" class="chip" :style="previewChipStyle">{{ grantText.trim() }}</span>
            </div>
          </div>

          <div class="grant-actions">
            <button v-if="editingId" type="button" @click="cancelEdit">取消修改</button>
            <button type="button" class="mini" @click="previewOn = !previewOn">{{ previewOn ? '隐藏预览' : '预览' }}</button>
            <button type="button" @click="closeGrant">{{ editingId ? '关闭' : '取消' }}</button>
            <button type="button" class="primary" :disabled="grantBusy" @click="doGrant">
              {{ editingId ? '保存修改' : '授予' }}
            </button>
          </div>
        </div>
      </div>

      <PickFriendsModal
        :open="groupOpen"
        title="新建群聊"
        confirm-text="创建"
        :friends="friendState.friends"
        :ask-name="true"
        :busy="creating"
        empty-text="你还没有好友，先去“好友”里添加"
        @close="groupOpen = false"
        @submit="onCreateGroup"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButton, IonButtons, IonSearchbar, IonContent, IonRefresher, IonRefresherContent, IonList, IonItem, IonLabel, IonIcon } from '@ionic/vue';
import { add, arrowBack, chatbubbleEllipsesOutline, chevronForward, notificationsOffOutline, personAddOutline, ribbonOutline } from 'ionicons/icons';
import Avatar from '@/components/Avatar.vue';
import PickFriendsModal from '@/components/PickFriendsModal.vue';
import { chats, sortedChats, chatTitle, getChat, loadChats } from '@/stores/chats';
import type { Chat } from '@/stores/chats';
import { friendState, loadFriends } from '@/stores/friends';
import { nameOf, avatarOf } from '@/stores/directory';
import { myId } from '@/stores/session';
import { db } from '@/lib/supabase';
import { ensureTitles, titleOf, titleStyle, nameStyle, loadMyTitles } from '@/stores/titles';
import type { OwnedTitle } from '@/stores/titles';
import { confirmDialog } from '@/lib/toast';
import { fmtDateTime, fmtTime, fmtDay, highlightParts, makeSnippet, oneLine } from '@/lib/format';
import { showToast } from '@/lib/toast';
import { searchMessages } from '@/services/messagesApi';
import { createGroup } from '@/services/chatApi';
import { openChat as goChat } from '@/services/navigation';
import type { MessageRow } from '@/types/database';
const router = useRouter();
onMounted(() => {
    void loadOwner();
});
const kw = ref('');
const lastKw = ref('');
const hits = ref<MessageRow[] | null>(null);
const groupOpen = ref(false);
const plusOpen = ref(false);
const isOwner = ref(false);
const grantOpen = ref(false);
const grantId = ref('');
const grantText = ref('');
const titleGrad = ref(false);
const titleFrom = ref('#ff6b6b');
const titleTo = ref('#f7b267');
const nameGrad = ref(false);
const nameFrom = ref('#6ea8fe');
const nameTo = ref('#c084fc');
const grantBusy = ref(false);
const editingId = ref<string | null>(null);
const targetUserId = ref<string | null>(null);
const targetName = ref('');
const targetTitles = ref<OwnedTitle[]>([]);
const targetAvatar = ref<string | null>(null);
const previewOn = ref(false);
const previewChipStyle = computed(() => titleStyle({
    text: grantText.value.trim() || '称号',
    titleGradient: titleGrad.value,
    titleFrom: titleFrom.value,
    titleTo: titleTo.value,
    nameGradient: false,
    nameFrom: null,
    nameTo: null,
}));
const previewNameStyle = computed(() => (nameGrad.value
    ? {
        backgroundImage: 'linear-gradient(90deg, ' + nameFrom.value + ', ' + nameTo.value + ')',
        webkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
    }
    : {}));
async function loadTargetTitles(): Promise<void> {
    const hid = Number(grantId.value.trim());
    if (!hid) {
        void showToast('先填一个 HorizonID');
        return;
    }
    const { data, error } = await db.from('profiles').select('id,username,avatar_url').eq('horizon_id', hid).maybeSingle();
    if (error) {
        void showToast('查询失败：' + error.message);
        return;
    }
    if (!data) {
        targetUserId.value = null;
        targetName.value = '';
        targetTitles.value = [];
        void showToast('没有这个 HorizonID');
        return;
    }
    targetUserId.value = data.id as string;
    targetName.value = data.username as string;
    targetAvatar.value = (data.avatar_url as string | null) ?? null;
    targetTitles.value = await loadMyTitles(data.id as string);
}
function editTitle(t: OwnedTitle): void {
    editingId.value = t.id;
    grantText.value = t.text;
    titleGrad.value = t.titleGradient;
    nameGrad.value = t.nameGradient;
    if (t.titleFrom)
        titleFrom.value = t.titleFrom;
    if (t.titleTo)
        titleTo.value = t.titleTo;
    if (t.nameFrom)
        nameFrom.value = t.nameFrom;
    if (t.nameTo)
        nameTo.value = t.nameTo;
}
function cancelEdit(): void {
    editingId.value = null;
    grantText.value = '';
    titleGrad.value = false;
    nameGrad.value = false;
}
function closeGrant(): void {
    grantOpen.value = false;
    cancelEdit();
    targetUserId.value = null;
    targetName.value = '';
    targetTitles.value = [];
}
async function removeTitle(t: OwnedTitle): Promise<void> {
    if (!(await confirmDialog('删除称号', '确定删除称号「' + t.text + '」吗？', '删除')))
        return;
    const { error } = await db.from('user_titles').delete().eq('id', t.id);
    if (error) {
        void showToast('删除失败：' + error.message);
        return;
    }
    void showToast('已删除');
    if (grantId.value.trim())
        await loadTargetTitles();
}
async function loadOwner(): Promise<void> {
    const uid = myId();
    if (!uid)
        return;
    const { data, error } = await db.from('profiles').select('horizon_id').eq('id', uid).maybeSingle();
    if (error)
        console.warn('[owner] ' + error.message);
    isOwner.value = Number(data?.horizon_id) === 100001;
}
function menuGrantTitle(): void {
    plusOpen.value = false;
    grantOpen.value = true;
}
async function doGrant(): Promise<void> {
    if (editingId.value) {
        const id = editingId.value;
        const text = grantText.value.trim();
        if (!text) {
            void showToast('称号不能为空');
            return;
        }
        grantBusy.value = true;
        const { error } = await db.from('user_titles').update({
            title: text,
            title_gradient: titleGrad.value,
            title_from: titleGrad.value ? titleFrom.value : null,
            title_to: titleGrad.value ? titleTo.value : null,
            name_gradient: nameGrad.value,
            name_from: nameGrad.value ? nameFrom.value : null,
            name_to: nameGrad.value ? nameTo.value : null,
        }).eq('id', id);
        grantBusy.value = false;
        if (error) {
            void showToast('保存失败：' + error.message);
            return;
        }
        void showToast('已修改');
        cancelEdit();
        if (grantId.value.trim())
            await loadTargetTitles();
        return;
    }
    const hid = Number(grantId.value.trim());
    const text = grantText.value.trim();
    if (!hid || !text) {
        void showToast('请填写 ID 和称号');
        return;
    }
    if (Array.from(text).length > 10) {
        void showToast('称号最多 10 个字');
        return;
    }
    grantBusy.value = true;
    const { error } = await db.rpc('grant_title', {
        target_horizon_id: hid,
        new_title: text,
        title_grad: titleGrad.value,
        title_from_hex: titleGrad.value ? titleFrom.value : null,
        title_to_hex: titleGrad.value ? titleTo.value : null,
        name_grad: nameGrad.value,
        name_from_hex: nameGrad.value ? nameFrom.value : null,
        name_to_hex: nameGrad.value ? nameTo.value : null,
    });
    grantBusy.value = false;
    if (error) {
        const msg = error.message.includes('user_not_found') ? '没有这个 HorizonID' : error.message;
        void showToast('授予失败：' + msg);
        return;
    }
    grantOpen.value = false;
    grantId.value = '';
    grantText.value = '';
    void showToast('称号已授予，TA 在「我的 → 外观」里可以选择显示');
}
const plusPos = ref<Record<string, string>>({});
function openPlus(ev: Event): void {
    const el = ev.currentTarget as HTMLElement | null;
    const r = el?.getBoundingClientRect();
    if (r)
        plusPos.value = { top: `${r.bottom + 8}px`, right: `${Math.max(12, window.innerWidth - r.right)}px` };
    plusOpen.value = true;
}
function menuCreateGroup(): void { plusOpen.value = false; groupOpen.value = true; }
function menuAddFriend(): void { plusOpen.value = false; void router.push('/tabs/friends'); }
const creating = ref(false);
function openChat(id: string): void {
    goChat(id);
}
function chatAvatar(c: Chat): string | null {
    if (c.type === 'group')
        return c.avatarUrl;
    const other = c.members.find(m => m.user_id !== myId());
    return avatarOf(other?.user_id);
}
function peerId(c: Chat): string | null {
    if (c.type === 'group')
        return null;
    return c.members.find(m => m.user_id !== myId())?.user_id ?? null;
}
async function refreshTitles(): Promise<void> {
    void loadOwner();
    const ids = sortedChats.value.map(peerId).filter((x): x is string => !!x);
    await ensureTitles(ids);
}
function preview(c: Chat): string {
    if (!c.lastBody)
        return c.type === 'group' ? `群聊 · ${c.members.length} 人` : '私聊';
    const text = oneLine(c.lastBody);
    return c.type === 'group' && c.lastSender ? `${nameOf(c.lastSender)}: ${text}` : text;
}
function fmtListTime(iso: string): string {
    return fmtDay(iso) === fmtDay(new Date().toISOString()) ? fmtTime(iso) : fmtDay(iso);
}
async function onRefresh(ev: CustomEvent): Promise<void> {
    await Promise.all([loadChats(), loadFriends()]);
    await refreshTitles();
    (ev.target as unknown as {
        complete: () => void;
    }).complete();
}
const searchMode = ref(false);
const detailCid = ref<string | null>(null);
function enterSearch(): void {
    searchMode.value = true;
}
function exitSearch(): void {
    clearKw();
    searchMode.value = false;
}
let searchSeq = 0;
let searchTimer = 0;
const SEARCH_DELAY = 250;
function clearKw(): void {
    searchSeq += 1;
    window.clearTimeout(searchTimer);
    kw.value = '';
    lastKw.value = '';
    hits.value = null;
    detailCid.value = null;
}
function onInput(ev: CustomEvent): void {
    const v = (ev.detail as {
        value?: string;
    } | null)?.value ?? kw.value;
    kw.value = v;
    const q = v.trim();
    if (!q) {
        clearKw();
        return;
    }
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
        void runSearch(q);
    }, SEARCH_DELAY);
}
async function runSearch(q: string): Promise<void> {
    const seq = ++searchSeq;
    const { data, error } = await searchMessages(q);
    if (seq !== searchSeq)
        return;
    if (error) {
        void showToast('搜索失败：' + error.message);
        return;
    }
    lastKw.value = q;
    hits.value = data;
}
const groups = computed(() => {
    const map = new Map<string, {
        cid: string;
        title: string;
        avatar: string | null;
        count: number;
    }>();
    for (const h of hits.value ?? []) {
        const g = map.get(h.conversation_id);
        if (g) {
            g.count += 1;
            continue;
        }
        const c = getChat(h.conversation_id);
        map.set(h.conversation_id, {
            cid: h.conversation_id,
            title: c ? chatTitle(c) : '聊天',
            avatar: c ? chatAvatar(c) : null,
            count: 1,
        });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
});
const detailChat = computed(() => (detailCid.value ? getChat(detailCid.value) : null));
const detailHits = computed(() => (hits.value ?? []).filter(h => h.conversation_id === detailCid.value));
function openDetail(cid: string): void {
    detailCid.value = cid;
}
const parts = (body: string) => highlightParts(makeSnippet(body, lastKw.value), lastKw.value);
function openHit(h: MessageRow): void {
    goChat(h.conversation_id, { msg: h.id, at: h.created_at });
}
async function onCreateGroup(p: {
    ids: string[];
    name: string;
}): Promise<void> {
    if (creating.value)
        return;
    creating.value = true;
    const r = await createGroup(p.name, p.ids);
    creating.value = false;
    if (r.error || !r.id) {
        void showToast(r.error || '创建失败');
        return;
    }
    groupOpen.value = false;
    void showToast('群聊已创建');
    goChat(r.id);
}
</script>

<style scoped>

.ttl {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(127, 127, 127, 0.18);
  vertical-align: middle;
}


.grant-mask {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(0,0,0,.4);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  display: grid; place-items: center; padding: 20px;
}
.grant-card {
  width: min(92vw, 360px);
  border-radius: 22px;
  padding: 18px;
  background: var(--md-surface-container-high);
  color: var(--md-on-surface);
  display: flex; flex-direction: column; gap: 12px;
}
.grant-card h3 { margin: 0 0 4px; font-size: 17px; }
.grant-card label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--md-on-surface-variant); }
.grant-card input[type=text], .grant-card input:not([type]) {
  padding: 10px 12px; border-radius: 12px; border: 1px solid var(--md-outline);
  background: transparent; color: var(--md-on-surface); font-size: 15px;
}
.grant-card .row-check { flex-direction: row; align-items: center; gap: 8px; }
.grant-card .colors { display: flex; gap: 10px; }
.grant-card .colors input { width: 56px; height: 36px; border: 0; background: transparent; }
.grant-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.grant-actions button { border: 0; border-radius: 12px; padding: 10px 16px; background: transparent; color: var(--md-on-surface-variant); font-size: 14px; }
.grant-actions .primary { background: var(--md-primary); color: var(--md-on-primary); }

.menu-backdrop { position: fixed; inset: 0; z-index: 9998; background: transparent; }
.plus-pop {
  position: fixed;
  z-index: 9999;
  min-width: 190px;
  padding: 6px;
  border-radius: 18px;
  display: flex;
  flex-direction: column;
}
.plus-pop button {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; border: 0; border-radius: 12px;
  background: transparent; color: var(--md-on-surface); font-size: 15px; text-align: left;
}
.plus-pop button:active { background: rgba(127,127,127,.16); }
.plus-pop button ion-icon { font-size: 20px; color: var(--md-on-surface-variant); }

ion-header { box-shadow: none; }
ion-toolbar { --background: var(--md-surface); --border-width: 0; }
.search-bar { --background: transparent; --border-width: 0; padding-bottom: 2px; }
.search-row { display: flex; align-items: center; gap: 6px; padding: 4px 8px 6px 4px; }
.search-row .icon-btn {
  border: 0; background: transparent; color: var(--md-on-surface);
  font-size: 22px; padding: 4px 6px; display: grid; place-items: center;
}
.search-row .cancel {
  border: 0; background: transparent; color: var(--md-primary);
  font-size: 15px; padding: 4px 6px; white-space: nowrap;
}
.search-row ion-searchbar.pill { flex: 1; padding: 0; }


.section-title { display: flex; align-items: center; justify-content: space-between; }
.section-title.small { justify-content: flex-start; padding-top: 10px; }
.chev { color: var(--md-on-surface-variant); font-size: 18px; }


.detail-head {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; font-size: 17px; font-weight: 500;
}
.detail-head span { flex: 1; }


.hit { --padding-start: 16px; --padding-end: 16px; --background: transparent; }
.hit :deep(.avatar) { margin-right: 12px; }
.hit-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.hit-top b { font-size: 14px; font-weight: 500; }
.hit-top span { font-size: 12px; color: var(--md-on-surface-variant); }
.hit-body { font-size: 14px; line-height: 1.5; margin: 0; }
.hit-mark { color: var(--md-primary); font-weight: 600; }

ion-searchbar.pill {
  --background: var(--md-surface-container);
  --border-radius: 999px;
  --box-shadow: none;
  --height: 46px;
  --icon-color: var(--md-on-surface-variant);
  --placeholder-color: var(--md-on-surface-variant);
  --clear-button-color: var(--md-on-surface-variant);
  --cancel-button-color: var(--md-primary);
  padding: 0 12px 8px;
}


.section-title { display: flex; align-items: center; gap: 6px; }
.section-title ion-button {
  height: 26px;
  margin: 0;
  font-size: 13px;
  --padding-start: 6px;
  --padding-end: 6px;
}

.row { --padding-start: 16px; --padding-end: 16px; --min-height: 76px; --background: transparent; }
.row h2 { display: flex; align-items: center; gap: 6px; font-size: 17px; font-weight: 500; margin: 0 0 2px; }
.row p { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; }
.row :deep(.avatar) { margin-right: 14px; }
.end { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; align-self: flex-start; padding-top: 14px; }
.time { font-size: 12px; color: var(--md-on-surface-variant); }
.time.hot { color: var(--md-primary); }
.unread {
  min-width: 24px; height: 24px; padding: 0 8px; box-sizing: border-box;
  border-radius: 12px; background: var(--md-primary); color: var(--md-on-primary);
  font-size: 13px; font-weight: 500; line-height: 24px; text-align: center;
}
.id-row { display: flex; gap: 8px; align-items: center; }
.id-row input { flex: 1; }
.mini {
  border: 0; border-radius: 10px; padding: 8px 12px;
  background: rgba(127,127,127,.16); color: var(--md-on-surface); font-size: 13px;
}
.mini.danger { color: #e5484d; }
.titles-list { display: flex; flex-direction: column; gap: 6px; padding: 4px 0; }
.tl-head { font-size: 12px; color: var(--md-on-surface-variant); }
.tl-empty { margin: 0; font-size: 12px; color: var(--md-on-surface-variant); }
.tl-row { display: flex; align-items: center; gap: 8px; }
.tl-row .chip { flex: 1; padding: 3px 8px; border-radius: 8px; background: rgba(127,127,127,.16); font-weight: 600; font-size: 13px; }
.preview { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 14px; background: rgba(127,127,127,.12); }
.pv-label { font-size: 11px; color: var(--md-on-surface-variant); }
.pv-row { display: flex; align-items: center; gap: 10px; }
.pv-name { font-size: 15px; font-weight: 500; }
.row .ttl { margin-left: 0; line-height: 1; }

.badges { display: flex; align-items: center; gap: 6px; min-height: 24px; }
.unread.quiet { background: var(--md-surface-container-highest, rgba(127,127,127,.25)); color: var(--md-on-surface-variant); }
.muted-ico { font-size: 16px; color: var(--md-on-surface-variant); }
</style>
