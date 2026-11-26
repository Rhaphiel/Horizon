// 去掉源码里的注释（.ts / .vue / .css / .html）
// 用法：node tools/strip-comments.mjs
// 说明：TS 部分用 TypeScript 官方 printer（removeComments），语义不变，只是重新排版。
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const targets = ['src', 'supabase/functions'];

function stripTs(code) {
  const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
  return printer.printFile(sf);
}

function stripCss(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '');
}

function stripHtmlComments(code) {
  return code.replace(/<!--[\s\S]*?-->/g, '');
}

function stripVue(code) {
  const noHtml = code.replace(/<!--[\\s\\S]*?-->/g, '');
  return noHtml.replace(/<(template|script|style)([^>]*)>([\s\S]*?)<\/\1>/g, (m, tag, attrs, body) => {
    if (tag === 'template') return `<template${attrs}>${stripHtmlComments(body)}</template>`;
    if (tag === 'script') return `<script${attrs}>${stripTs(body)}</script>`;
    if (tag === 'style') return `<style${attrs}>${stripCss(body)}</style>`;
    return m;
  });
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

let changed = 0;
for (const t of targets) {
  const dir = path.join(root, t);
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const ext = path.extname(file).toLowerCase();
    if (!['.ts', '.vue', '.css'].includes(ext)) continue;
    const before = fs.readFileSync(file, 'utf8');
    let after = before;
    if (ext === '.ts') after = stripTs(before);
    else if (ext === '.vue') after = stripVue(before);
    else after = stripCss(before);
    if (after !== before) {
      fs.writeFileSync(file, after, 'utf8');
      changed += 1;
    }
  }
}
console.log(`已处理文件：${changed}`);
