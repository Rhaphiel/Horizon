# Horizon

A Mobile Chat APP — Vue 3 + Ionic Vue + TypeScript + Vite，Capacitor 8 打包安卓，Supabase 做后端。

## 当前版本：0.3.0

- **0.1**：注册登录、好友、私聊群聊、实时、搜索、分页
- **0.2**：应用内弹窗、系统通知、FCM 离线推送
- **0.3**：Vite + Vue + Ionic + TypeScript 重构；数据库定义入库；未读数存数据库；群成员管理（加人 / 移出 / 退出 / 解散）；清空聊天记录；安卓返回键

详见 `docs/DEVLOG-0.3.md`。

## 开发

```
npm install
npm run dev        # 浏览器里预览（http://localhost:5173）
npm run typecheck  # 类型检查
npm run build      # 构建到 dist/
```

数据库类型：`tools\gen-types.cmd`（从线上数据库重新生成 `src/types/database.ts`）。

## 打包 APK

推送到 `main` 会自动触发 GitHub Actions → Actions 页面下载 `horizon-apk`。

仓库 Secret：

| Secret | 用途 |
|---|---|
| `GOOGLE_SERVICES_JSON_BASE64` | Firebase 客户端配置（base64） |

版本号：只改 `package.json` 的 `version`。

## 后端（Supabase）

1. SQL：按文件名顺序执行 `supabase/migrations/`（均可重复执行）。线上已有的可跳过，新环境从 `202611210001_baseline.sql` 开始。
2. 函数：`tools\setup-push.cmd`（写 Secrets + 部署 `push-message`）
3. Webhook：`messages` 表 INSERT → `push-message`，带 `x-push-webhook-secret` 头（模板：`supabase/templates/push-webhook.sql.example`）
4. 自检：`tools\check-push.cmd`

## 不进仓库的文件

`google-services.json`、`service-account.json`、`tools/push-secret.txt`、`tools/supabase.exe`、`supabase/migrations/202611220002_push_trigger.sql`（含密钥）、`.env`、`*.apk`、`node_modules/`、`dist/`、`android/` —— 见 `.gitignore`。

## 已知限制

1. 华为 / HarmonyOS 5+ 不兼容 APK
2. 国产 ROM 需在系统设置里开“自启动 / 后台运行”，否则推送会被限制
3. 消息明文存库（无端到端加密），敏感内容别发
