<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>好友</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="q" placeholder="按用户名搜索用户" :debounce="0" @keydown="onKey" @ionClear="clearSearch" />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content />
      </ion-refresher>

      <!-- 搜索结果（不在折叠分组里，搜完立即可见） -->
      <template v-if="results !== null">
        <div class="section-title">搜索结果</div>
        <ion-list>
          <ion-item v-for="u in results" :key="u.id">
            <Avatar slot="start" :name="u.username" :size="44" :src="avatarOf(u.id)" />
            <ion-label>{{ u.username }}<span v-if="relationText(u.id)" class="sub">（{{ relationText(u.id) }}）</span></ion-label>
            <ion-button v-if="!friendState.relations[u.id]" slot="end" size="small" fill="outline" @click="add(u.id)">添加</ion-button>
            <ion-button v-else-if="friendState.relations[u.id].status === 'accepted'" slot="end" size="small" fill="clear" disabled>已是好友</ion-button>
            <ion-button v-else-if="friendState.relations[u.id].incoming" slot="end" size="small" fill="outline" @click="accept(friendState.relations[u.id].rowId)">同意</ion-button>
          </ion-item>
          <ion-item v-if="!results.length" lines="none"><ion-label color="medium">没有找到这个用户</ion-label></ion-item>
        </ion-list>
      </template>

      <!-- 分组 1：新朋友（收到的好友申请） -->
      <section class="group">
        <button class="group-head" type="button" @click="toggle('incoming')">
          <ion-icon :icon="open.incoming ? chevronDown : chevronForward" />
          <span class="group-name">新朋友</span>
          <span class="group-count">{{ friendState.incoming.length }}</span>
        </button>
        <ion-list v-show="open.incoming">
          <ion-item v-for="f in friendState.incoming" :key="f.rowId">
            <Avatar slot="start" :name="f.name" :size="44" :src="avatarOf(f.id)" />
            <ion-label>{{ f.name }}</ion-label>
            <ion-button slot="end" size="small" fill="outline" @click="accept(f.rowId)">同意</ion-button>
            <ion-button slot="end" size="small" fill="clear" @click="remove(f.rowId)">拒绝</ion-button>
          </ion-item>
          <ion-item v-if="!friendState.incoming.length" lines="none"><ion-label color="medium">暂无</ion-label></ion-item>
        </ion-list>
      </section>

      <!-- 分组 2：我的好友（默认展开） -->
      <section class="group">
        <button class="group-head" type="button" @click="toggle('friends')">
          <ion-icon :icon="open.friends ? chevronDown : chevronForward" />
          <span class="group-name">我的好友</span>
          <span class="group-count">{{ friendState.friends.length }}</span>
        </button>
        <ion-list v-show="open.friends">
          <ion-item v-for="f in friendState.friends" :key="f.rowId" button :detail="false" @click="message(f.id)">
            <Avatar slot="start" :name="f.name" :size="44" :src="avatarOf(f.id)" />
            <ion-label>{{ f.name }}</ion-label>
            <ion-button slot="end" size="small" fill="clear" color="danger" @click="removeFriend(f)">删除</ion-button>
          </ion-item>
          <ion-item v-if="!friendState.friends.length" lines="none"><ion-label color="medium">还没有好友，先搜索添加吧</ion-label></ion-item>
        </ion-list>
      </section>

      <!-- 分组 3：已发出的申请 -->
      <section class="group">
        <button class="group-head" type="button" @click="toggle('outgoing')">
          <ion-icon :icon="open.outgoing ? chevronDown : chevronForward" />
          <span class="group-name">已发出的申请</span>
          <span class="group-count">{{ friendState.outgoing.length }}</span>
        </button>
        <ion-list v-show="open.outgoing">
          <ion-item v-for="f in friendState.outgoing" :key="f.rowId">
            <Avatar slot="start" :name="f.name" :size="44" :src="avatarOf(f.id)" />
            <ion-label>{{ f.name }}</ion-label>
            <ion-button slot="end" size="small" fill="clear" @click="remove(f.rowId)">撤回</ion-button>
          </ion-item>
          <ion-item v-if="!friendState.outgoing.length" lines="none"><ion-label color="medium">暂无</ion-label></ion-item>
        </ion-list>
      </section>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonSearchbar, IonContent, IonRefresher, IonRefresherContent, IonList, IonItem, IonLabel, IonButton, IonIcon } from '@ionic/vue';
import { chevronDown, chevronForward } from 'ionicons/icons';
import { friendState, loadFriends, searchUsers, sendRequest, acceptRequest, removeFriendship } from '@/stores/friends';
import type { FriendRow } from '@/stores/friends';
import Avatar from '@/components/Avatar.vue';
import { startDm } from '@/services/chatApi';
import { openChat } from '@/services/navigation';
import { avatarOf, ensureAvatars } from '@/stores/directory';
import { confirmDialog, showToast } from '@/lib/toast';

const q = ref('');
const results = ref<{ id: string; username: string }[] | null>(null);

// 分组展开状态：我的好友默认展开，其余默认收起
const open = reactive({ incoming: false, friends: true, outgoing: false });
function toggle(key: keyof typeof open): void {
  open[key] = !open[key];
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.isComposing) void doSearch();
}

async function doSearch(): Promise<void> {
  const text = (q.value ?? '').trim();
  if (!text) return clearSearch();
  await loadFriends();   // 先刷新关系，按钮状态才准
  const r = await searchUsers(text);
  if (r.error) {
    void showToast('搜索失败：' + r.error);
    return;
  }
  results.value = r.rows;
  await ensureAvatars(r.rows.map(x => x.id));
}

function clearSearch(): void {
  q.value = '';
  results.value = null;
}

function relationText(id: string): string {
  const r = friendState.relations[id];
  if (!r) return '';
  if (r.status === 'accepted') return '已是好友';
  return r.incoming ? '对方已向你申请' : '已申请';
}

async function onRefresh(ev: CustomEvent): Promise<void> {
  await loadFriends();
  (ev.target as unknown as { complete: () => void }).complete();
}

// 三种操作：成功后刷新好友列表
async function run(task: Promise<string | null>, okText: string): Promise<void> {
  const err = await task;
  void showToast(err || okText);
  await loadFriends();
}
const add = (id: string) => run(sendRequest(id), '好友申请已发送');
const accept = (rowId: string) => run(acceptRequest(rowId), '已添加为好友');
const remove = (rowId: string) => run(removeFriendship(rowId), '已完成');

async function removeFriend(f: FriendRow): Promise<void> {
  if (!(await confirmDialog('删除好友', `确定删除好友“${f.name}”吗？`, '删除'))) return;
  await run(removeFriendship(f.rowId), '已删除');
}

// 点好友这一行 = 开聊（去掉“发消息”按钮后，入口放在整行上）
async function message(id: string): Promise<void> {
  const r = await startDm(id);
  if (r.error || !r.id) {
    void showToast(r.error || '创建私聊失败');
    return;
  }
  openChat(r.id);   // 记住来源标签页，返回时回到“好友”
}
</script>

<style scoped>
ion-item :deep(.avatar) { margin-right: 14px; }
.sub { color: var(--md-on-surface-variant); font-size: 12px; margin-left: 6px; }

/* 像 QQ 那样的可折叠分组：三角 + 名称 + 右侧计数 */
.group { margin-top: 8px; }
.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px 8px;
  background: transparent;
  border: 0;
  color: var(--md-on-surface-variant);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.group-head ion-icon { font-size: 16px; }
.group-name { flex: 1; font-weight: 500; }
.group-count { font-size: 12px; color: var(--md-on-surface-variant); }
.group ion-list { padding-top: 0; }
</style>
