import { APP_VERSION } from '@/stores/settings';

// 检查 GitHub 上有没有比当前更新的 Release。
// 只在用户已登录、且距上次检查超过 6 小时时才真正发请求，避免每次启动都打 GitHub API。
const REPO = 'Rhaphiel/Horizon';
const CACHE_KEY = 'hz:update-checked';
const INTERVAL = 6 * 60 * 60 * 1000;

export interface ReleaseInfo {
  version: string;   // 例如 0.3.0
  body: string;      // Release 正文（更新内容）
  url: string;       // 发布页地址
}

function parts(v: string): number[] {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}

function isNewer(a: string, b: string): boolean {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i += 1) {
    if (x[i] > y[i]) return true;
    if (x[i] < y[i]) return false;
  }
  return false;
}

export async function checkUpdate(force = false): Promise<ReleaseInfo | null> {
  const last = Number(localStorage.getItem(CACHE_KEY) || 0);
  if (!force && Date.now() - last < INTERVAL) return null;
  localStorage.setItem(CACHE_KEY, String(Date.now()));

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { tag_name?: string; body?: string; html_url?: string };
    const tag = j.tag_name || '';
    // 你的 tag 形如 Horizon-v0.3.0，取出版本号
    const m = /v?(\d+\.\d+\.\d+)/.exec(tag);
    const version = m ? m[1] : '';
    if (!version) return null;
    if (!isNewer(version, APP_VERSION)) return null;
    return {
      version,
      body: (j.body || '').trim(),
      url: j.html_url || `https://github.com/${REPO}/releases`,
    };
  } catch {
    return null;   // 网络不通就不打扰用户
  }
}

// 打开外部链接：WebView 里 window.open 常常被拦，退回 location
export function openRelease(url: string): void {
  const win = window.open(url, '_blank');
  if (!win) window.location.href = url;
}
