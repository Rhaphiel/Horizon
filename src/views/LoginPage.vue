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
            label="用户名或邮箱"
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
            label="用户名（3–20 位，字母、数字或下划线）"
            label-placement="floating"
            maxlength="20"
            autocomplete="username"
            autocapitalize="off"
          />
          <ion-input v-model="email" class="m3-field" fill="outline" label="邮箱" label-placement="floating" type="email" autocomplete="email" />
        </template>

        <ion-input
          v-model="password"
          class="m3-field"
          fill="outline"
          label="密码（至少 6 位）"
          label-placement="floating"
          type="password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          @keyup.enter="submit"
        />

        <ion-button expand="block" size="large" :disabled="busy" @click="submit">{{ mode === 'login' ? '登录' : '注册' }}</ion-button>
        <p v-if="msg" :class="['msg', { ok: msgOk }]">{{ msg }}</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonPage, IonContent, IonSegment, IonSegmentButton, IonLabel, IonInput, IonButton } from '@ionic/vue';
import { db } from '@/lib/supabase';
import { friendlyAuthError } from '@/lib/errors';

const mode = ref<'login' | 'register'>('login');
const identifier = ref('');   // 登录用：用户名或邮箱
const username = ref('');     // 注册用
const email = ref('');        // 注册用
const password = ref('');
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
    if (error.name === 'FunctionsFetchError') return '网络连接失败，请检查网络（是否开了 VPN）';
    return '登录失败，请稍后再试';
  }
  const s = (data as { session?: { access_token?: string; refresh_token?: string } } | null)?.session;
  if (!s?.access_token || !s.refresh_token) return '用户名或密码不正确';
  const { error: e2 } = await db.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  return e2 ? friendlyAuthError(e2.message) : null;
}

async function submit(): Promise<void> {
  const pwd = password.value ?? '';
  busy.value = true;
  say('请稍候…', true);
  try {
    if (mode.value === 'register') {
      const name = (username.value ?? '').trim();
      const mail = (email.value ?? '').trim();
      if (!mail || !pwd) return say('请填写邮箱和密码');
      if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return say('用户名需为 3–20 位字母、数字或下划线');
      const { data, error } = await db.auth.signUp({ email: mail, password: pwd, options: { data: { username: name } } });
      if (error) return say(friendlyAuthError(error.message));
      if (!data.session) return say('注册成功，请先到邮箱点击确认链接，再回来登录', true);
    } else {
      const id = (identifier.value ?? '').trim();
      if (!id || !pwd) return say('请填写用户名（或邮箱）和密码');
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
</style>
