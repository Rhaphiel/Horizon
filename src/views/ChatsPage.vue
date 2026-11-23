<template>
  <ion-page>
    <ion-header>
      <ion-toolbar v-if="!searchMode">
        <ion-title>聊天</ion-title>
        <ion-buttons slot="end">
          <ion-button aria-label="新建群聊" @click="groupOpen = true">
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

      <!-- 搜索结果：按会话分组（点进某个会话看具体消息） -->
      <template v-if="searchMode && !detailCid">
        <div class="section-title">
          聊天记录
          <span class="more">更多 ›</span>
        </div>
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

      <!-- 某个会话里的命中消息 -->
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

      <!-- 聊天列表 -->
      <ion-list v-if="!searchMode && sortedChats.length">
        <ion-item v-for="c in sortedChats" :key="c.id" button :detail="false" lines="none" class="row" @click="openChat(c.id)">
          <Avatar slot="start" :name="chatTitle(c)" :size="56" :src="chatAvatar(c)" />
          <ion-label>
            <h2>{{ chatTitle(c) }}</h2>
            <p>{{ preview(c) }}</p>
          </ion-label>
          <div slot="end" class="end">
            <span v-if="c.lastAt" :class="['time', { hot: c.unread > 0 }]">{{ fmtListTime(c.lastAt) }}</span>
            <span v-if="c.unread > 0" class="unread">{{ c.unread > 99 ? '99+' : c.unread }}</span>
          </div>
        </ion-item>
      </ion-list>
      <div v-else-if="chats.loaded" class="empty-tip">还没有聊天。点右上角 + 新建群聊，或在“好友”里点好友开聊。</div>

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

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButton, IonButtons, IonSearchbar, IonContent, IonRefresher, IonRefresherContent, IonList, IonItem, IonLabel, IonIcon } from '@ionic/vue';
import { add, arrowBack, chevronForward } from 'ionicons/icons';
import Avatar from '@/components/Avatar.vue';
import PickFriendsModal from '@/components/PickFriendsModal.vue';
import { chats, sortedChats, chatTitle, getChat, loadChats } from '@/stores/chats';
import type { Chat } from '@/stores/chats';
import { friendState, loadFriends } from '@/stores/friends';
import { nameOf, avatarOf } from '@/stores/directory';
import { myId } from '@/stores/session';
import { fmtDateTime, fmtTime, fmtDay, highlightParts, makeSnippet, oneLine } from '@/lib/format';
import { showToast } from '@/lib/toast';
import { searchMessages } from '@/services/messagesApi';
import { createGroup } from '@/services/chatApi';
import { openChat as goChat } from '@/services/navigation';
import type { MessageRow } from '@/types/database';

const kw = ref('');
const lastKw = ref('');
const hits = ref<MessageRow[] | null>(null);
const groupOpen = ref(false);
const creating = ref(false);

function openChat(id: string): void {
  goChat(id);
}

// 群聊用群头像；私聊用对方的头像（没有就用名字首字）
function chatAvatar(c: Chat): string | null {
  if (c.type === 'group') return c.avatarUrl;
  const other = c.members.find(m => m.user_id !== myId());
  return avatarOf(other?.user_id);
}

function preview(c: Chat): string {
  if (!c.lastBody) return c.type === 'group' ? `群聊 · ${c.members.length} 人` : '私聊';
  const text = oneLine(c.lastBody);
  return c.type === 'group' && c.lastSender ? `${nameOf(c.lastSender)}: ${text}` : text;
}

// 列表右侧的时间：今天显示时分，其他显示日期
function fmtListTime(iso: string): string {
  return fmtDay(iso) === fmtDay(new Date().toISOString()) ? fmtTime(iso) : fmtDay(iso);
}

async function onRefresh(ev: CustomEvent): Promise<void> {
  await Promise.all([loadChats(), loadFriends()]);
  (ev.target as unknown as { complete: () => void }).complete();
}

// ----- 搜索所有聊天 -----
const searchMode = ref(false);
const detailCid = ref<string | null>(null);

function enterSearch(): void {
  searchMode.value = true;
}

function exitSearch(): void {
  searchMode.value = false;
  detailCid.value = null;
  kw.value = '';
  lastKw.value = '';
  hits.value = null;
}

function clearKw(): void {
  kw.value = '';
  lastKw.value = '';
  hits.value = null;
  detailCid.value = null;
}

// 边输入边搜（debounce 由 searchbar 关掉，这里靠输入事件触发）
function onInput(ev: CustomEvent): void {
  const v = (ev.detail as { value?: string } | null)?.value ?? kw.value;
  kw.value = v;
  const q = v.trim();
  if (!q) {
    clearKw();
    return;
  }
  void runSearch(q);
}

async function runSearch(q: string): Promise<void> {
  const { data, error } = await searchMessages(q);
  if (error) {
    void showToast('搜索失败：' + error.message);
    return;
  }
  lastKw.value = q;
  hits.value = data;
}

function clearSearch(): void {
  clearKw();
}

// 结果按会话分组：一个会话一行，显示命中条数
const groups = computed(() => {
  const map = new Map<string, { cid: string; title: string; avatar: string | null; count: number }>();
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

// ----- 新建群聊 -----
async function onCreateGroup(p: { ids: string[]; name: string }): Promise<void> {
  if (creating.value) return;
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
/* 顶部与搜索：去掉灰块/阴影，做成一枚胶囊，页面整体连成一片 */
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

/* 分组结果 */
.section-title { display: flex; align-items: center; justify-content: space-between; }
.section-title .more { font-size: 13px; color: var(--md-on-surface-variant); text-transform: none; letter-spacing: 0; }
.section-title.small { justify-content: flex-start; padding-top: 10px; }
.chev { color: var(--md-on-surface-variant); font-size: 18px; }

/* 进入某个会话后的头部 */
.detail-head {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; font-size: 17px; font-weight: 500;
}
.detail-head span { flex: 1; }

/* 命中消息 */
.hit { --padding-start: 16px; --padding-end: 16px; --background: transparent; }
.hit :deep(.avatar) { margin-right: 12px; }
.hit-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.hit-top b { font-size: 14px; font-weight: 500; }
.hit-top span { font-size: 12px; color: var(--md-on-surface-variant); }
.hit-body { font-size: 14px; line-height: 1.5; margin: 0; }
.hit-mark { color: var(--md-primary); font-weight: 600; }

@media (prefers-color-scheme: dark) {
  .section-title .more { color: var(--md-on-surface-variant); }
}
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

/* 「搜索结果 / 全部聊天」和右侧按钮同基线 */
.section-title { display: flex; align-items: center; gap: 6px; }
.section-title ion-button {
  height: 26px;
  margin: 0;
  font-size: 13px;
  --padding-start: 6px;
  --padding-end: 6px;
}

.row { --padding-start: 16px; --padding-end: 16px; --min-height: 76px; --background: transparent; }
.row h2 { font-size: 17px; font-weight: 500; margin: 0 0 2px; }
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
</style>
