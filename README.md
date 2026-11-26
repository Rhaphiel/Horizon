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
- 仓库 Secret：`GOOGLE_SERVICES_JSON_BASE64`（Firebase 配置）、`DEBUG_KEYSTORE_BASE64`（固定签名，不加的话每次装新版都会提示签名冲突）

## 后端（只需配一次）

1. 按顺序执行 `supabase/migrations/`（幂等）
   - `202611220002_push_trigger.sql` 里的 `PASTE_YOUR_WEBHOOK_SECRET_HERE` 是占位：先换成 `tools/push-secret.txt` 里的值（`setup-push` 会把同一个值设成函数的 `PUSH_WEBHOOK_SECRET`）再执行，否则推送会一直 401。它和第 3 步二选一
2. 部署函数：`tools\setup-push.cmd`（推送）、`supabase functions deploy login-by-username`（账号名 / HorizonID 登录）、`supabase functions deploy delete-account`（注销账号）、`supabase functions deploy cleanup-media`（媒体 24 小时清理，再按 `supabase/templates/media-cleanup-cron.sql.example` 建定时任务）
3. 建 Webhook：`messages` INSERT → `push-message`，带 `x-push-webhook-secret` 头（已用第 1 步的 push_trigger.sql 就不用再建）
4. 自检：`tools\check-push.cmd`

## 不要提交这些

`google-services.json`、`service-account.json`、`tools/push-secret.txt`、`tools/supabase.exe`、`tools/*.keystore*`、`supabase/migrations/202611220002_push_trigger.sql`（填了真实密钥之后）、`supabase/.temp/`、`.env`、`*.apk`、`node_modules/`、`dist/`、`android/`

> 通过 GitHub 网页手动上传时 `.gitignore` 不起作用，要自己把上面这些文件挑出去。

## 已知限制

1. 华为 / HarmonyOS 5+ 装不了 APK
2. 国产 ROM 需开「自启动 / 后台运行」，否则推送受限
3. 消息明文存库（无端到端加密）

## 文档

- `docs/DEVLOG-*.md`：各版本改了什么
- `docs/文案索引.md`：所有界面文字的位置
- `docs/PUSH-*.md`、`docs/NOTIFY-*.md`：推送与通知
