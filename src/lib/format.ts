export const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const fmtDay = (iso: string): string => new Date(iso).toLocaleDateString();

export const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();

// 搜索用：把用户输入里的 \ % _ 转义，避免被当成通配符
export const likePattern = (kw: string): string => '%' + kw.replace(/[\\%_]/g, '\\$&') + '%';

// 截取关键词附近的一小段文字
export function makeSnippet(body: string, kw: string): string {
  const j = body.toLowerCase().indexOf(kw.toLowerCase());
  if (j < 0 || body.length <= 90) return body;
  const s = Math.max(0, j - 30);
  const e = Math.min(body.length, j + kw.length + 60);
  return (s > 0 ? '…' : '') + body.slice(s, e) + (e < body.length ? '…' : '');
}

// 把文字按关键词切成片段，命中的片段会加粗
export function highlightParts(text: string, kw: string): { text: string; hit: boolean }[] {
  if (!kw) return [{ text, hit: false }];
  const out: { text: string; hit: boolean }[] = [];
  const lower = text.toLowerCase();
  const k = kw.toLowerCase();
  let i = 0;
  for (;;) {
    const j = lower.indexOf(k, i);
    if (j < 0) {
      if (i < text.length) out.push({ text: text.slice(i), hit: false });
      break;
    }
    if (j > i) out.push({ text: text.slice(i, j), hit: false });
    out.push({ text: text.slice(j, j + kw.length), hit: true });
    i = j + kw.length;
  }
  return out;
}
