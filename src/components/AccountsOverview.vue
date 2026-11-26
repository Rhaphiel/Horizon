<template>
  <Teleport to="body">
    <div v-if="open" class="ao-mask" @click.self="emit('close')">
      <div class="ao-card">
        <div class="ao-head">
          <h2>账号数据一览</h2>
          <button type="button" class="x" @click="emit('close')">✕</button>
        </div>

        <p v-if="loading" class="ao-hint">加载中…</p>
        <p v-else-if="err" class="ao-err">{{ err }}</p>
        <p v-else class="ao-hint">共 {{ rows.length }} 个账号 · 密码只保存哈希，任何人和后台都无法查看明文</p>

        <div class="ao-list">
          <div v-for="u in rows" :key="u.id" class="ao-row">
            <div class="line1">
              <b>{{ u.username }}</b>
              <span class="h">@{{ u.handle || '未设置' }}</span>
              <span class="id">ID {{ u.horizon_id ?? '—' }}</span>
            </div>
            <div class="line2">
              <span>{{ u.email || '（无邮箱）' }}</span>
            </div>
            <div class="line3">
              <span>注册 {{ fmt(u.registered_at) }}</span>
              <span>最近登录 {{ u.last_sign_in_at ? fmt(u.last_sign_in_at) : '从未' }}</span>
              <span :class="['st', { off: !u.id_searchable }]">{{ u.id_searchable ? 'ID 可搜' : 'ID 隐藏' }}</span>
            </div>
          </div>
        </div>

        <div class="ao-foot">
          <button type="button" class="refresh" :disabled="loading" @click="load">刷新</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">import { ref, watch } from 'vue';
import { db } from '@/lib/supabase';
const props = defineProps<{
    open: boolean;
}>();
const emit = defineEmits<{
    close: [
    ];
}>();
interface Row {
    id: string;
    horizon_id: number | null;
    username: string;
    handle: string | null;
    email: string | null;
    registered_at: string | null;
    last_sign_in_at: string | null;
    id_searchable: boolean;
}
const rows = ref<Row[]>([]);
const loading = ref(false);
const err = ref('');
function fmt(iso: string | null): string {
    if (!iso)
        return '—';
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
async function load(): Promise<void> {
    loading.value = true;
    err.value = '';
    const { data, error } = await db.functions.invoke('accounts-overview', { body: {} });
    loading.value = false;
    if (error) {
        err.value = '加载失败：' + error.message;
        return;
    }
    const payload = data as {
        users?: Row[];
        error?: string;
    } | null;
    if (payload?.error) {
        err.value = payload.error;
        return;
    }
    rows.value = payload?.users ?? [];
}
watch(() => props.open, v => {
    if (v)
        void load();
}, { immediate: true });
</script>

<style scoped>
.ao-mask { position: fixed; inset: 0; z-index: 99990; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: 16px; }
.ao-card {
  width: min(96vw, 560px); max-height: 86vh; display: flex; flex-direction: column;
  border-radius: 22px; overflow: hidden;
  background: var(--md-surface-container-high); color: var(--md-on-surface);
}
.ao-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px 8px; }
.ao-head h2 { margin: 0; font-size: 18px; }
.ao-head .x { border: 0; background: transparent; color: var(--md-on-surface-variant); font-size: 18px; }
.ao-hint { margin: 0 18px 8px; font-size: 12px; color: var(--md-on-surface-variant); }
.ao-err { margin: 0 18px 8px; font-size: 13px; color: var(--md-error); }
.ao-list { flex: 1; overflow: auto; padding: 4px 10px 10px; }
.ao-row { padding: 10px 8px; border-radius: 12px; }
.ao-row + .ao-row { border-top: 1px solid rgba(127,127,127,.12); }
.line1 { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.line1 b { font-size: 15px; }
.line1 .h { font-size: 13px; color: var(--md-primary); }
.line1 .id { margin-left: auto; font-size: 12px; color: var(--md-on-surface-variant); }
.line2 { margin-top: 2px; font-size: 13px; color: var(--md-on-surface-variant); word-break: break-all; }
.line3 { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px; font-size: 11px; color: var(--md-on-surface-variant); }
.line3 .st { color: #2e7d32; }
.line3 .st.off { color: #c62828; }
.ao-foot { display: flex; justify-content: flex-end; padding: 10px 16px 16px; }
.refresh { border: 0; border-radius: 12px; padding: 9px 18px; background: var(--md-primary); color: var(--md-on-primary); font-size: 14px; }
</style>
