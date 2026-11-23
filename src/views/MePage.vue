<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>我的</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="hero">
        <button class="avatar-btn" type="button" :disabled="uploading" @click="pick">
          <Avatar :name="session.username || '?'" :size="88" :src="myAvatar" />
          <span class="avatar-hint">{{ uploading ? '上传中…' : '点击更换头像' }}</span>
        </button>
        <input ref="fileEl" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onPick" />
        <AvatarCropper :open="cropOpen" :src="cropSrc" @cancel="closeCrop" @done="onCropped" @failed="onCropFailed" />
        <div class="hero-name">{{ session.username || '—' }}</div>
      </div>

      <ion-list>
        <ion-item button :detail="true" lines="none" @click="appearanceOpen = true">
          <ion-icon slot="start" :icon="colorPaletteOutline" />
          <ion-label>
            <h2>外观</h2>
            <p>深色 / 浅色、主题色、聊天背景</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-label>
            <p>用户名</p>
            <h2>{{ session.username || '—' }}</h2>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-label>
            <p>邮箱</p>
            <h2>{{ session.user?.email || '—' }}</h2>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-toggle :checked="notifyOn" @ionChange="onToggle">新消息通知</ion-toggle>
        </ion-item>
        <ion-item lines="none">
          <ion-label>
            <p>版本</p>
            <h2>v{{ APP_VERSION }}</h2>
          </ion-label>
        </ion-item>
      </ion-list>

      <div class="ion-padding">
        <ion-button expand="block" fill="outline" color="danger" @click="onLogout">退出登录</ion-button>
      </div>
      <AppearanceModal :open="appearanceOpen" @close="appearanceOpen = false" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonToggle, IonButton, IonIcon } from '@ionic/vue';
import { colorPaletteOutline } from 'ionicons/icons';
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

const appearanceOpen = ref(false);
const fileEl = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const cropOpen = ref(false);
const cropSrc = ref('');

onMounted(() => { void loadMyAvatar(); });

function pick(): void {
  fileEl.value?.click();
}

function closeCrop(): void {
  cropOpen.value = false;
  if (cropSrc.value) URL.revokeObjectURL(cropSrc.value);
  cropSrc.value = '';
}

// 选文件：先挡掉视频 / GIF 等非静态图片，再进裁剪页
function onPick(e: Event): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!isStaticImage(file)) {
    void showToast('只能选 JPG / PNG / WebP 静态图片（不支持视频和 GIF）');
    return;
  }
  cropSrc.value = URL.createObjectURL(file);
  cropOpen.value = true;
}

// 图片解不开（HEIC / 损坏文件等）
function onCropFailed(): void {
  closeCrop();
  void showToast('这张图片格式不支持，请换一张 JPG / PNG');
}

// 裁剪完成 → 上传
async function onCropped(blob: Blob): Promise<void> {
  uploading.value = true;
  try {
    const url = await uploadUserAvatar(blob);
    if (url) {
      setMyAvatar(url);
      setAvatar(session.user?.id ?? '', url);
      void showToast('头像已更新');
    } else {
      void showToast('上传失败，请检查网络或存储权限');
    }
  } catch (err) {
    void showToast(err instanceof Error ? err.message : '上传失败');
  } finally {
    uploading.value = false;
    closeCrop();
  }
}

function onToggle(ev: CustomEvent): void {
  const on = !!(ev.detail as { checked?: boolean }).checked;
  if (on !== notifyOn.value) void setNotify(on);
}

async function onLogout(): Promise<void> {
  if (await confirmDialog('退出登录', '确定要退出登录吗？', '退出')) await logout();
}
</script>

<style scoped>
.hero { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px 0 12px; }
.hero-name { font-size: 22px; font-weight: 500; }
.avatar-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
}
.avatar-btn:disabled { opacity: 0.6; }
.avatar-hint { font-size: 12px; color: var(--md-on-surface-variant); }
ion-item ion-icon[slot='start'] { color: var(--md-primary); font-size: 24px; margin-inline-end: 16px; }
</style>
