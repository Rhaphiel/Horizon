<template>
  <Teleport to="body">
    <div v-if="open" class="hm-mask">
      <div class="hm-card">
        <h2>设置账号名</h2>
        <p class="hm-sub">账号名用于登录和展示，<b>设置后不可更改</b>。3–20 位，只能用大小写字母 / 数字 / 下划线。</p>
        <input v-model="value" class="hm-input" maxlength="20" placeholder="@yourname" autocapitalize="off" autocorrect="off" />
        <p v-if="err" class="hm-err">{{ err }}</p>
        <div class="hm-actions">
          <button type="button" class="primary" :disabled="busy" @click="submit">确定</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">import { ref } from 'vue';
import { db } from '@/lib/supabase';
const props = defineProps<{
    open: boolean;
}>();
const emit = defineEmits<{
    done: [
        handle: string
    ];
}>();
const value = ref('');
const busy = ref(false);
const err = ref('');
async function submit(): Promise<void> {
    const h = value.value.trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9_]{3,20}$/.test(h)) {
        err.value = '需要 3–20 位大小写字母、数字或下划线';
        return;
    }
    busy.value = true;
    const { error } = await db.rpc('set_handle', { new_handle: h });
    busy.value = false;
    if (error) {
        if (error.message.includes('handle_locked')) {
            emit('done', '');
            return;
        }
        const m = error.message.includes('handle_taken') ? '这个账号名已经被占用'
            : error.message.includes('handle_locked') ? '账号名一旦设置就不能再改'
                : error.message.includes('invalid_handle') ? '格式不对：3–20 位字母、数字或下划线'
                    : error.message;
        err.value = m;
        return;
    }
    emit('done', h.toLowerCase());
}
</script>

<style scoped>
.hm-mask {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(0, 0, 0, .55);
  display: grid; place-items: center; padding: 22px;
}
.hm-card {
  width: min(92vw, 380px);
  border-radius: 22px;
  padding: 20px;
  background: var(--md-surface-container-high);
  color: var(--md-on-surface);
  display: flex; flex-direction: column; gap: 10px;
}
.hm-card h2 { margin: 0; font-size: 19px; }
.hm-sub { margin: 0; font-size: 12px; line-height: 1.6; color: var(--md-on-surface-variant); }
.hm-input {
  margin-top: 4px; padding: 11px 12px; border-radius: 12px;
  border: 1px solid var(--md-outline); background: transparent;
  color: var(--md-on-surface); font-size: 16px;
}
.hm-err { margin: 0; font-size: 12px; color: var(--md-error); }
.hm-actions { display: flex; justify-content: flex-end; margin-top: 6px; }
.hm-actions .primary {
  border: 0; border-radius: 12px; padding: 10px 20px;
  background: var(--md-primary); color: var(--md-on-primary); font-size: 15px;
}
</style>
