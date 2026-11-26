import { ref } from 'vue';
const NOTIFY_KEY = 'horizon:notify';
export const notifyOn = ref(localStorage.getItem(NOTIFY_KEY) !== '0');
export function persistNotify(on: boolean): void {
    notifyOn.value = on;
    localStorage.setItem(NOTIFY_KEY, on ? '1' : '0');
}
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
