# Horizon v0.3 — 后台推送（FCM 第一阶段）

本补丁基于项目实际结构：Capacitor 8 + 单文件 HTML + Supabase。不是纯原生 Android 工程。
本阶段实现 FCM 客户端注册、Token 保存、消息 INSERT Webhook 和 FCM HTTP v1 发送。由于项目是无打包器的静态 HTML，补丁还使用 esbuild 将 Capacitor 8 插件模块打包为普通脚本，避免继续依赖已弃用的 `Capacitor.Plugins` 全局对象。
一加、荣耀（已确认 GMS）走 FCM；华为 Pura 80 Pro Max 的 HMS Push Kit 作为下一阶段接入，当前不会错误地把它当成 FCM 设备。

## 1. Firebase Console

1. 创建 Firebase 项目。
2. 添加 Android 应用，包名必须是 `com.horizon.chat`（来自 `capacitor.config.json`）。
3. 下载 `google-services.json`。
4. 将 JSON 文件放在仓库根目录，或将文件内容 base64 编码后存为 GitHub Actions Secret `GOOGLE_SERVICES_JSON_BASE64`。
   - Windows PowerShell：`[Convert]::ToBase64String([IO.File]::ReadAllBytes("google-services.json"))`
   - GitHub：Repository → Settings → Secrets and variables → Actions → New repository secret。
5. `google-services.json` 是客户端 Firebase 配置，不是服务账号私钥；但不要把服务账号私钥放进仓库或 APK。

## 2. 安装并构建

本补丁已在 `package.json` 添加 `@capacitor/push-notifications ^8.0.0` 和 `esbuild`，并新增 `native-plugins-entry.js`。GitHub Actions 会把 Local Notifications 与 Push Notifications 插件打包到 `www/native-plugins.js`。
GitHub Actions 会在 `npx cap add android` 后把 Firebase 配置复制到 `android/app/`。
未配置 Firebase 文件时仍可构建 APK，但 FCM 注册无法成功。

## 3. Supabase SQL

在 Supabase Dashboard → SQL Editor 中执行：

`supabase/migrations/202611220001_push_tokens.sql`

该表允许一个用户登记多台设备，并通过 RLS 限制用户只能维护自己的 Token。

## 4. 配置 Edge Function Secrets

在 Supabase Dashboard → Edge Functions → Secrets 添加：

- `FCM_SERVICE_ACCOUNT_JSON`：Firebase Console → Project settings → Service accounts → Generate new private key 下载的完整 JSON 文件内容。
- `PUSH_WEBHOOK_SECRET`：自己生成的一段随机长字符串。

Supabase Edge Function 运行时已有 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 环境变量。不要把它们写进前端。

部署（在本地已安装 Supabase CLI 并登录后）：

```bash
supabase link --project-ref <你的项目 ref>
supabase functions deploy push-message --no-verify-jwt
```

## 5. 创建 Database Webhook

Supabase Dashboard → Database → Webhooks → Create webhook：

- Table：`public.messages`
- Event：`INSERT`
- Type：Supabase Edge Function
- Function：`push-message`
- Method：`POST`
- Header：`x-push-webhook-secret: <与 PUSH_WEBHOOK_SECRET 完全相同的值>`
- Content-Type：`application/json`

Webhook payload 使用当前项目的 `messages` 表字段：`id, conversation_id, sender_id, body, created_at`。
Edge Function 根据 `conversation_members` 找到接收者，排除发送者，再给其所有 FCM 设备推送。

## 6. 重新构建和测试

1. 确认 GitHub Actions 已配置 `GOOGLE_SERVICES_JSON_BASE64`，重新运行 Build APK。
2. 安装新 APK，登录 Horizon，允许通知权限。
3. 检查 Supabase `push_tokens` 表是否出现当前用户的 `provider=fcm` 设备行。
4. 用另一台手机向该用户发消息。
5. 分别测试：App 前台、后台、锁屏、从最近任务划掉、重启手机后。
6. 点击通知应进入对应会话。

## 7. 重要限制与下一阶段

- 当前 FCM 通道面向有 GMS 的一加和荣耀设备。
- 华为 Pura 80 Pro Max 需要 HMS Push Kit、AppGallery Connect 的 `agconnect-services.json`、HMS 服务端凭证和单独的 HMS 发送实现；不要把 FCM Token 当作 HMS Token。
- 当前 Horizon 的未读数仍是前端内存状态，没有持久化已读游标。因此系统角标目前只能依赖活跃通知/启动器能力，`notification_count=1` 不是精确的会话未读总数。若要精确数字，需要再增加每用户每会话的 read cursor/unread 计数。
- Android 启动器对数字角标支持不统一；通知权限、通知渠道、横幅和锁屏展示也受用户系统设置影响。
- 目前通知锁屏可显示消息内容（FCM visibility PUBLIC），如果希望默认隐藏消息正文，需要改成 PRIVATE，并在应用设置中提供隐私选项。
- FCM 推送与 Realtime 并存：前台界面继续由 Realtime 更新；已成功注册 FCM 后，后台通知交给 FCM，避免 Realtime 本地通知重复弹出。
