export type RGB = [
    number,
    number,
    number
];
export const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));
export function hexToRgb(hex: string): RGB {
    let h = hex.replace('#', '').trim();
    if (h.length === 3)
        h = h.split('').map(c => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    if (!Number.isFinite(n))
        return [0, 0, 0];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (c: RGB): string => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const toLin = (v: number): number => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};
const fromLin = (v: number): number => {
    const x = clamp(v, 0, 1);
    return 255 * (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
};
export function luminance(c: RGB): number {
    const [r, g, b] = c.map(toLin);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
    const la = luminance(hexToRgb(a));
    const lb = luminance(hexToRgb(b));
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
}
export function readableOn(bg: string, preferred: string, min = 4.5): string {
    if (contrast(bg, preferred) >= min)
        return preferred;
    return contrast(bg, '#000000') >= contrast(bg, '#ffffff') ? '#000000' : '#ffffff';
}
export function mix(a: string, b: string, t: number): string {
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
export function rgba(hex: string, alpha: number): string {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}
export const triplet = (hex: string): string => hexToRgb(hex).join(', ');
type V3 = [
    number,
    number,
    number
];
function linToOklab(r: number, g: number, b: number): V3 {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
}
function oklabToLin(L: number, a: number, b: number): V3 {
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
}
export function hexToOklch(hex: string): {
    L: number;
    c: number;
    h: number;
} {
    const [r, g, b] = hexToRgb(hex).map(toLin);
    const [L, a, bb] = linToOklab(r, g, b);
    const c = Math.hypot(a, bb);
    const h = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
    return { L, c, h };
}
const inGamut = (v: V3): boolean => v.every(x => x >= -0.0005 && x <= 1.0005);
const lstarToY = (t: number): number => (t > 8 ? Math.pow((t + 16) / 116, 3) : t / 903.2962963);
export function toneColor(hue: number, chroma: number, tone: number): string {
    if (tone <= 0)
        return '#000000';
    if (tone >= 100)
        return '#ffffff';
    const target = lstarToY(tone);
    const rad = (hue * Math.PI) / 180;
    const ca = Math.cos(rad);
    const sa = Math.sin(rad);
    const at = (L: number): V3 => {
        const full = oklabToLin(L, ca * chroma, sa * chroma);
        if (inGamut(full))
            return full;
        let lo = 0;
        let hi = chroma;
        for (let i = 0; i < 18; i++) {
            const mid = (lo + hi) / 2;
            if (inGamut(oklabToLin(L, ca * mid, sa * mid)))
                lo = mid;
            else
                hi = mid;
        }
        return oklabToLin(L, ca * lo, sa * lo);
    };
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 26; i++) {
        const mid = (lo + hi) / 2;
        const [r, g, b] = at(mid).map(v => clamp(v, 0, 1));
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (y < target)
            lo = mid;
        else
            hi = mid;
    }
    const lin = at((lo + hi) / 2);
    return rgbToHex(lin.map(fromLin) as RGB);
}
export interface Scheme {
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    secondary: string;
    onSecondary: string;
    secondaryContainer: string;
    onSecondaryContainer: string;
    tertiary: string;
    onTertiary: string;
    tertiaryContainer: string;
    onTertiaryContainer: string;
    error: string;
    onError: string;
    errorContainer: string;
    onErrorContainer: string;
    surface: string;
    onSurface: string;
    surfaceVariant: string;
    onSurfaceVariant: string;
    outline: string;
    outlineVariant: string;
    surfaceContainerLowest: string;
    surfaceContainerLow: string;
    surfaceContainer: string;
    surfaceContainerHigh: string;
    surfaceContainerHighest: string;
    inverseSurface: string;
    inverseOnSurface: string;
    inversePrimary: string;
}
export function makeScheme(seedHex: string, dark: boolean): Scheme {
    const seed = hexToOklch(seedHex);
    const gray = seed.c < 0.02;
    const h = gray ? 260 : seed.h;
    const pc = gray ? 0.008 : clamp(seed.c, 0.12, 0.22);
    const P = (t: number) => toneColor(h, pc, t);
    const S = (t: number) => toneColor(h, gray ? 0.006 : 0.045, t);
    const T = (t: number) => toneColor((h + 60) % 360, gray ? 0.008 : 0.07, t);
    const N = (t: number) => toneColor(h, 0.008, t);
    const NV = (t: number) => toneColor(h, 0.016, t);
    const E = (t: number) => toneColor(28, 0.2, t);
    if (!dark) {
        return {
            primary: P(40), onPrimary: P(100), primaryContainer: P(90), onPrimaryContainer: P(10),
            secondary: S(40), onSecondary: S(100), secondaryContainer: S(90), onSecondaryContainer: S(10),
            tertiary: T(40), onTertiary: T(100), tertiaryContainer: T(90), onTertiaryContainer: T(10),
            error: E(40), onError: E(100), errorContainer: E(90), onErrorContainer: E(10),
            surface: N(98), onSurface: N(10), surfaceVariant: NV(90), onSurfaceVariant: NV(30),
            outline: NV(50), outlineVariant: NV(80),
            surfaceContainerLowest: N(100), surfaceContainerLow: N(96), surfaceContainer: N(94),
            surfaceContainerHigh: N(92), surfaceContainerHighest: N(90),
            inverseSurface: N(20), inverseOnSurface: N(95), inversePrimary: P(80),
        };
    }
    return {
        primary: P(80), onPrimary: P(20), primaryContainer: P(30), onPrimaryContainer: P(90),
        secondary: S(80), onSecondary: S(20), secondaryContainer: S(30), onSecondaryContainer: S(90),
        tertiary: T(80), onTertiary: T(20), tertiaryContainer: T(30), onTertiaryContainer: T(90),
        error: E(80), onError: E(20), errorContainer: E(30), onErrorContainer: E(90),
        surface: N(6), onSurface: N(90), surfaceVariant: NV(30), onSurfaceVariant: NV(80),
        outline: NV(60), outlineVariant: NV(30),
        surfaceContainerLowest: N(4), surfaceContainerLow: N(10), surfaceContainer: N(12),
        surfaceContainerHigh: N(17), surfaceContainerHighest: N(22),
        inverseSurface: N(90), inverseOnSurface: N(20), inversePrimary: P(40),
    };
}
