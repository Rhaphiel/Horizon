# Horizon 开发日志 · v0.1

> 版本：0.1.0（首个可跑通的版本）
> 日期：2026-11-22
> 形态：Android APK（Capacitor 壳）+ 单文件前端 + Supabase 后端
> 仓库：https://github.com/Rhaphiel/Horizon

---

## 一、这一版做成了什么

一个**能真的两个人聊天**的极简 App，核心链路全部打通：

| 模块 | 状态 | 说明 |
|---|---|---|
| 邮箱注册 / 登录 | ✅ | Supabase Auth；注册时把用户名写进 `user_metadata` |
| 用户名唯一性 | ✅ | 通过 `profiles` 表 + 触发器（同名会返回 `database error`，前端已翻译成"用户名已被占用"） |
| 搜索用户 | ✅ | `profiles.username` 的模糊匹配（`ilike`），排除自己，限 20 条 |
| 好友申请 | ✅ | `friendships` 表，三态：pending / accepted |
| 好友列表 | ✅ | 收到的申请、我发出的、已通过的好友 |
| 私聊 | ✅ | RPC `create_dm(friend)`，同一个好友不会重复建会话 |
| 群聊 | ✅ | RPC `create_group(name, member_ids)` |
| 消息收发 | ✅ | `messages` 表，`created_at` 排序 |
| 历史分页 | ✅ | 首屏 50 条，向上"加载更早"、向下"加载更新" |
| 搜索聊天记录 | ✅ | 全局搜索 + 当前聊天内搜索，关键词高亮、可跳转到原消息 |
| 未读数 | ✅ | 内存里的 `unread`，切进会话清零 |
| 实时到达 | ✅ | Supabase Realtime 订阅 `messages` 的 INSERT |

---

## 二、技术选型（以及为什么）

| 选择 | 原因 | 代价 |
|---|---|---|
| 单文件 `index.html` | 改起来最快，一个文件就能改完全站 | 800 行以后开始难找代码 |
| Capacitor 8 | 免写 Java/Kotlin 就有 APK，能调原生能力 | 需要 Android SDK 才能打包 |
| Supabase | 注册/登录/数据库/实时推送一次给全，免费额度够两人用 | **国内网络不稳**（这正是 v0.1 最大的外部风险） |
| `supabase.js` 本地打包 | 不依赖 CDN，APK 离线也能加载 SDK | 仓库里必须带着这 216 KB 的文件 |
| 明文消息（无 E2EE） | 上手快，实时推送简单 | 后端可读；敏感内容别用 |

---

## 三、数据结构（从代码反推，用于自查）

```text
profiles(id, username)                     -- 用户资料，id = auth.users.id
friendships(id, requester, addressee, status)
conversations(id, type['dm'|'group'], name, created_at)
conversation_members(conversation_id, user_id)
messages(id, conversation_id, sender_id, body, created_at)

RPC: create_dm(friend) -> conversation_id
RPC: create_group(group_name, member_ids[]) -> conversation_id
```

> ⚠️ 前端只读取了这些列；`RLS（行级安全）` 是否配全，需要到 Supabase SQL Editor 里逐表确认。**这是当前最大的安全隐患**：如果 `messages` 没开 RLS，任何人拿到 anon key 就能读全库。

---

## 四、关键实现备忘

1. **滚动策略**（`renderChat(mode)`）—— 这是全文件最讲究的一段：
   - `bottom` 新消息到底；`keep` 往上插历史时保持视口不动；
   - `stick` 用户本来就在底部才跟随；`target` 跳转搜索命中并高亮。
2. **消息去重**（`mergeRows` + `chatIds` Set）：实时推送和分页查询会拿到同一批数据，靠 id 去重再按时间排序。
3. **Realtime 回调里不许直接查库**：Supabase 的回调在特定状态下查询会卡死，所以 `onAuthStateChange` 里用 `setTimeout(0)` 跳出。
4. **未读只在本次打开有效**：`unread` 不落库，刷新就没了——v0.2 可以顺便做持久化。

---

## 五、v0.1 已知问题

| # | 问题 | 影响 | 计划 |
|---|---|---|---|
| 1 | 没有消息提醒 | 别人发消息时完全无感知（只有列表红点） | **v0.2 本次已修** |
| 2 | Supabase 国内连不上 | 注册报 `Failed to fetch` | 换网络 / 迁到 Cloudflare Worker |
| 3 | 仓库缺 `supabase.js` | 重新打包会退化成 CDN 加载，国内易失败 | 已从 APK 里找回并放回 `www/` |
| 4 | 无附件/语音 | 只能发文字 | v0.3 语音 |
| 5 | 无后台推送 | App 不在前台就收不到 | v0.4 FCM |
| 6 | 无已读/无在线状态 | — | 未排期 |
| 7 | RLS 未核实 | 数据可能对所有人可见 | **优先自查** |

---

## 六、v0.2 变更（本次提交）

- ✅ 新增 **消息弹窗提醒**：新消息从顶部滑入，显示"谁 + 说了什么"，点一下直接进聊天
- ✅ 同一聊天 1.5 秒节流、最多同时 3 条，5 秒自动消失
- ✅ 首页新增 **通知开关**（🔔/🔕，存 localStorage）
- ✅ 未读数同步到**页面标题**（`(3) Horizon`），切后台看任务栏也能知道
- ✅ 补回 `www/supabase.js`（216 KB），保证打包不踩 CDN 坑

---

## 七、下个版本（v0.3）预告

语音消息：录音 → 上传 Storage → 气泡宽度随时长 → 点击播放。设计见 `docs/VOICE-v0.3.md`。


## 八、v0.3 后台推送改造（FCM 第一阶段）

- 新增 `@capacitor/push-notifications`。
- 登录后申请 FCM Token，并写入 `push_tokens` 多设备表。
- 退出登录或关闭通知时解除当前设备与账号的 Token 关联。
- FCM 点击通知携带 `conversation_id`，冷启动后恢复会话并跳转。
- 新增 Supabase Edge Function：监听 `messages` INSERT Webhook，查找会话接收者并通过 FCM HTTP v1 推送。
- GitHub Actions 支持从 `GOOGLE_SERVICES_JSON_BASE64` Secret 注入 Firebase 客户端配置。
- 华为 HMS Push Kit 尚待单独集成；当前 FCM 先覆盖有 GMS 的一加与荣耀。
