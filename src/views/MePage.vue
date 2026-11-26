<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>账号</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <section class="profile">
        <button class="ava" type="button" :disabled="uploading" @click="pick">
          <Avatar :name="session.username || '我'" :size="76" :src="myAvatar" />
        </button>
        <input ref="fileEl" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onPick" />

        <div class="who">
          <div class="line1">
            <h2 class="name">{{ session.username || '—' }}</h2>
            <span v-if="myTitle" class="ttl" :style="titleStyle(myTitle)">{{ myTitle.text }}</span>
          </div>
          <p class="handle">@{{ handle || '未设置' }}</p>
          <button class="id" type="button" @click="copyId">
            <span>ID {{ horizonId ?? '—' }}</span>
            <ion-icon :icon="copyOutline" />
          </button>
        </div>
      </section>

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

      <AvatarCropper :open="cropOpen" :src="cropSrc" @cancel="closeCrop" @done="onCropped" @failed="onCropFailed" />
      <AppearanceModal :open="appearanceOpen" @close="appearanceOpen = false" />
      <AccountsOverview :open="overviewOpen" @close="overviewOpen = false" />

      <Teleport to="body">
        <div v-if="settingsOpen" class="sheet-mask" @click.self="settingsOpen = false">
          <div class="sheet">
            <div class="sheet-head">
              <h3>设置</h3>
              <button type="button" class="x" @click="settingsOpen = false">✕</button>
            </div>

            <p class="sec">个人资料</p>
            <button class="item" type="button" @click="appearanceOpen = true">
              <ion-icon :icon="colorPaletteOutline" />
              <span class="grow">外观</span>
              <span class="val">主题 · 背景</span>
              <ion-icon class="chev" :icon="chevronForwardOutline" />
            </button>
            <button v-if="horizonId === 100001" class="item" type="button" @click="overviewOpen = true">
              <ion-icon :icon="albumsOutline" />
              <span class="grow">账号数据一览</span>
              <span class="val">仅 100001</span>
              <ion-icon class="chev" :icon="chevronForwardOutline" />
            </button>

            <p class="sec">通知</p>
            <div class="item static">
              <ion-icon :icon="notificationsOutline" />
              <span class="grow">新消息通知</span>
              <span class="ctl"><ion-toggle :checked="notifyOn" @ionChange="onToggle" /></span>
            </div>
            <div class="item static">
              <ion-icon :icon="cloudDownloadOutline" />
              <span class="grow">更新推送</span>
              <span class="ctl"><ion-toggle :checked="updatePushOn" @ionChange="onToggleUpdatePush" /></span>
            </div>

            <p class="sec">隐私与安全</p>
            <button class="item" type="button" @click="privacyOpen = true">
              <ion-icon :icon="lockClosedOutline" />
              <span class="grow">账号与隐私</span>
              <span class="val">{{ idSearchable ? 'ID 可被搜索' : 'ID 已隐藏' }}</span>
              <ion-icon class="chev" :icon="chevronForwardOutline" />
            </button>

            <p class="sec">关于</p>
            <div class="item static">
              <ion-icon :icon="informationCircleOutline" />
              <span class="grow">版本</span>
              <span class="val">v{{ APP_VERSION }}</span>
            </div>

            <div class="danger-zone">
              <button class="item danger" type="button" @click="onLogout">
                <ion-icon :icon="logOutOutline" />
                <span class="grow">退出登录</span>
              </button>
              <button class="item danger" type="button" @click="deleteAccount">
                <ion-icon :icon="trashOutline" />
                <span class="grow">注销账号</span>
              </button>
            </div>
          </div>
        </div>

        <div v-if="privacyOpen" class="sheet-mask" @click.self="privacyOpen = false">
          <div class="sheet">
            <div class="sheet-head">
              <button type="button" class="x back" @click="privacyOpen = false">‹</button>
              <h3>账号与隐私</h3>
              <button type="button" class="x" @click="privacyOpen = false">✕</button>
            </div>

            <div class="item static">
              <ion-icon :icon="searchOutline" />
              <span class="grow">允许通过 ID 找到我</span>
              <span class="ctl"><ion-toggle :checked="idSearchable" @ionChange="onToggleIdSearch" /></span>
            </div>
            <p class="tip">关闭后，别人用 HorizonID 搜不到你，但已有的好友关系不受影响。</p>

            <button class="item" type="button" @click="resetPassword">
              <ion-icon :icon="keyOutline" />
              <span class="grow">修改密码</span>
              <span class="val">通过邮箱验证码</span>
              <ion-icon class="chev" :icon="chevronForwardOutline" />
            </button>

            <div class="item static">
              <ion-icon :icon="personCircleOutline" />
              <span class="grow">登录方式</span>
              <span class="val">账号名 / ID / 邮箱</span>
            </div>
          </div>
        </div>
      </Teleport>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">import { onMounted, ref } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonToggle, IonIcon, alertController, } from '@ionic/vue';
import { albumsOutline, cameraOutline, chevronForwardOutline, cloudDownloadOutline, colorPaletteOutline, copyOutline, informationCircleOutline, keyOutline, lockClosedOutline, logOutOutline, notificationsOutline, pencilOutline, personCircleOutline, searchOutline, settingsOutline, trashOutline, } from 'ionicons/icons';
import Avatar from '@/components/Avatar.vue';
import AvatarCropper from '@/components/AvatarCropper.vue';
import AppearanceModal from '@/components/AppearanceModal.vue';
import AccountsOverview from '@/components/AccountsOverview.vue';
import { session } from '@/stores/session';
import { myAvatar, loadMyAvatar, setMyAvatar } from '@/stores/profile';
import { uploadUserAvatar, isStaticImage } from '@/services/avatarApi';
import { setAvatar } from '@/stores/directory';
import { notifyOn, APP_VERSION } from '@/stores/settings';
import { setNotify } from '@/services/notify';
import { logout } from '@/services/lifecycle';
import { confirmDialog, showToast } from '@/lib/toast';
import { isUsernameOk } from '@/lib/username';
import { db } from '@/lib/supabase';
import { ensureTitles, titleOf, titleStyle } from '@/stores/titles';
import { computed } from 'vue';
const appearanceOpen = ref(false);
const overviewOpen = ref(false);
const settingsOpen = ref(false);
const privacyOpen = ref(false);
const fileEl = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const cropOpen = ref(false);
const cropSrc = ref('');
const horizonId = ref<number | null>(null);
const handle = ref<string | null>(null);
const idSearchable = ref(false);
const updatePushOn = ref(localStorage.getItem('hz:update-push') !== '0');
const myTitle = computed(() => titleOf(session.user?.id ?? ''));
const ME_KEY = 'hz:me:profile';
interface CachedMe {
    id: string;
    horizonId: number | null;
    idSearchable: boolean;
    handle: string | null;
}
function readCache(uid: string): CachedMe | null {
    try {
        const raw = localStorage.getItem(ME_KEY);
        if (!raw)
            return null;
        const c = JSON.parse(raw) as CachedMe;
        return c.id === uid ? c : null;
    }
    catch {
        return null;
    }
}
async function loadProfile(): Promise<void> {
    const uid = session.user?.id;
    if (!uid)
        return;
    const { data } = await db
        .from('profiles')
        .select('horizon_id,id_searchable,handle')
        .eq('id', uid)
        .maybeSingle();
    horizonId.value = (data?.horizon_id as number | undefined) ?? null;
    handle.value = (data?.handle as string | null) ?? null;
    idSearchable.value = (data?.id_searchable as boolean | undefined) ?? false;
    try {
        localStorage.setItem(ME_KEY, JSON.stringify({
            id: uid,
            horizonId: horizonId.value,
            idSearchable: idSearchable.value,
            handle: handle.value,
        }));
    }
    catch { }
}
onMounted(() => {
    void loadMyAvatar();
    const uid = session.user?.id;
    if (uid) {
        void ensureTitles([uid]);
        const c = readCache(uid);
        if (c) {
            horizonId.value = c.horizonId;
            idSearchable.value = c.idSearchable;
            handle.value = c.handle;
        }
    }
    void loadProfile();
});
function pick(): void { fileEl.value?.click(); }
function closeCrop(): void {
    cropOpen.value = false;
    if (cropSrc.value)
        URL.revokeObjectURL(cropSrc.value);
    cropSrc.value = '';
}
function onPick(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file)
        return;
    if (!isStaticImage(file)) {
        void showToast('只能选 JPG / PNG / WebP 静态图片');
        return;
    }
    cropSrc.value = URL.createObjectURL(file);
    cropOpen.value = true;
}
function onCropFailed(): void { closeCrop(); void showToast('这张图片格式不支持'); }
async function onCropped(blob: Blob): Promise<void> {
    uploading.value = true;
    try {
        const url = await uploadUserAvatar(blob);
        if (!url) {
            void showToast('上传失败，请检查网络或存储权限');
            return;
        }
        setMyAvatar(url);
        setAvatar(session.user?.id ?? '', url);
        void showToast('头像已更新');
    }
    catch (err) {
        void showToast(err instanceof Error ? err.message : '上传失败');
    }
    finally {
        uploading.value = false;
        closeCrop();
    }
}
async function copyId(): Promise<void> {
    const v = String(horizonId.value ?? '');
    if (!v)
        return;
    try {
        await navigator.clipboard.writeText(v);
        void showToast('HorizonID 已复制');
    }
    catch {
        void showToast('复制失败，请长按选择');
    }
}
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
    if (!isUsernameOk(name)) {
        void showToast('用户名需为 2–20 个字，不能有空格、符号或表情');
        return;
    }
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
async function onToggle(ev: CustomEvent): Promise<void> {
    const on = !!(ev.detail as {
        checked?: boolean;
    }).checked;
    if (on === notifyOn.value)
        return;
    const granted = await setNotify(on);
    if (!granted)
        void showToast('系统没有允许 Horizon 发通知，请到手机「设置 → 应用 → Horizon → 通知」里打开', 3500);
}
async function onToggleIdSearch(ev: CustomEvent): Promise<void> {
    const on = !!(ev.detail as {
        checked?: boolean;
    }).checked;
    const uid = session.user?.id;
    if (!uid)
        return;
    const { error } = await db.from('profiles').update({ id_searchable: on }).eq('id', uid);
    if (error) {
        void showToast('保存失败：' + error.message);
        return;
    }
    idSearchable.value = on;
    void showToast(on ? '已开启：别人可以用 ID 搜到你' : '已关闭：别人搜不到你的 ID');
}
function onToggleUpdatePush(ev: CustomEvent): void {
    updatePushOn.value = !!(ev.detail as {
        checked: boolean;
    }).checked;
    localStorage.setItem('hz:update-push', updatePushOn.value ? '1' : '0');
    void showToast(updatePushOn.value ? '已开启更新推送' : '已关闭更新推送');
}
function onLogout(): void { void logout(); }
async function resetPassword(): Promise<void> {
    const email = session.user?.email;
    if (!email) {
        void showToast('当前账号没有绑定邮箱');
        return;
    }
    const alert = await alertController.create({
        header: '修改密码',
        message: '会向 ' + email + ' 发送 6 位验证码',
        inputs: [
            { name: 'code', type: 'tel', placeholder: '验证码' },
            { name: 'pwd', type: 'password', placeholder: '新密码（至少 6 位）' },
        ],
        buttons: [
            { text: '取消', role: 'cancel' },
            { text: '发送验证码', handler: () => { void sendResetCode(email); return false; } },
            { text: '确认修改', handler: (d) => { void applyReset(email, String(d?.code ?? ''), String(d?.pwd ?? '')); } },
        ],
    });
    await alert.present();
}
async function sendResetCode(email: string): Promise<void> {
    const { error } = await db.auth.signInWithOtp({ email });
    if (error) {
        void showToast('发送失败：' + error.message);
        return;
    }
    void showToast('验证码已发送，请填入后确认修改');
}
async function applyReset(email: string, code: string, pwd: string): Promise<void> {
    if (!code.trim() || pwd.length < 6) {
        void showToast('请填写验证码和至少 6 位的新密码');
        return;
    }
    const { error } = await db.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    if (error) {
        void showToast('验证码不正确：' + error.message);
        return;
    }
    const { error: e2 } = await db.auth.updateUser({ password: pwd });
    if (e2) {
        void showToast('修改失败：' + e2.message);
        return;
    }
    void showToast('密码已更新');
}
async function deleteAccount(): Promise<void> {
    const email = session.user?.email;
    if (!email) {
        void showToast('当前账号没有绑定邮箱');
        return;
    }
    const ok = await confirmDialog('注销账号', '注销后账号与聊天数据会被删除，确定继续吗？', '发送验证码');
    if (!ok)
        return;
    const { error } = await db.auth.signInWithOtp({ email });
    if (error) {
        void showToast('发送验证码失败：' + error.message);
        return;
    }
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
    if (!email || !code.trim()) {
        void showToast('请填写验证码');
        return;
    }
    const { error } = await db.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    if (error) {
        void showToast('验证码不正确：' + error.message);
        return;
    }
    const { error: fnErr } = await db.functions.invoke('delete-account', { body: {} });
    if (fnErr) {
        let reason = '';
        try {
            const body = (await (fnErr as {
                context?: Response;
            }).context?.json()) as {
                error?: string;
            } | undefined;
            reason = body?.error ?? '';
        }
        catch { }
        void showToast(reason === 'reauth_required' ? '验证已过期，请重新获取验证码再注销' : '注销失败：' + (reason || fnErr.message));
        return;
    }
    void showToast('账号已注销');
    await logout();
}
</script>

<style scoped>
.profile {
  display: grid;
  grid-template-columns: 76px 1fr;
  align-items: center;
  gap: 14px;
  padding: 6px 4px 16px;
}
.ava { border: 0; background: transparent; padding: 0; width: 76px; height: 76px; }
.who { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.line1 { display: flex; align-items: center; gap: 8px; min-width: 0; }
.name { margin: 0; font-size: 24px; font-weight: 650; line-height: 1.2; letter-spacing: -.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.handle { margin: 0; font-size: 13px; color: var(--md-on-surface-variant); }
.id {
  align-self: flex-start;
  display: inline-flex; align-items: center; gap: 5px;
  margin-top: 1px; padding: 0; border: 0; background: transparent;
  color: var(--md-on-surface-variant); font-size: 12px;
}
.id ion-icon { font-size: 13px; opacity: .8; }

.ttl { padding: 1px 7px; border-radius: 8px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,.18); line-height: 1.6; }

.acts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0 0 18px; }
.acts button {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px;
  padding: 14px 6px; border: 0; border-radius: 18px;
  background: var(--md-surface-container); color: var(--md-on-surface); font-size: 13px;
}
.acts ion-icon { font-size: 22px; }

.sheet-mask {
  position: fixed; inset: 0; z-index: 9990;
  background: rgba(0, 0, 0, .42);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  display: flex; align-items: flex-end;
}
.sheet {
  width: 100%; max-height: 86vh; overflow: auto;
  border-radius: 26px 26px 0 0;
  padding: 12px 10px calc(18px + var(--ion-safe-area-bottom, 0px));
  background: var(--md-surface-container-high); color: var(--md-on-surface);
}
.sheet-head { display: flex; align-items: center; gap: 8px; padding: 4px 10px 10px; }
.sheet-head h3 { margin: 0; flex: 1; font-size: 18px; }
.sheet-head .x { border: 0; background: transparent; color: var(--md-on-surface-variant); font-size: 17px; padding: 4px 6px; }
.sheet-head .x.back { font-size: 22px; line-height: 1; }

.sec { margin: 14px 12px 6px; font-size: 12px; font-weight: 600; letter-spacing: .04em; color: var(--md-on-surface-variant); }

.item {
  display: grid;
  grid-template-columns: 22px 1fr auto 16px;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 52px;
  padding: 10px 12px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--md-on-surface);
  font-size: 15px;
  text-align: left;
}
.item.static { grid-template-columns: 22px 1fr auto; }
.item ion-icon { font-size: 20px; color: var(--md-on-surface-variant); }
.item .grow { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item .val { font-size: 13px; color: var(--md-on-surface-variant); text-align: right; white-space: nowrap; }
.item .chev { font-size: 16px; opacity: .55; }
.item .ctl { justify-self: end; display: flex; align-items: center; }
.item:active { background: rgba(127,127,127,.12); }
.item + .item { margin-top: 2px; }

.tip { margin: 2px 14px 10px; font-size: 12px; line-height: 1.5; color: var(--md-on-surface-variant); }

.danger-zone {
  margin: 18px 0 6px;
  padding-top: 12px;
  border-top: 1px solid rgba(127,127,127,.16);
}
.item.danger, .item.danger ion-icon { color: #e5484d; }
</style>
