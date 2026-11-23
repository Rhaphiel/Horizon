<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>聊天</ion-title>
        <ion-buttons slot="end">
          <ion-button aria-label="新建群聊" @click="groupOpen = true">
            <ion-icon slot="icon-only" :icon="add" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar class="search-bar">
        <ion-searchbar
          v-model="kw"
          class="pill"
          placeholder="搜索聊天"
          :debounce="0"
          @keydown="onKey"
          @ionClear="clearSearch"
        />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content />
      </ion-refresher>

      <!-- 搜索结果 -->
      <template v-if="hits !== null">
        <div class="section-title">
          搜索结果
          <ion-button size="small" fill="clear" @click="clearSearch">清除</ion-button>
        </div>
        <ion-list>
          <ion-item v-for="h in hits" :key="h.id" button :detail="false" @click="openHit(h)">
            <ion-label class="ion-text-wrap">
              <p>{{ hitMeta(h) }}</p>
              <h3>
                <span v-for="(p, i) in parts(h.body)" :key="i" :class="{ 'hit-mark': p.hit }">{{ p.text }}</span>
              </h3>
            </ion-label>
          </ion-item>
          <ion-item v-if="!hits.length" lines="none">
            <ion-label color="medium">没有找到相关消息</ion-label>
          </ion-item>
          <ion-item v-if="hits.length >= 50" lines="none">
            <ion-label color="medium">只显示最近 50 条，可以换更具体的关键词</ion-label>
          </ion-item>
        </ion-list>
        <div class="section-title">全部聊天</div>
      </template>

      <!-- 聊天列表 -->
      <ion-list v-if="sortedChats.length">
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
import { ref } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonButton, IonButtons, IonSearchbar, IonContent, IonRefresher, IonRefresherContent, IonList, IonItem, IonLabel, IonIcon } from '@ionic/vue';
import { add } from 'ionicons/icons';
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
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.isComposing) void doSearch();
}
async function doSearch(): Promise<void> {
  const q = (kw.value ?? '').trim();
  if (!q) return clearSearch();
  const { data, error } = await searchMessages(q);
  if (error) {
    void showToast('搜索失败：' + error.message);
    return;
  }
  lastKw.value = q;
  hits.value = data;
}
function clearSearch(): void {
  kw.value = '';
  lastKw.value = '';
  hits.value = null;
}
const parts = (body: string) => highlightParts(makeSnippet(body, lastKw.value), lastKw.value);
function hitMeta(h: MessageRow): string {
  const c = getChat(h.conversation_id);
  const who = h.sender_id === myId() ? '我' : nameOf(h.sender_id);
  return `${c ? chatTitle(c) : '聊天'} · ${who} · ${fmtDateTime(h.created_at)}`;
}
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
