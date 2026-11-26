import { APP_VERSION } from '@/stores/settings';
const REPO = 'Rhaphiel/Horizon';
const CACHE_KEY = 'hz:update-checked';
const INTERVAL = 6 * 60 * 60 * 1000;
const RETRY_AFTER_FAIL = 30 * 60 * 1000;
export interface ReleaseInfo {
    version: string;
    body: string;
    url: string;
    page: string;
}
type GhRelease = {
    tag_name?: string;
    name?: string;
    body?: string;
    html_url?: string;
    draft?: boolean;
    prerelease?: boolean;
    published_at?: string;
    assets?: {
        name?: string;
        browser_download_url?: string;
    }[];
};
function parts(v: string): number[] {
    const m = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(v);
    if (!m)
        return [0, 0, 0];
    return [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)];
}
function normalize(v: string): string {
    const p = parts(v);
    return p.join('.');
}
function isNewer(a: string, b: string): boolean {
    const x = parts(a);
    const y = parts(b);
    for (let i = 0; i < 3; i += 1) {
        if (x[i] > y[i])
            return true;
        if (x[i] < y[i])
            return false;
    }
    return false;
}
export async function checkUpdate(force = false): Promise<ReleaseInfo | null> {
    const last = Number(localStorage.getItem(CACHE_KEY) || 0);
    if (!force && Date.now() - last < INTERVAL)
        return null;
    localStorage.setItem(CACHE_KEY, String(Date.now() - INTERVAL + RETRY_AFTER_FAIL));
    try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
            headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok)
            return null;
        localStorage.setItem(CACHE_KEY, String(Date.now()));
        const list = (await res.json()) as GhRelease[];
        if (!Array.isArray(list) || !list.length)
            return null;
        let best: {
            rel: GhRelease;
            version: string;
        } | null = null;
        for (const rel of list) {
            if (rel.draft)
                continue;
            const m = /v?(\d+\.\d+(?:\.\d+)?)/.exec(rel.tag_name || rel.name || '');
            if (!m)
                continue;
            const version = normalize(m[1]);
            if (!best || isNewer(version, best.version))
                best = { rel, version };
        }
        if (!best)
            return null;
        if (!isNewer(best.version, APP_VERSION))
            return null;
        const page = best.rel.html_url || `https://github.com/${REPO}/releases`;
        const apk = (best.rel.assets || []).find(a => (a.name || '').toLowerCase().endsWith('.apk'));
        return {
            version: best.version,
            body: (best.rel.body || '').trim(),
            url: apk?.browser_download_url || page,
            page,
        };
    }
    catch {
        return null;
    }
}
export function openRelease(url: string): void {
    const win = window.open(url, '_blank');
    if (!win)
        window.location.href = url;
}
