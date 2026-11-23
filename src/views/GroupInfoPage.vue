<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/chat/${cid}`" text="返回" />
        </ion-buttons>
        <ion-title>群聊信息</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <template v-if="chat">
        <ion-list>
          <ion-item lines="none">
            <ion-label>
              <p>群名称</p>
              <h2>{{ chat.name || '群聊' }}</h2>
            </ion-label>
          </ion-item>
        </ion-list>

        <div class="section-title">群成员（{{ chat.members.length }}）</div>
        <ion-list>
          <ion-item v-for="m in members" :key="m.user_id">
            <ion-label>
              {{ nameOf(m.user_id) }}
              <span v-if="m.role === 'owner'" class="tag">群主</span>
              <span v-if="m.user_id === me" class="tag">我</span>
            </ion-label>
            <ion-button v-if="isOwner && m.user_id !== me" slot="end" size="small" fill="clear" color="danger" @click="kick(m.user_id)">移出</ion-button>
          </ion-item>
        </ion-list>

        <div class="ion-padding actions">
          <ion-button v-if="isOwner" expand="block" fill="outline" @click="addOpen = true">添加成员</ion-button>
          <ion-button expand="block" fill="outline" @click="clearChat">清空聊天记录</ion-button>
          <ion-button v-if="isOwner" expand="block" fill="outline" color="danger" @click="dissolve">解散群聊</ion-button>
          <ion-button expand="block" fill="outline" color="danger" @click="leave">退出群聊</ion-button>
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

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonButton, IonTitle, IonContent, IonList, IonItem, IonLabel, useIonRouter } from '@ionic/vue';
import PickFriendsModal from '@/components/PickFriendsModal.vue';
import { chatTitle, getChat, myRole } from '@/stores/chats';
import { friendState } from '@/stores/friends';
import { nameOf } from '@/stores/directory';
import { myId } from '@/stores/session';
import { confirmDialog, showToast } from '@/lib/toast';
import { addMembers, clearConversation, dissolveGroup, leaveGroup, removeMember } from '@/services/chatApi';

const route = useRoute();
const ionRouter = useIonRouter();

const cid = ref('');
const addOpen = ref(false);
const busy = ref(false);

const me = computed(() => myId());
const chat = computed(() => getChat(cid.value));
const isOwner = computed(() => (chat.value ? myRole(chat.value) === 'owner' : false));

// 群主排在最前面
const members = computed(() =>
  [...(chat.value?.members ?? [])].sort((a, b) => (a.role === b.role ? 0 : a.role === 'owner' ? -1 : 1)),
);

// 可以添加的人：我的好友里，还不在这个群里的
const candidates = computed(() => friendState.friends.filter(f => !chat.value?.members.some(m => m.user_id === f.id)));

const toChats = (): void => ionRouter.navigate('/tabs/chats', 'root', 'replace');

async function onAdd(p: { ids: string[]; name: string }): Promise<void> {
  if (busy.value) return;
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
  if (!(await confirmDialog('移出成员', `确定把“${name}”移出群聊吗？`, '移出'))) return;
  const err = await removeMember(cid.value, userId);
  void showToast(err || `已移出“${name}”`);
}

async function clearChat(): Promise<void> {
  if (!(await confirmDialog('清空聊天记录', '只会清空你这边的记录，群里其他人不受影响。确定清空吗？', '清空'))) return;
  const err = await clearConversation(cid.value);
  void showToast(err || '已清空聊天记录');
}

async function leave(): Promise<void> {
  const c = chat.value;
  if (!c) return;
  const tip = isOwner.value
    ? '你是群主。退出后，群主会自动转给最早加入的成员；如果群里没有其他人，群聊会被解散。确定退出吗？'
    : '退出后将不再收到这个群的消息。确定退出吗？';
  if (!(await confirmDialog('退出群聊', tip, '退出'))) return;
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
  if (!c) return;
  if (!(await confirmDialog('解散群聊', '解散后，所有成员的聊天记录都会被删除，无法恢复。确定解散吗？', '解散'))) return;
  const title = chatTitle(c);
  const err = await dissolveGroup(cid.value);
  if (err) {
    void showToast(err);
    return;
  }
  void showToast(`群聊“${title}”已解散`);
}

// 这个群不存在了（退出 / 解散 / 被移出）→ 回到聊天列表
watch(chat, (c, old) => {
  if (old && !c) toChats();
});

watch(
  () => route.params.id,
  v => {
    if (typeof v === 'string' && route.path.endsWith('/info')) cid.value = v;
  },
  { immediate: true },
);
</script>

<style scoped>
.tag { margin-left: 8px; font-size: 11px; color: var(--ion-color-medium); border: 1px solid var(--ion-color-medium); padding: 0 6px; }
.actions { display: flex; flex-direction: column; gap: 8px; }
</style>
