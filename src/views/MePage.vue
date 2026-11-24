<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>账号</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- 头像 -->
      <div class="hero">
        <button class="ava-btn" type="button" :disabled="uploading" @click="pick">
          <Avatar :name="session.username || '我'" :size="104" :src="myAvatar" />
        </button>
        <input ref="fileEl" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onPick" />

        <h2 class="name">{{ session.username || '—' }}</h2>
        <p class="handle">@{{ handle || '未设置' }}</p>
      </div>

      <!-- 三个操作 -->
      <div class="acts">
        <button type="button" @click="pick">
          <ion-icon :icon="cameraOutline" />
          <span>设置照片</span>
        </button>
        <button type="button" @click="openRename">
          <ion-icon :icon="pencilOutline" />
          <span>编辑信息</span>
        </button>
        <button type="button" @click="settingsOpen = true">
          <ion-icon :icon="settingsOutline" />
          <span>设置</span>
        </button>
      </div>

      <!-- 个人信息 -->
      <div class="card">
        <div class="row">
          <span class="k">账号名</span>
          <span class="v">@{{ handle || '未设置' }}</span>
        </div>
        <div class="row">
          <span class="k">邮箱</span>
          <span class="v">{{ session.user?.email || '—' }}</span>
        </div>
        <div class="row">
          <span class="k">HorizonID</span>
          <span class="v">{{ horizonId ?? '—' }}</span>
        </div>
      </div>

      <AvatarCropper :open="cropOpen" :src="cropSrc" @cancel="closeCrop" @done="onCropped" @failed="onCropFailed" />
      <AppearanceModal :open="appearanceOpen" @close="appearanceOpen = false" />

      <!-- 设置面板 -->
      <div v-if="settingsOpen" class="set-mask" @click.self="settingsOpen = false">
        <div class="set-sheet">
          <div class="set-head">
            <h3>设置</h3>
            <button type="button" class="x" @click="settingsOpen = false">✕</button>
          </div>

          <button class="set-item" type="button" @click="appearanceOpen = true">
            <ion-icon :icon="colorPaletteOutline" />
            <span class="grow">外观</span>
            <span class="hint">深色 / 主题色 / 聊天背景</span>
          </button>

          <div class="set-item static">
            <ion-icon :icon="notificationsOutline" />
            <span class="grow">新消息通知</span>
            <ion-toggle :checked="notifyOn" @ionChange="onToggle" />
          </div>

          <div class="set-item static">
            <ion-icon :icon="cloudDownloadOutline" />
            <span class="grow">更新推送</span>
            <ion-toggle :checked="updatePushOn" @ionChange="onToggleUpdatePush" />
          </div>

          <div class="set-item static">
            <ion-icon :icon="informationCircleOutline" />
            <span class="grow">版本</span>
            <span class="hint">v{{ APP_VERSION }}</span>
          </div>

          <button class="set-item danger" type="button" @click="onLogout">
            <ion-icon :icon="logOutOutline" />
            <span class="grow">退出登录</span>
          </button>

          <button class="set-item danger" type="button" @click="deleteAccount">
            <ion-icon :icon="trashOutline" />
            <span class="grow">注销账号</span>
          </button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonToggle, IonIcon, alertController,
} from '@ionic/vue';
import {
  cameraOutline, cloudDownloadOutline, colorPaletteOutline, informationCircleOutline,
  logOutOutline, notificationsOutline, pencilOutline, settingsOutline, trashOutline,
} from 'ionicons/icons';
import Avatar from '@/components/Avatar.vue';
import AvatarCropper from '@/components/AvatarCropper.vue';
import AppearanceModal from '@/components/AppearanceModal.vue';
import { session } from '@/stores/session';
import { myAvatar, loadMyAvatar, setMyAvatar } from '@/stores/profile';
import { uploadUserAvatar, isStaticImage } from '@/services/avatarApi';
import { setAvatar } from '@/stores/directory';
import { notifyOn, APP_VERSION } from '@/stores/settings';
import { setNotify } from '@/services/notify';
import { logout } from '@/services/lifecycle';
import { confirmDialog, showToast } from '@/lib/toast';
import { db } from '@/lib/supabase';

const appearanceOpen = ref(false);
const settingsOpen = ref(false);
const fileEl = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const cropOpen = ref(false);
const cropSrc = ref('');

const horizonId = ref<number | null>(null);
const handle = ref<string | null>(null);
const updatePushOn = ref(localStorage.getItem('hz:update-push') !== '0');

const ME_KEY = 'hz:me:profile';

interface CachedMe { id: string; horizonId: number | null; idSearchable: boolean; handle: string | null }
function readCache(uid: string): CachedMe | null {
  try {
    const raw = localStorage.getItem(ME_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as CachedMe;
    return c.id === uid ? c : null;
  } catch { return null; }
}

async function loadProfile(): Promise<void> {
  const uid = session.user?.id;
  if (!uid) return;
  const { data } = await db.from('profiles').select('horizon_id,id_searchable,handle').eq('id', uid).maybeSingle();
  horizonId.value = (data?.horizon_id as number | undefined) ?? null;
  handle.value = (data?.handle as string | null) ?? null;
  try {
    localStorage.setItem(ME_KEY, JSON.stringify({
      id: uid,
      horizonId: horizonId.value,
      idSearchable: (data?.id_searchable as boolean | undefined) ?? false,
      handle: handle.value,
    }));
  } catch { /* 忽略 */ }
}

onMounted(() => {
  void loadMyAvatar();
  const uid = session.user?.id;
  if (uid) {
    const c = readCache(uid);
    if (c) { horizonId.value = c.horizonId; handle.value = c.handle; }
  }
  void loadProfile();
});

// ---------- 头像 ----------
function pick(): void { fileEl.value?.click(); }
function closeCrop(): void {
  cropOpen.value = false;
  if (cropSrc.value) URL.revokeObjectURL(cropSrc.value);
  cropSrc.value = '';
}
function onPick(e: Event): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!isStaticImage(file)) { void showToast('只能选 JPG / PNG / WebP 静态图片'); return; }
  cropSrc.value = URL.createObjectURL(file);
  cropOpen.value = true;
}
function onCropFailed(): void { closeCrop(); void showToast('这张图片格式不支持'); }

async function onCropped(blob: Blob): Promise<void> {
  uploading.value = true;
  try {
    const url = await uploadUserAvatar(blob);
    if (!url) { void showToast('上传失败，请检查网络或存储权限'); return; }
    setMyAvatar(url);
    setAvatar(session.user?.id ?? '', url);
    void showToast('头像已更新');
  } finally {
    uploading.value = false;
    closeCrop();
  }
}

// ---------- 修改用户名 ----------
async function openRename(): Promise<void> {
  const alert = await alertController.create({
    header: '修改用户名',
    message: '每天只能改一次（UTC+8 0 点重置）；支持汉字、假名和字母',
    inputs: [{ name: 'name', type: 'text', value: session.username, placeholder: '新的用户名' }],
    buttons: [
      { text: '取消', role: 'cancel' },
      { text: '保存', handler: (d) => { void doRename(String(d?.name ?? '')); } },
    ],
  });
  await alert.present();
}

async function doRename(raw: string): Promise<void> {
  const name = raw.trim();
  if (name.length < 2 || name.length > 20) { void showToast('用户名需为 2–20 个字符'); return; }
  const { error } = await db.rpc('change_username', { new_name: name });
  if (error) {
    const m = error.message.includes('once_per_day') ? '今天已经改过了，明天 0 点后再试'
      : error.message.includes('name_taken') ? '这个名字已被占用'
        : error.message.includes('invalid_username') ? '用户名含有不支持的字符'
          : error.message;
    void showToast('改名失败：' + m);
    return;
  }
  session.username = name;
  void showToast('用户名已更新');
}

// ---------- 设置项 ----------
function onToggle(ev: CustomEvent): void {
  const on = !!(ev.detail as { checked: boolean }).checked;
  setNotify(on);
}

function onToggleUpdatePush(ev: CustomEvent): void {
  updatePushOn.value = !!(ev.detail as { checked: boolean }).checked;
  localStorage.setItem('hz:update-push', updatePushOn.value ? '1' : '0');
  void showToast(updatePushOn.value ? '已开启更新推送' : '已关闭更新推送');
}

function onLogout(): void { void logout(); }

// ---------- 注销 ----------
async function deleteAccount(): Promise<void> {
  const email = session.user?.email;
  if (!email) { void showToast('当前账号没有绑定邮箱'); return; }
  const ok = await confirmDialog('注销账号', '注销后账号与聊天数据会被删除，确定继续吗？', '发送验证码');
  if (!ok) return;

  const { error } = await db.auth.signInWithOtp({ email });
  if (error) { void showToast('发送验证码失败：' + error.message); return; }

  const alert = await alertController.create({
    header: '输入邮箱验证码',
    message: '验证码已发送到 ' + email,
    inputs: [{ name: 'code', type: 'tel', placeholder: '6 位验证码' }],
    buttons: [
      { text: '取消', role: 'cancel' },
      { text: '确认注销', handler: (d) => { void doDeleteAccount(String(d?.code ?? '')); } },
    ],
  });
  await alert.present();
}

async function doDeleteAccount(code: string): Promise<void> {
  const email = session.user?.email;
  if (!email || !code.trim()) { void showToast('请填写验证码'); return; }
  const { error } = await db.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
  if (error) { void showToast('验证码不正确：' + error.message); return; }
  const { error: fnErr } = await db.functions.invoke('delete-account', { body: {} });
  if (fnErr) { void showToast('注销失败：' + fnErr.message); return; }
  void showToast('账号已注销');
  await logout();
}
</script>

<style scoped>
.hero { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px 0 14px; }
.ava-btn { border: 0; background: transparent; padding: 0; }
.name { margin: 8px 0 0; font-size: 22px; font-weight: 600; }
.handle { margin: 0; font-size: 13px; color: var(--md-on-surface-variant); }

.acts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 4px 4px 16px; }
.acts button {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 14px 6px; border: 0; border-radius: 16px;
  background: var(--md-surface-container); color: var(--md-on-surface); font-size: 13px;
}
.acts ion-icon { font-size: 22px; }

.card { border-radius: 18px; overflow: hidden; background: var(--md-surface-container); }
.card .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; }
.card .row + .row { border-top: 1px solid rgba(127,127,127,.12); }
.card .k { font-size: 13px; color: var(--md-on-surface-variant); }
.card .v { font-size: 15px; }

.set-mask { position: fixed; inset: 0; z-index: 9990; background: rgba(0,0,0,.45); display: flex; align-items: flex-end; }
.set-sheet {
  width: 100%; max-height: 84vh; overflow: auto;
  border-radius: 24px 24px 0 0; padding: 14px 12px calc(18px + var(--ion-safe-area-bottom, 0px));
  background: var(--md-surface-container-high); color: var(--md-on-surface);
}
.set-head { display: flex; align-items: center; justify-content: space-between; padding: 2px 8px 12px; }
.set-head h3 { margin: 0; font-size: 18px; }
.set-head .x { border: 0; background: transparent; color: var(--md-on-surface-variant); font-size: 18px; }
.set-item {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 14px 12px; border: 0; border-radius: 14px;
  background: transparent; color: var(--md-on-surface); font-size: 15px; text-align: left;
}
.set-item + .set-item { border-top: 1px solid rgba(127,127,127,.1); }
.set-item ion-icon { font-size: 20px; color: var(--md-on-surface-variant); }
.set-item .grow { flex: 1; }
.set-item .hint { font-size: 12px; color: var(--md-on-surface-variant); }
.set-item.danger, .set-item.danger ion-icon { color: #e5484d; }
</style>
