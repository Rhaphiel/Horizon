import { APP_VERSION } from '@/stores/settings';

// 检查 GitHub 上有没有比当前更新的 Release。
// 只在用户已登录、且距上次检查超过 6 小时时才真正发请求，避免每次启动都打 GitHub API。
const REPO = 'Rhaphiel/Horizon';
const CACHE_KEY = 'hz:update-checked';
const INTERVAL = 6 * 60 * 60 * 1000;

export interface ReleaseInfo {
  version: string;   // 例如 0.4.0
  body: string;      // Release 正文（更新内容）
  url: string;       // 下载地址：优先 APK，其次发布页
  page: string;      // 发布页地址
}

type GhRelease = {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
  published_at?: string;
  assets?: { name?: string; browser_download_url?: string }[];
};

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

/**
 * 注意：这里用 /releases?per_page=N 而不是 /releases/latest。
 * 原因：/releases/latest 会**跳过预发布（Pre-release）**，
 * 而 Horizon 的版本都是勾了 Pre-release 的，用它永远拿不到新版本。
 */
export async function checkUpdate(force = false): Promise<ReleaseInfo | null> {
  const last = Number(localStorage.getItem(CACHE_KEY) || 0);
  if (!force && Date.now() - last < INTERVAL) return null;
  localStorage.setItem(CACHE_KEY, String(Date.now()));

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;

    const list = (await res.json()) as GhRelease[];
    if (!Array.isArray(list) || !list.length) return null;

    // 跳过草稿，取「版本号最大」的那个（列表按时间倒序，但保险起见都看一遍）
    let best: { rel: GhRelease; version: string } | null = null;
    for (const rel of list) {
      if (rel.draft) continue;
      const m = /v?(\d+\.\d+\.\d+)/.exec(rel.tag_name || rel.name || '');
      if (!m) continue;
      if (!best || isNewer(m[1], best.version)) best = { rel, version: m[1] };
    }
    if (!best) return null;
    if (!isNewer(best.version, APP_VERSION)) return null;

    const page = best.rel.html_url || `https://github.com/${REPO}/releases`;
    const apk = (best.rel.assets || []).find(a => (a.name || '').toLowerCase().endsWith('.apk'));

    return {
      version: best.version,
      body: (best.rel.body || '').trim(),
      url: apk?.browser_download_url || page,
      page,
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
