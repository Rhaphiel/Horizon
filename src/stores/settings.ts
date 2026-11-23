import { ref } from 'vue';

const NOTIFY_KEY = 'horizon:notify';

// 通知开关（保存在手机本地）
export const notifyOn = ref(localStorage.getItem(NOTIFY_KEY) !== '0');

export function persistNotify(on: boolean): void {
  notifyOn.value = on;
  localStorage.setItem(NOTIFY_KEY, on ? '1' : '0');
}

// 版本号来自 package.json（构建时注入）
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
