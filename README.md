# Horizon

Vue 3 + Ionic + TypeScript + Vite，Capacitor 8 打包安卓，Supabase 做后端。

> 只是想用？装 APK 即可，下面的内容不用看。

## 本地开发

```powershell
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # 类型检查
npm run build      # 构建到 dist/
```

## 发版

推 `main` → GitHub Actions 自动打包 → Actions 页下载 `horizon-apk`。

- 版本号：只改 `package.json` 的 `version`
- 仓库 Secret：`GOOGLE_SERVICES_JSON_BASE64`（Firebase 配置）

## 后端（只需配一次）

1. 按顺序执行 `supabase/migrations/`（幂等）
2. 部署函数：`tools\setup-push.cmd`（推送）、`supabase functions deploy login-by-username`（用户名登录）
3. 建 Webhook：`messages` INSERT → `push-message`，带 `x-push-webhook-secret` 头
4. 自检：`tools\check-push.cmd`

## 不要提交这些

`google-services.json`、`service-account.json`、`tools/push-secret.txt`、`tools/supabase.exe`、`supabase/migrations/202611220002_push_trigger.sql`、`.env`、`*.apk`、`node_modules/`、`dist/`、`android/`

## 已知限制

1. 华为 / HarmonyOS 5+ 装不了 APK
2. 国产 ROM 需开「自启动 / 后台运行」，否则推送受限
3. 消息明文存库（无端到端加密）

## 文档

- `docs/DEVLOG-*.md`：各版本改了什么
- `docs/文案索引.md`：所有界面文字的位置
- `docs/PUSH-*.md`、`docs/NOTIFY-*.md`：推送与通知
