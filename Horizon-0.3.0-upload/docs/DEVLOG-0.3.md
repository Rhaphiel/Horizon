# Horizon 0.3 开发日志

0.3 做了两件事：**换框架**（工程化）和**补功能**。聊天、好友、推送这些 0.2 的功能全部保留。

## 一、框架与工具

| 项目 | 之前 | 现在 |
|---|---|---|
| 数据库定义 | 只在 Supabase 后台，仓库重建不出来 | `supabase/migrations/` 里有基线 + 增量脚本，全部可重复执行 |
| 构建工具 | 单个 index.html + esbuild 临时拼接 + CDN 加载 | **Vite**（`npm run build` → `dist/`） |
| 界面 | 1000 多行原生 JS | **Vue 3 + Ionic Vue**（手机风格的页面切换、列表、下拉刷新、弹窗），拆成 `views/` `components/` |
| 语言 | JavaScript | **TypeScript**；数据库类型在 `src/types/database.ts`，运行 `tools\gen-types.cmd` 可重新生成 |
| 推送 | 已有 | 保持：`supabase/functions/push-message` + Database Webhook（模板见 `supabase/templates/`） |

### 目录

```
Horizon/
├─ index.html              Vite 入口（很短，真正的界面在 src/）
├─ vite.config.ts          Vite 配置（含版本号注入）
├─ tsconfig.json  env.d.ts
├─ package.json            依赖 + 版本号（唯一来源）
├─ capacitor.config.json   webDir 现在是 dist
├─ src/
│  ├─ main.ts  App.vue
│  ├─ router/              页面路由 + 登录守卫
│  ├─ views/               登录、聊天列表、好友、我的、聊天窗口、群聊信息
│  ├─ components/          选好友弹窗（建群 / 加人共用）
│  ├─ stores/              状态：登录、聊天、好友、用户名缓存、设置
│  ├─ services/            实时、通知、推送、返回键、启动流程、数据库调用
│  ├─ lib/                 工具：supabase 客户端、格式化、错误翻译、弹窗
│  ├─ types/database.ts    数据库类型
│  └─ theme/               极简黑白主题
├─ supabase/
│  ├─ migrations/          202611210001_baseline.sql  基线（可从零重建）
│  │                       202611220001~3 ...          推送相关（你已有）
│  │                       202611230001_unread_groups_clear.sql  本次新增
│  ├─ functions/push-message/
│  └─ templates/push-webhook.sql.example
├─ tools/gen-types.cmd
└─ .github/workflows/build-apk.yml
```

## 二、新功能

1. **未读消息存数据库**：`conversation_members.last_read_at` 记录读到哪里，未读数由数据库计算（`get_conversation_stats`），重开 App、换手机都不会丢；在另一台设备上读了消息，这台会自动同步。聊天列表还会显示最新一条消息和时间，并按最近活动排序。
2. **群聊管理**
   - 添加成员：仅群主，且只能添加群主自己的好友，群最多 50 人
   - 移出成员：仅群主
   - 退出群聊：任何成员；群主退出时，群主身份自动转给最早加入的成员，群里没人则群被删除
   - 解散群聊：仅群主，成员和消息一并删除；其他成员会实时收到“群聊已解散”
   - 被移出 / 群解散时，正在看的页面会自动退回聊天列表
3. **清空聊天记录**：只清自己这边（`cleared_at`），对方和其他群成员不受影响；清空前的消息也搜不到。入口：聊天窗口右上角“更多”，或群聊信息页。
4. **安卓返回键**：先关弹窗 / 菜单 → 收起聊天里的搜索面板 → 聊天页返回上一页 → “好友 / 我的”回到“聊天” → 在“聊天”首页连按两次退出。

## 三、升级步骤

1. Supabase → SQL Editor，粘贴运行 `supabase/migrations/202611230001_unread_groups_clear.sql`（基线脚本线上已有，不用再跑）。
2. 把本次文件覆盖到仓库，删除过时文件：`www/`、`native-plugins-entry.js`、根目录的 `build-apk.yml`（`.github/workflows/` 里的才是真的）。
3. 提交并推送到 `main`，等 Actions 构建，下载 `horizon-apk`。

> 先跑第 1 步再装新 APK。旧版 App（0.2）和新数据库兼容，不会坏。

## 四、已知限制 / 注意

- 本次代码在没有联网安装依赖的环境里写成，**没有真正编译运行过**。第一次构建如果报错，把 Actions 里红色步骤的报错原文发来即可。类型检查步骤只提示、不拦截打包。
- 数据库里其他成员能看到彼此的 `last_read_at`（已读位置），暂不做隐藏。
- 群成员被移出 / 群解散的实时通知依赖 Supabase 的 DELETE 事件（不受行级安全过滤，只含主键 id）。
- 消息仍是明文存库；还没做图片 / 文件消息、成员自己改群名。
