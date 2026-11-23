# Horizon 更新日志 · v0.2

> 版本：0.2.0（`versionCode 200`）
> 日期：2026-11-22
> 上一版：0.1.0（基础聊天，见 `DEVLOG-0.1.md`）
> 仓库：https://github.com/Rhaphiel/Horizon

---

## 一句话总结

0.1 解决了"能聊天"，0.2 解决了"**消息到得知道**" —— 从应用内弹窗、系统通知（锁屏/横幅/角标），一路做到 App 被杀掉也能收到的 FCM 离线推送。

---

## 二、新增功能

### 1. 应用内弹窗提醒（前台）

- 新消息从顶部滑入，显示「谁 + 摘要」，点击直接进入对应聊天
- 同一聊天 1.5 秒内只弹一次；最多同时 3 条；5 秒自动消失
- 首页新增 **🔔 通知：开 / 🔕 通知：关**（存 localStorage）

### 2. 系统通知（后台 / 锁屏）

通过 `@capacitor/local-notifications` 调用安卓原生通知：

| 能力 | 实现 |
|---|---|
| 横幅（heads-up） | 渠道 `importance = 5`（HIGH） |
| 锁屏显示内容 | `visibility = 1`（PUBLIC） |
| 桌面角标 | `notification.number = 未读总数` |
| 点通知跳转 | `extra.cid` + `localNotificationActionPerformed` |
| 进聊天清通知 | `removeAllDeliveredNotifications()` |

### 3. 离线推送（FCM）

| 环节 | 实现 |
|---|---|
| 客户端注册 | `@capacitor/push-notifications` → `PN.register()` |
| Token 存储 | Supabase `push_tokens` 表（含 RLS + GRANT） |
| 触发 | Database Webhook（messages INSERT）→ Edge Function |
| 发送 | Edge Function 用服务账号换 Google OAuth → FCM HTTP v1 |
| 失效清理 | FCM 返回 `UNREGISTERED` 时自动删掉该 Token |
| 去重 | 前台不弹系统通知（交给应用内弹窗），后台才走 FCM |

### 4. 版本号

- 单一来源 `package.json` → CI 注入两处：Android `versionName/versionCode`、前端 `APP_VERSION`
- 首页显示：`你好，xxx v0.2.0`
- 之前系统里恒显示 `1.0`（Capacitor 模板写死），已修复

---

## 三、后端变更（Supabase）

| 对象 | 说明 |
|---|---|
| `push_tokens` 表 | `user_id / provider(fcm,hms) / token / platform / device_name`，唯一约束防重复 |
| RLS 策略 ×4 | select / insert / update / delete，全部 `auth.uid() = user_id` |
| 表级 GRANT | `authenticated` 读写、`service_role` 全权（**缺这个会 42501**） |
| Edge Function `push-message` | 校验 `x-push-webhook-secret` → 查会话成员 → 逐个推 FCM |
| Secrets | `PUSH_WEBHOOK_SECRET`、`FCM_SERVICE_ACCOUNT_JSON` |
| Webhook | `messages` INSERT → POST 函数 |

## 四、构建流水线变更

| 步骤 | 作用 |
|---|---|
| Bundle Capacitor 插件桥 | esbuild 把插件打成 `www/native-plugins.js`（静态 HTML 没有打包器） |
| Configure Firebase | 从 Secret 解码 `google-services.json` 到 `android/app/` |
| Ensure POST_NOTIFICATIONS | Android 13+ 缺这条权限，通知静默失败 |
| Inject app version | 把版本号写进 `www/index.html` 与 `build.gradle` |
| Upload APK | 产物 `horizon-apk` |

> Capacitor 8 模板自带 `google-services` Gradle 插件，只要 `google-services.json` 到位就会自动 apply，不需要手改 Gradle。

## 五、本地工具

| 文件 | 用途 |
|---|---|
| `tools/supabase.exe` | Supabase CLI 3.2.0（独立二进制，不依赖 npm） |
| `tools/setup-push.ps1 / .cmd` | 写 Secrets + 部署函数（自动生成 webhook 密钥） |
| `tools/check-push.ps1 / .cmd` | 只读自检：表 / 函数 / 可选测试推送 |
| `supabase/migrations/*.sql` | 建表、触发器、权限修复（均幂等） |

---

## 六、这一版踩过的坑（都留在文档里，避免重犯）

| # | 现象 | 根因 | 处理 |
|---|---|---|---|
| 1 | 注册报 `Failed to fetch` | 手机在 5G，连不上 Supabase | 换 Wi-Fi / 判断方法：手机浏览器开 `/rest/v1/` 看是否 401 |
| 2 | `policy ... already exists (42710)` | 重复执行 SQL，且旧版没有 `drop policy if exists` | 改成幂等 SQL |
| 3 | Edge Function 报 `42501` | 只写了 RLS，没写表级 GRANT | `grant ... to service_role/authenticated` |
| 4 | `禁止运行脚本` | Windows 执行策略 Restricted | `-ExecutionPolicy Bypass` 或 `.cmd` 包装 |
| 5 | `Access token not provided` 后脚本中断 | `$ErrorActionPreference='Stop'` + `2>&1` 把提示当异常 | 改 `Continue`，并先检测 token 文件 |
| 6 | CLI 参数 `--project-ref` 报未知选项 | CLI v3 改成 `--remote=<ref>`，且部署要 `--use-api` 免 Docker | 全部改掉 |
| 7 | 版本恒为 1.0 | Capacitor 模板写死 `versionCode 1 / versionName "1.0"`，且 CI 每次重建 android/ | 构建前 sed 注入 |
| 8 | 华为 Pura 80 装不上 | HarmonyOS 7（NEXT 谱系）不兼容 APK | 该机跳过，改用网页版兜底 |

## 七、已知限制

1. **华为/鸿蒙**：HarmonyOS 5+ 无法安装 APK，需要原生 `.hap`（另行开发）或用网页版
2. **角标数字不精确**：Edge Function 里 `notification_count` 固定为 1，不是真实未读总数
3. **国产 ROM 保活**：一加/荣耀要在系统设置里开「自启动 / 后台运行」，否则久了 FCM 也会被限制
4. **消息明文**：Supabase 存明文（无 E2EE）
5. **RLS 只覆盖了新表**：`messages` 等旧表的策略需要单独核实

## 八、验收记录

| 检查项 | 结果 |
|---|---|
| `push_tokens` 表可访问 | ✅ |
| Edge Function 已部署（401 校验生效） | ✅ |
| Webhook 触发 → 函数执行 | ✅ |
| 测试推送 `sent: 1` | ✅ |
| 通知权限 / 渠道 HIGH | 待真机逐项验收 |
| 锁屏 / 横幅 / 角标 / 点击跳转 | 待真机逐项验收 |

## 九、下一版（0.3）计划

1. 语音消息（录音 → 上传 → 时长气泡 → 播放），设计见 `VOICE-v0.3.md`
2. 精确未读角标（read cursor 持久化）
3. 华为兜底：PWA 版
4. 可选：HMS Push Kit（若确定要支持华为原生）
