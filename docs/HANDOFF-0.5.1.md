# Horizon 交接材料（0.5.1 · 2026-11-24）

> 给下一个人 / 下一个 AI。读完这一份就能接手，不用翻聊天记录。

## 0. 一页速览

| 项 | 值 |
|---|---|
| 项目 | Horizon —— 私人手机聊天 App（作者 + 2 个朋友用） |
| 版本 | **0.5.1**（`package.json` 是唯一来源，CI 注入 `versionName 0.5.1` / `versionCode 501`） |
| 前端 | Vue 3 + Vite 6 + TypeScript + Ionic 8 + Capacitor 8 |
| 后端 | Supabase（Auth / Postgres+RLS / Realtime / Storage / Edge Functions）+ FCM |
| 仓库 | `github.com/Rhaphiel/Horizon`（main，Actions 出 APK） |
| 本地工作目录 | `D:\Horizon`（无 git，改动靠手动上传 zip） |
| Supabase 项目 | `osbjqvdzmqcztsxbsuyc` / `https://osbjqvdzmqcztsxbsuyc.supabase.co` |
| 包名 | `com.horizon.chat` |

## 1. 目录结构

```
src/
  App.vue                 全局：通知横幅 / 更新弹窗 / 账号名设置
  main.ts                 样式与启动
  router/index.ts         路由 + 两个守卫（登录、聊天返回来源标签）
  views/
    LoginPage.vue         登录(账号名/ID/邮箱) · 注册(邮箱验证码) · 忘记密码
    TabsPage.vue          悬浮玻璃标签栏（可拖动、回弹）
    ChatsPage.vue         会话列表 · 搜索(按会话分组) · + 菜单 · 称号管理面板
    FriendsPage.vue       好友(折叠分组) · 按用户名/ID 搜索 · ID 可见性开关
    ChatPage.vue          聊天：气泡/图片/语音/引用/撤回/长按菜单/⋮菜单
    GroupInfoPage.vue     群信息（玻璃风格）：改群名 / 静音 / 查找记录 / 媒体 / 链接
    MePage.vue            「账号」页：头像/改名/设置面板
  components/
    Avatar.vue            头像（图或首字母）
    AvatarCropper.vue     圆形裁剪（拖动/缩放/导出 512 JPEG）
    MediaBubble.vue       图片/语音气泡 + 过期占位
    MediaThumb.vue        群信息「媒体」里的方形缩略图
    ImageViewer.vue       全屏看图（滑动切换/边缘右滑关闭）
    UpdateModal.vue       新版本弹窗
    HandleModal.vue       账号名设置（不可改）
    AppearanceModal.vue   外观 + 称号与显示
    PickFriendsModal.vue  选好友（建群/加人）
    SelectTextModal.vue / ForwardModal.vue
  lib/
    username.ts           用户名规则（和数据库 is_username_ok 一致）
    errors.ts             报错文字（RPC / 发送 / 登录）
  services/
    avatarApi.ts          头像上传(压缩/静态校验)
    mediaApi.ts           聊天媒体上传/签名 URL/发消息
    messagesApi.ts        拉取/发送/搜索/撤回
    updates.ts            查 GitHub Release（含 pre-release）
    notify.ts             应用内横幅 + 系统通知权限（静音看服务器上的 conversation_mutes）
    push.ts / realtime.ts / lifecycle.ts / navigation.ts / backButton.ts
  stores/
    session / chats / friends / directory / profile / settings / titles
    （chats.canMessage：私聊对方已不是好友时不能发；titles.refreshTitles：回前台刷新称号）
  theme/
    appearance.ts         Material You 方案（种子色 → 全套变量）
    m3.css                组件样式 + .glass 材质 + 头部一体化
supabase/
  migrations/             24 个 SQL + 本地的 push_trigger（见第 4 节）
  functions/              push-message · login-by-username · cleanup-media · delete-account
  templates/              webhook / cron 模板
docs/                     DEVLOG 0.1~0.5（0.5.1 在 DEVLOG-0.5 第九节）、文案索引、交接、迁移、SMTP、OTP 模板
tools/gen-copy-index.py   重新生成 docs/文案索引.md
```

## 2. 0.4 → 0.5 做了什么（功能面）

- **多媒体**：发图片、发语音、全屏看图（滑动切换）、私有桶 `chat-media`、24 小时自动销毁（Edge Function + pg_cron）
- **消息**：撤回（1 小时）、10 分钟内重新编辑、引用回复、长按菜单
- **HorizonID**：100001 起按注册顺序分配；可登录/搜索/加好友；可见性开关
- **账号名（handle）**：设置后不可改，可用于登录；用户名可每天改一次
- **称号系统**：100001 授予/修改/删除；称号渐变与用户名渐变分开；本人选择是否显示；全端展示
- **账号页**：头像、改名、设置（外观/通知/更新/版本/退出/注销）
- **注销**：邮箱验证码确认；ID 进入回收池，下一个注册者优先复用
- **邮箱验证码**：注册、忘记密码、注销三条链路（Supabase Email OTP）
- **界面**：Liquid Glass 材质（标签栏/顶栏/输入栏/菜单）、Material You 气泡渐变、图标统一 Ionicons
- **安装**：固定 APK 签名（解决"未安装应用"）
- **更新推送**：读 `/releases`（含 pre-release，兼容 `v0.5` 两段式 tag）

### 0.5.0 → 0.5.1（审查修正，细节见 DEVLOG-0.5 第九节）

- **权限**：发消息 / 撤回的系统字段由服务器决定；`profiles` 只开放头像、显示的称号、ID 开关三列；只能显示自己的称号；新函数和 `profile_titles` 收回 anon 权限；实时频道不再发布 DELETE
- **注销**：100001 不进回收池；建群的人注销后群还在（群主转给最早入群的人）；私聊一起删；服务器核对 15 分钟内的验证码登录
- **聊天**：好友页「发消息」；删好友后私聊只能看；静音存服务器（跨设备、推送也跳过）；引用摘要服务器生成、原消息撤回后跟着变；群主改群名；群资料页「媒体 / 链接 / 查找记录」
- **其他**：通知权限只弹一次授权框；同一台手机换账号后推送只给新账号；称号回前台刷新；用户名规则前后端一致

## 3. 关键参数

| 参数 | 值 | 位置 |
|---|---|---|
| 标签栏高度/圆角/边距 | 62 / 31 / 20 | TabsPage.vue |
| 胶囊动效 | `.28s cubic-bezier(.3,1.15,.5,1)` | TabsPage.vue |
| 拖动吸附阈值 | 75px | TabsPage.vue |
| 头像导出 | 512×512 JPEG q=0.9 | AvatarCropper.vue |
| 图片压缩 | 长边 1600 | ChatPage.vue |
| 撤回时限 / 重编辑 | 1 小时 / 10 分钟 | 客户端 + SQL 策略 |
| 媒体有效期 | 24 小时 | 202611240002 触发器 |
| 更新检查间隔 | 6 小时 | updates.ts |
| 版本号规则 | 主×10000+次×100+修订 | build-apk.yml |

## 4. 数据库（按文件名顺序执行，全部幂等）

```
202611210001_baseline.sql            建表 + RLS + 基础函数
202611220001_push_tokens.sql         推送 token
202611220002_push_trigger.sql        消息 Webhook（含密钥，gitignore）
202611220003_grants.sql              表级 GRANT
202611230001_unread_groups_clear.sql 未读/清空
202611230002_avatars.sql             头像桶 + 策略
202611230003_avatar_permissions.sql  profiles 更新权限
202611240001_media.sql               媒体字段 + chat-media 桶 + 策略
202611240002_media_expiry.sql        24h 过期触发器 + 待清理视图
202611240003_message_recall.sql      撤回（1 小时）
202611240004_reply.sql               引用回复
202611240005_horizon_id.sql          HorizonID 分配
202611240006_titles.sql              称号表 + ID 可见性
202611240007_id_searchable_all.sql   开关对 100001 也生效
202611240008_title_manage.sql        称号改/删权限
202611240009_gradient_split.sql      称号/用户名渐变拆分
202611240010_id_search_default_off.sql ID 查找默认关闭
202611240011_username_change.sql     改名（每天一次）
202611240012_delete_account.sql      ID 回收池
202611240013_handle.sql              账号名（不可改）
202611240014_security_hardening.sql  发消息 / 撤回由服务器决定系统字段、引用摘要服务器生成、群头像看当前群主
202611240015_mute_and_storage.sql    静音（conversation_mutes，跨设备）+ 存储桶上限
202611240016_private_events_and_profiles.sql  user_events 私有事件表 + profiles 只开放 3 列 + 头像地址校验
202611240017_dm_and_group_name.sql   私聊不重复 / 删好友后不能发 / 改群名 / 群资料变动通知 / 推送 Token 归属 / 实时不发 DELETE
202611240018_account_and_privacy.sql 100001 不回收 / 注销不删群 / 只能显示自己的称号 / 收回 anon 权限
```

> 实际文件数以目录为准；顺序按文件名。
> **SQL Editor 里整份脚本是一个事务**：最后一条自检报错 → 前面全部回滚。看 Results 的最后一条结果。

## 5. Edge Functions

| 函数 | 作用 | 依赖 |
|---|---|---|
| `push-message` | 收 Webhook → FCM 推送（跳过静音了这个聊天的人） | Secrets：FIREBASE_SERVICE_ACCOUNT、PUSH_WEBHOOK_SECRET |
| `login-by-username` | 账号名/HorizonID → 查邮箱 → 登录；同一账号每分钟最多 10 次 | 自动注入的 SUPABASE_* |
| `cleanup-media` | 删除过期媒体 + 标记 is_expired；兜底删 26 小时以上的文件；删 7 天前、没人用的旧头像 | SUPABASE_SERVICE_ROLE_KEY |
| `delete-account` | 注销（级联删 profiles → 触发 ID 回收）；要求 15 分钟内刚用验证码登录过 | SUPABASE_SERVICE_ROLE_KEY |

部署：

```powershell
cd D:\Horizon
D:\tools\supabase.exe functions deploy <name> --remote=osbjqvdzmqcztsxbsuyc --yes
```

## 6. 账号与登录规则

| 概念 | 规则 | 可否修改 |
|---|---|---|
| 账号名 handle | 3–20 位大小写字母/数字/下划线 | ❌ 设置后锁定 |
| 用户名 username | 2–20 字符，汉字/假名/字母 | ✅ 每天一次（UTC+8 0 点重置） |
| HorizonID | 100001 起，按注册顺序；注销后进回收池 | ❌ |
| 登录 | 账号名 / HorizonID / 邮箱 三选一 | — |

## 7. 邮件（Supabase Auth）

已通过 Management API 配好（2026-11-24）：

| 项 | 值 |
|---|---|
| SMTP | smtp.qq.com:465，user=rhaphiel@qq.com（密码=QQ授权码） |
| OTP 长度 / 有效期 | 6 位 / 900 秒 |
| 自动确认注册 | 关闭（必须填码） |
| 模板 | Magic Link / Confirm signup / Recovery 均含 `{{ .Token }}` |
| 标题 | Horizon 验证码 / Horizon 注册验证码 / Horizon 重置密码 |

文档：`docs/EMAIL-OTP-SETUP.md`、`docs/EMAIL-OTP-TEMPLATES.md`

## 8. GitHub Actions（`.github/workflows/build-apk.yml`）

步骤链：checkout → node22 → java21 → npm install → typecheck(不拦截) → build → **固定 keystore** → cap add android → **Maven 镜像** → Firebase 配置 → **权限注入** → 版本注入 → cap sync → assembleDebug → 上传 artifact

必需的仓库 Secret：

| Secret | 用途 |
|---|---|
| `GOOGLE_SERVICES_JSON_BASE64` | Firebase 客户端配置 |
| `DEBUG_KEYSTORE_BASE64` | **固定签名**（不加则每次装新版都提示签名冲突） |

签名指纹（SHA1）：`E2:2E:18:08:08:67:91:18:CB:14:33:56:C2:DE:51:44:95:F1:2B:CC`

## 9. 已知限制 / 待办

1. 语音转文字未做（WebView 无 Web Speech；第三方要上传音频，与 24h 销毁冲突）
2. 群信息页「媒体」只有最近 24 小时的图片（图片 24 小时后清理）；「链接」只看最近 100 条带网址的消息
3. 私聊没有资料页：查记录用聊天页 ⋮ →「搜索聊天记录」
4. 扫一扫已移除
5. 视频消息未做（字段已留 `media_type='video'`）
6. 华为 / HarmonyOS 5+ 无法安装 APK
7. 称号删除后，被授予人需重新选择显示
8. 「ID 查找」开关只挡 App 里的搜索；登录用户直接查 `profiles` 仍看得到所有人的 HorizonID
9. 删好友后原来的私聊只能看、不能发（0.5.1 起）；重新加好友后恢复

## 10. 踩坑清单（重要）

| 现象 | 根因 | 解法 |
|---|---|---|
| 头像/图片被横向压扁 | Ionic 全局 `img{max-width:100%}` | `.pic { max-width:none }` |
| `permission denied for table profiles` | 只有 RLS 没 GRANT | `grant update (...)` |
| `operator does not exist: text = uuid` | `storage.objects.owner_id` 是 text | `auth.uid()::text` |
| 装新版「未安装应用」 | 每次 CI 随机 debug 签名 | `DEBUG_KEYSTORE_BASE64` |
| 录音直接 Permission denied | manifest 缺 RECORD_AUDIO | CI Python 注入 + 失败变红 |
| 页面打不开 | dev server 没跑 | `npm run dev -- --host 0.0.0.0 --port 5173` |
| 编辑文件报 `Win32 32` | Vite 占用文件 | 先停 dev server 再改 |
| `create or replace view` 改列名失败 | PG 不允许 | `drop view` 再建 + 重新 grant |
| 邮件是链接不是验证码 | 模板没有 `{{ .Token }}` | Management API / 后台改模板 |
| 更新推送不弹 | `/releases/latest` 跳过 pre-release；tag 是 `v0.5` | 读 `/releases` + 版本正则兼容两段式（0.5.1 才真正改好挑 Release 的那个正则） |
| 别人订阅就能收到所有人的退群事件 | Realtime 的 DELETE 事件不经过 RLS | App 改订阅 `user_events`；`supabase_realtime` 只发布 INSERT / UPDATE |
| 没登录也能调新函数 / 读新视图 | Supabase 默认把 public 里新建的函数、视图开放给 anon | 新建后 `revoke ... from public, anon`；视图加 `security_invoker` |
| 触发器里判断「是不是 App 用户」失效 | 函数是 security definer 时 `current_user` 是函数所有者 | 判断 `current_user in ('authenticated','anon')` 的触发器不要用 definer |

## 11. 常用命令

```powershell
cd D:\Horizon
npm run dev -- --host 0.0.0.0 --port 5173   # 手机同 Wi-Fi 访问 http://<IP>:5173
npm run typecheck
npm run build

# 部署函数（CLI 在 D:\tools）
D:\tools\supabase.exe functions deploy login-by-username --remote=osbjqvdzmqcztsxbsuyc --yes

# 发版：改 package.json 版本 → 上传代码 → 推 main → Actions 下载 horizon-apk
```

## 12. 发版流程

1. 改 `package.json` 的 `version`（0.5.x 内自由；跨 0.6 前先确认）
2. 上传到 GitHub（或整包替换）
3. Actions 构建 → 下载 APK
4. 建 Release：tag `Horizon-v0.5.x`、勾 Pre-release、附 APK、写中文更新说明

> 有新的 migration 时，先在 SQL Editor 执行完再发 APK（新版前端会用到新函数 / 新表）。
5. 旧版本用户启动后 2~5 秒会看到「发现新版本」

## 13. 密钥与敏感文件清单（不进公开仓库）

```
google-services.json                 Firebase 客户端
service-account.json                 Firebase 服务账号
tools/push-secret.txt                推送 Webhook 密钥
tools/horizon-debug.keystore(+.b64)  APK 签名
supabase/migrations/202611220002_push_trigger.sql  （本地含真密钥）
```

`.gitignore` 已覆盖以上全部。
