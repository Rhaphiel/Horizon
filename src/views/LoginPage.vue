<template>
  <ion-page>
    <ion-content class="ion-padding">
      <div class="wrap">
        <h1>Horizon</h1>

        <ion-segment v-model="mode">
          <ion-segment-button value="login"><ion-label>登录</ion-label></ion-segment-button>
          <ion-segment-button value="register"><ion-label>注册</ion-label></ion-segment-button>
        </ion-segment>

        <!-- 登录：用户名或邮箱都可以 -->
        <template v-if="mode === 'login'">
          <ion-input
            v-model="identifier"
            class="m3-field"
            fill="outline"
            label="账号名 / HorizonID / 邮箱"
            label-placement="floating"
            autocomplete="username"
            autocapitalize="off"
            autocorrect="off"
            :spellcheck="false"
          />
        </template>

        <!-- 注册：用户名 + 邮箱 -->
        <template v-else>
          <ion-input
            v-model="username"
            class="m3-field"
            fill="outline"
            label="用户名（2–20 个字符，支持汉字 / 假名 / 字母）"
            label-placement="floating"
            :maxlength="20"
            autocomplete="username"
            autocapitalize="off"
          />
          <ion-input v-model="email" class="m3-field" fill="outline" label="邮箱" label-placement="floating" type="email" autocomplete="email" />
          <ion-input
            v-if="regStep === 'code'"
            v-model="code"
            class="m3-field"
            fill="outline"
            label="邮箱验证码（6 位）"
            label-placement="floating"
            inputmode="numeric"
            :maxlength="6"
            autocomplete="one-time-code"
          />
        </template>

        <ion-input
          v-model="password"
          class="m3-field"
          fill="outline"
          :label="mode === 'login' ? '密码' : '密码（至少 6 位）'"
          label-placement="floating"
          :type="showPwd ? 'text' : 'password'"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          @keyup.enter="submit"
        >
          <!-- 眼睛按钮：看清输错没有 -->
          <ion-button
            slot="end"
            fill="clear"
            class="eye"
            :aria-label="showPwd ? '隐藏密码' : '显示密码'"
            @click="showPwd = !showPwd"
          >
            <ion-icon slot="icon-only" :icon="showPwd ? eyeOff : eye" />
          </ion-button>
        </ion-input>

        <ion-button expand="block" size="large" :disabled="busy" @click="submit">{{ mode === 'login' ? '登录' : (regStep === 'code' ? '验证并完成注册' : '发送验证码并注册') }}</ion-button>
        <button v-if="mode === 'login'" class="link" type="button" @click="forgot">忘记密码？</button>
        <p v-if="msg" :class="['msg', { ok: msgOk }]">{{ msg }}</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonPage, IonContent, IonSegment, IonSegmentButton, IonLabel, IonInput, IonButton, IonIcon, alertController } from '@ionic/vue';
import { eye, eyeOff } from 'ionicons/icons';
import { db } from '@/lib/supabase';
import { friendlyAuthError } from '@/lib/errors';

const mode = ref<'login' | 'register'>('login');
const identifier = ref('');   // 登录用：用户名或邮箱
const username = ref('');     // 注册用
const email = ref('');        // 注册用
const password = ref('');
const showPwd = ref(false);   // 眼睛：临时显示密码
const code = ref('');
const regStep = ref<'form' | 'code'>('form');
const busy = ref(false);
const msg = ref('');
const msgOk = ref(false);

watch(mode, () => {
  msg.value = '';
});

function say(text: string, ok = false): void {
  msg.value = text;
  msgOk.value = ok;
}

// 用用户名登录：调用服务端函数（它在服务器上查出邮箱再登录，邮箱不会返回给手机）
async function loginWithUsername(name: string, pwd: string): Promise<string | null> {
  const { data, error } = await db.functions.invoke('login-by-username', { body: { username: name, password: pwd } });
  if (error) {
    const status = (error as { context?: Response }).context?.status;
    if (status === 404) return '用户名登录功能还没有部署到服务器，请先用邮箱登录（部署方法见 README）';
    if (status === 429) return '尝试太频繁，请稍后再试';
    if (status === 401) return '用户名或密码不正确';
    if (error.name === 'FunctionsFetchError') {
      // 跨域时若服务端函数不存在（404 且无 CORS 头），浏览器会把请求判为“网络错误”，
      // 所以这里把两种可能都写出来，避免误以为是网络/VPN 问题。
      return '连不上登录服务：可能是「登录函数尚未部署」，也可能是网络/代理拦截。先用邮箱登录试试，再看 README 的部署章节';
    }
    return '登录失败，请稍后再试';
  }
  const s = (data as { session?: { access_token?: string; refresh_token?: string } } | null)?.session;
  if (!s?.access_token || !s.refresh_token) return '用户名或密码不正确';
  const { error: e2 } = await db.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  return e2 ? friendlyAuthError(e2.message) : null;
}

// 忘记密码：发验证码 → 输入验证码 + 新密码
async function forgot(): Promise<void> {
  const first = await alertController.create({
    header: '重置密码',
    message: '输入注册时用的邮箱，我们会发 6 位验证码',
    inputs: [{ name: 'mail', type: 'email', value: email.value || '', placeholder: '邮箱' }],
    buttons: [
      { text: '取消', role: 'cancel' },
      { text: '发送验证码', handler: (d) => { void sendResetCode(String(d?.mail ?? '')); } },
    ],
  });
  await first.present();
}

async function sendResetCode(mail: string): Promise<void> {
  const m = mail.trim();
  if (!m) { say('请填写邮箱'); return; }
  const { error } = await db.auth.signInWithOtp({ email: m, options: { shouldCreateUser: false } });
  if (error) { say('发送失败：' + error.message); return; }

  const second = await alertController.create({
    header: '输入验证码',
    message: '验证码已发送到 ' + m + '，请填写验证码和新密码',
    inputs: [
      { name: 'code', type: 'tel', placeholder: '6 位验证码' },
      { name: 'pwd', type: 'password', placeholder: '新密码（至少 6 位）' },
    ],
    buttons: [
      { text: '取消', role: 'cancel' },
      { text: '重置', handler: (d) => { void doReset(m, String(d?.code ?? ''), String(d?.pwd ?? '')); } },
    ],
  });
  await second.present();
}

async function doReset(mail: string, codeText: string, pwd: string): Promise<void> {
  if (!codeText.trim() || pwd.length < 6) { say('请填写验证码和至少 6 位的新密码'); return; }
  const { error: vErr } = await db.auth.verifyOtp({ email: mail, token: codeText.trim(), type: 'email' });
  if (vErr) { say('验证码不正确：' + vErr.message); return; }
  const { error: uErr } = await db.auth.updateUser({ password: pwd });
  if (uErr) { say('修改密码失败：' + uErr.message); return; }
  say('密码已重置，请用新密码登录', true);
}

async function submit(): Promise<void> {
  const pwd = password.value ?? '';
  busy.value = true;
  say('请稍候…', true);
  try {
    if (mode.value === 'register') {
      const name = (username.value ?? '').trim();
      const mail = (email.value ?? '').trim();

      // 第二步：校验验证码
      if (regStep.value === 'code') {
        if (!code.value.trim()) return say('请输入邮箱验证码');
        const { error } = await db.auth.verifyOtp({ email: mail, token: code.value.trim(), type: 'signup' });
        if (error) return say(friendlyAuthError(error.message));
        say('注册成功，正在进入…', true);
        return;
      }

      // 第一步：发验证码
      if (!mail || !pwd) return say('请填写邮箱和密码');
      if (!(name.length >= 2 && name.length <= 20)) return say('用户名需为 2–20 个字符');
      if (pwd.length < 6) return say('密码至少 6 位');
      const { data, error } = await db.auth.signUp({ email: mail, password: pwd, options: { data: { username: name } } });
      if (error) return say(friendlyAuthError(error.message));
      if (data.session) { say('注册成功，正在进入…', true); return; }
      regStep.value = 'code';
      return say('验证码已发送到邮箱，请填写下面的 6 位数字', true);
    } else {
      const id = (identifier.value ?? '').trim();
      if (!id || !pwd) return say('请填写 HorizonID（或邮箱）和密码');
  if (!id.includes('@') && !/^[0-9]{5,}$/.test(id) && !/^[A-Za-z0-9_]{3,20}$/.test(id)) return say('请使用账号名、HorizonID 或邮箱登录');
      if (id.includes('@')) {
        const { error } = await db.auth.signInWithPassword({ email: id, password: pwd });
        if (error) return say(friendlyAuthError(error.message));
      } else {
        const err = await loginWithUsername(id, pwd);
        if (err) return say(err);
      }
    }
    // 登录成功后，页面会由 lifecycle 自动跳转到主页
  } catch {
    say('网络出错，请检查网络（是否开了 VPN）后重试');
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.wrap { max-width: 420px; margin: 0 auto; padding-top: 64px; display: flex; flex-direction: column; gap: 18px; }
h1 { font-size: 32px; font-weight: 500; margin: 0 0 8px; color: var(--md-primary); }
.msg { margin: 0; font-size: 13px; color: var(--md-error); }
.msg.ok { color: var(--md-primary); }
/* 密码框右侧的眼睛按钮 */
.eye {
  --padding-start: 4px;
  --padding-end: 4px;
  margin-inline-end: -6px;
  color: var(--md-on-surface-variant);
}
.link { align-self: center; margin-top: 2px; border: 0; background: transparent; color: var(--md-primary); font-size: 14px; }
</style>
