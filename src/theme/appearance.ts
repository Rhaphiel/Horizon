import { computed, reactive, ref, watchEffect } from 'vue';
import { clamp, contrast, makeScheme, mix, readableOn, rgba, triplet } from '@/theme/color';
import type { Scheme } from '@/theme/color';
export type ThemeMode = 'system' | 'light' | 'dark';
export type BgKind = 'none' | 'color' | 'image';
interface Prefs {
    mode: ThemeMode;
    seed: string;
    bgKind: BgKind;
    bgColor: string;
    bgOpacity: number;
    bgAvg: string;
}
const KEY = 'horizon:appearance';
const IMG_KEY = 'horizon:chat-bg-image';
export const SEED_PRESETS = ['#3b82c4', '#6750a4', '#0b8043', '#c2185b', '#e65100', '#00838f', '#5d4037', '#546e7a'];
export const BG_COLOR_PRESETS = ['#cfe3f7', '#e3d7f5', '#d5ecd4', '#f8d7e3', '#fde3c8', '#1d2733', '#2b2b2b', '#101418'];
const DEFAULTS: Prefs = { mode: 'system', seed: '#3b82c4', bgKind: 'none', bgColor: '#cfe3f7', bgOpacity: 100, bgAvg: '#808080' };
function safeGet(k: string): string {
    try {
        return localStorage.getItem(k) ?? '';
    }
    catch {
        return '';
    }
}
function loadPrefs(): Prefs {
    try {
        const raw = JSON.parse(safeGet(KEY) || '{}') as Partial<Prefs>;
        return { ...DEFAULTS, ...raw };
    }
    catch {
        return { ...DEFAULTS };
    }
}
export const appearance = reactive({ ...loadPrefs(), image: safeGet(IMG_KEY) });
function persist(): void {
    const { image: _image, ...prefs } = appearance;
    try {
        localStorage.setItem(KEY, JSON.stringify(prefs));
    }
    catch {
    }
}
const media = window.matchMedia('(prefers-color-scheme: dark)');
const systemDark = ref(media.matches);
media.addEventListener('change', e => {
    systemDark.value = e.matches;
});
export const isDark = computed(() => appearance.mode === 'dark' || (appearance.mode === 'system' && systemDark.value));
export const scheme = computed<Scheme>(() => makeScheme(appearance.seed, isDark.value));
const hasImage = (): boolean => appearance.bgKind === 'image' && !!appearance.image;
export const chatBackground = computed<string>(() => {
    const s = scheme.value.surface;
    const op = clamp(appearance.bgOpacity, 0, 100) / 100;
    if (appearance.bgKind === 'color')
        return mix(s, appearance.bgColor, op);
    if (hasImage()) {
        const veil = rgba(s, 1 - op);
        return `linear-gradient(${veil}, ${veil}), url("${appearance.image}") center / cover no-repeat, ${s}`;
    }
    return s;
});
const effectiveBg = computed<string>(() => {
    const s = scheme.value.surface;
    const op = clamp(appearance.bgOpacity, 0, 100) / 100;
    if (appearance.bgKind === 'color')
        return mix(s, appearance.bgColor, op);
    if (hasImage())
        return mix(s, appearance.bgAvg, op);
    return s;
});
type Pair = {
    bg: string;
    fg: string;
};
function pick(bg: string, cands: Pair[], min = 1.4): Pair {
    let best = cands[0];
    let bestK = 0;
    for (const c of cands) {
        const k = contrast(bg, c.bg);
        if (k >= min)
            return c;
        if (k > bestK) {
            best = c;
            bestK = k;
        }
    }
    return best;
}
export const bubbles = computed(() => {
    const s = scheme.value;
    const bg = effectiveBg.value;
    const incoming = pick(bg, [
        { bg: s.surfaceContainerHighest, fg: s.onSurface },
        { bg: s.secondaryContainer, fg: s.onSecondaryContainer },
        { bg: s.tertiaryContainer, fg: s.onTertiaryContainer },
        { bg: s.inverseSurface, fg: s.inverseOnSurface },
    ]);
    const outgoing = pick(bg, [
        { bg: s.primary, fg: s.onPrimary },
        { bg: s.primaryContainer, fg: s.onPrimaryContainer },
        { bg: s.inverseSurface, fg: s.inverseOnSurface },
    ].filter(c => c.bg !== incoming.bg));
    return {
        incoming: { bg: incoming.bg, fg: readableOn(incoming.bg, incoming.fg) },
        outgoing: { bg: outgoing.bg, fg: readableOn(outgoing.bg, outgoing.fg) },
    };
});
export const bubbleVars = computed<Record<string, string>>(() => {
    const b = bubbles.value;
    const s = scheme.value;
    return {
        '--in-bg': b.incoming.bg,
        '--in-fg': b.incoming.fg,
        '--out-bg': b.outgoing.bg,
        '--out-fg': b.outgoing.fg,
        '--in-bg2': mix(b.incoming.bg, s.tertiary, 0.34),
        '--out-bg2': mix(b.outgoing.bg, s.tertiaryContainer, 0.42),
        '--bubble-edge': rgba(isDark.value ? '#ffffff' : '#000000', 0.12),
        '--chat-bg': chatBackground.value,
        '--pill-bg': s.surfaceContainerHigh,
        '--pill-fg': s.onSurfaceVariant,
    };
});
function setIon(style: CSSStyleDeclaration, name: string, hex: string, on: string): void {
    style.setProperty(`--ion-color-${name}`, hex);
    style.setProperty(`--ion-color-${name}-rgb`, triplet(hex));
    style.setProperty(`--ion-color-${name}-contrast`, on);
    style.setProperty(`--ion-color-${name}-contrast-rgb`, triplet(on));
    style.setProperty(`--ion-color-${name}-shade`, mix(hex, '#000000', 0.12));
    style.setProperty(`--ion-color-${name}-tint`, mix(hex, '#ffffff', 0.12));
}
const kebab = (k: string): string => k.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
function applyScheme(s: Scheme, dark: boolean): void {
    const root = document.documentElement;
    const st = root.style;
    root.classList.toggle('ion-palette-dark', dark);
    st.colorScheme = dark ? 'dark' : 'light';
    (Object.keys(s) as (keyof Scheme)[]).forEach(k => st.setProperty(`--md-${kebab(k)}`, s[k]));
    st.setProperty('--ion-background-color', s.surface);
    st.setProperty('--ion-background-color-rgb', triplet(s.surface));
    st.setProperty('--ion-text-color', s.onSurface);
    st.setProperty('--ion-text-color-rgb', triplet(s.onSurface));
    for (let n = 50; n <= 950; n += 50) {
        st.setProperty(`--ion-color-step-${n}`, mix(s.surface, s.onSurface, n / 1000));
        st.setProperty(`--ion-text-color-step-${n}`, mix(s.onSurface, s.surface, n / 1000));
    }
    setIon(st, 'primary', s.primary, s.onPrimary);
    setIon(st, 'secondary', s.secondary, s.onSecondary);
    setIon(st, 'tertiary', s.tertiary, s.onTertiary);
    setIon(st, 'danger', s.error, s.onError);
    setIon(st, 'medium', s.onSurfaceVariant, s.surface);
    st.setProperty('--ion-toolbar-background', s.surface);
    st.setProperty('--ion-toolbar-color', s.onSurface);
    st.setProperty('--ion-item-background', 'transparent');
    st.setProperty('--ion-item-color', s.onSurface);
    st.setProperty('--ion-border-color', s.outlineVariant);
    st.setProperty('--ion-overlay-background-color', s.surfaceContainerHigh);
    st.setProperty('--ion-tab-bar-background', s.surfaceContainer);
    st.setProperty('--ion-tab-bar-color', s.onSurfaceVariant);
    st.setProperty('--ion-tab-bar-color-selected', s.onSurface);
}
export function initAppearance(): void {
    watchEffect(() => applyScheme(scheme.value, isDark.value));
    watchEffect(() => {
        void [appearance.mode, appearance.seed, appearance.bgKind, appearance.bgColor, appearance.bgOpacity, appearance.bgAvg];
        persist();
    });
}
export function resetAppearance(): void {
    Object.assign(appearance, DEFAULTS, { image: '' });
    try {
        localStorage.removeItem(IMG_KEY);
    }
    catch {
    }
}
export function removeChatImage(): void {
    appearance.image = '';
    if (appearance.bgKind === 'image')
        appearance.bgKind = 'none';
    try {
        localStorage.removeItem(IMG_KEY);
    }
    catch {
    }
}
export async function setChatImage(file: File): Promise<string | null> {
    let bmp: ImageBitmap;
    try {
        bmp = await createImageBitmap(file);
    }
    catch {
        return '无法读取这张图片，请换一张（支持 JPG / PNG / WebP）';
    }
    const MAX = 1280;
    const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k));
    const h = Math.max(1, Math.round(bmp.height * k));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    if (!ctx)
        return '当前环境不支持处理图片';
    ctx.drawImage(bmp, 0, 0, w, h);
    const url = cv.toDataURL('image/jpeg', 0.8);
    const sm = document.createElement('canvas');
    sm.width = 8;
    sm.height = 8;
    const sctx = sm.getContext('2d');
    let avg = '#808080';
    if (sctx) {
        sctx.drawImage(bmp, 0, 0, 8, 8);
        const d = sctx.getImageData(0, 0, 8, 8).data;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let i = 0; i < d.length; i += 4) {
            r += d[i];
            g += d[i + 1];
            b += d[i + 2];
        }
        const n = d.length / 4;
        const [rr, gg, bb] = [r / n, g / n, b / n].map(Math.round);
        avg = '#' + [rr, gg, bb].map(v => v.toString(16).padStart(2, '0')).join('');
    }
    bmp.close?.();
    try {
        localStorage.setItem(IMG_KEY, url);
    }
    catch {
        return '图片太大，保存失败，请换一张小一点的';
    }
    appearance.image = url;
    appearance.bgAvg = avg;
    appearance.bgKind = 'image';
    return null;
}
