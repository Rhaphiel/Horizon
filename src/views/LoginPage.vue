<template>
  <ion-page>
    <ion-content class="ion-padding">
      <div class="wrap">
        <h1>Horizon</h1>

        <ion-segment v-model="mode">
          <ion-segment-button value="login"><ion-label>登录</ion-label></ion-segment-button>
          <ion-segment-button value="register"><ion-label>注册</ion-label></ion-segment-button>
        </ion-segment>

        <ion-input
          v-if="mode === 'register'"
          v-model="username"
          label="用户名（3–20 位，字母、数字或下划线）"
          label-placement="stacked"
          maxlength="20"
          autocomplete="username"
        />
        <ion-input v-model="email" label="邮箱" label-placement="stacked" type="email" autocomplete="email" />
        <ion-input
          v-model="password"
          label="密码（至少 6 位）"
          label-placement="stacked"
          type="password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          @keyup.enter="submit"
        />

        <ion-button expand="block" :disabled="busy" @click="submit">{{ mode === 'login' ? '登录' : '注册' }}</ion-button>
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
const username = ref('');
const email = ref('');
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

async function submit(): Promise<void> {
  const mail = (email.value ?? '').trim();
  const pwd = password.value ?? '';
  const name = (username.value ?? '').trim();
  if (!mail || !pwd) return say('请填写邮箱和密码');

  busy.value = true;
  say('请稍候…', true);
  try {
    if (mode.value === 'register') {
      if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return say('用户名需为 3–20 位字母、数字或下划线');
      const { data, error } = await db.auth.signUp({ email: mail, password: pwd, options: { data: { username: name } } });
      if (error) return say(friendlyAuthError(error.message));
      if (!data.session) return say('注册成功，请先到邮箱点击确认链接，再回来登录', true);
    } else {
      const { error } = await db.auth.signInWithPassword({ email: mail, password: pwd });
      if (error) return say(friendlyAuthError(error.message));
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
.wrap { max-width: 420px; margin: 0 auto; padding-top: 48px; display: flex; flex-direction: column; gap: 16px; }
h1 { font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 8px; }
.msg { margin: 0; font-size: 13px; color: var(--ion-color-danger); }
.msg.ok { color: var(--ion-color-success); }
</style>
