# Horizon 0.4 开发日志

0.4 做了一次界面改造（Material 3 风格）、修了三处问题，并新增三项功能。数据库表结构没有改动；唯一需要额外部署的是一个服务端函数（见「交接须知」）。

> **状态说明：本版本的改动尚未编译、尚未在真机上测试。** 配色算法做过数值验证（见 `theme/color.ts`），其余只做了文件结构检查。接手后请先按「验证清单」走一遍。

## 一、修复的问题

| # | 问题 | 做法 | 涉及文件 |
|---|---|---|---|
| 1 | 从“好友”点“发消息”进入聊天，返回后回到了“聊天”而不是“好友” | 进入聊天时在路由里记下来源标签页（`?from=/tabs/xxx`），返回时回到该页；安卓返回键走同一函数。原因是推测，未在真机复现 | `services/navigation.ts`（`openChat` / `leaveChat`）、`services/backButton.ts`、`ChatPage` `ChatsPage` `FriendsPage` |
| 2 | 输入文字过长时不会在输入框内换行 | 输入框换成原生 `textarea`，按宽度自动换行并自动长高，最高约 5 行，超出后框内滚动。手机上回车=换行，电脑上回车=发送（Shift+回车换行） | `ChatPage.vue` |
| 3 | 深色模式下对方消息看不清 | 气泡颜色改为按背景自动挑选，文字与气泡颜色成对选取（对比度 ≥ 4.5:1）；时间、发送者名字移进气泡内；日期分隔条改成实心胶囊 | `theme/appearance.ts`、`ChatPage.vue` |

## 二、新增功能

### 1. 外观设置（Material You 风格）
- 入口：「我的 → 外观」，带实时预览，可「恢复默认」。
- 深色 / 浅色 / 跟随系统。
- 主题色：8 个预设 + 自选颜色，整套界面颜色（按钮、气泡、导航栏、弹窗）随主题色生成。
- 聊天背景：默认 / 纯色 / 图片，带透明度滑块（0–100%）。
- 图片背景会压缩到长边 1280px、JPEG 存在手机本地（`localStorage`），不上传服务器。
- 设置保存在手机本地，换设备不会同步。

### 2. 用户名登录
- 登录框可填用户名或邮箱（含 `@` 按邮箱处理）；注册仍是用户名 + 邮箱 + 密码。
- 由服务端函数 `login-by-username` 完成：在服务器上查出邮箱再登录，只返回登录会话，**不返回邮箱**（避免被用来反查他人邮箱）。带每分钟 10 次 / IP 的简单限流。
- 文件：`supabase/functions/login-by-username/index.ts`、`supabase/config.toml`（`verify_jwt = false`）、`LoginPage.vue`。

### 3. 长按消息：复制 / 选择文本 / 转发
- 长按气泡（450ms，手指滑动则取消）弹出菜单。
- 复制：整条消息。
- 选择文本：弹窗内可拖动选中一部分，或点“全选”；点“复制”时没选就复制全部。
- 转发：可一次选多个聊天，**目前以普通消息发送，没有“转发自”标记**（如需要标记，要在 `messages` 表加字段，属于后续工作）。
- 文件：`ChatPage.vue`、`components/SelectTextModal.vue`、`components/ForwardModal.vue`、`lib/clipboard.ts`。

## 三、界面改造（Material 3）

- 底部导航栏改为 M3 Navigation Bar：选中项有胶囊指示器，角标在图标右上角。**标签顺序未变**（聊天 / 好友 / 我的）。
- 按钮改为圆角矩形，搜索框为胶囊形，弹窗、提示条、选项菜单统一圆角。
- 聊天列表、好友列表、聊天标题栏加入圆形头像（取名字首字，颜色由名字决定），未读数为胶囊角标。
- “新建群聊”由顶栏按钮改为右下角悬浮按钮。
- 登录页、我的页同步换成 M3 样式。
- **未做**：拍照按钮（按需求暂不做）。

## 四、文件清单

**新增**
```
src/theme/color.ts                 取色算法（无第三方依赖，OKLCH 生成 M3 色阶与配色方案）
src/theme/appearance.ts            外观设置：状态、保存、套用到页面、气泡配色
src/theme/m3.css                   M3 通用样式
src/components/Avatar.vue          圆形字母头像
src/components/AppearanceModal.vue 外观设置弹窗
src/components/SelectTextModal.vue 选择文本弹窗
src/components/ForwardModal.vue    转发弹窗
src/lib/clipboard.ts               复制到剪贴板
supabase/functions/login-by-username/index.ts
docs/DEVLOG-0.4.md                 本文件
```

**修改**
```
package.json            版本 0.4.0；新增依赖 ionicons
README.md               补充用户名登录部署说明
supabase/config.toml    登记 login-by-username 函数
src/main.ts             深色模式改为手动切换（dark.class.css）；启动时套用主题
src/theme/variables.css 只保留字体与安全区；颜色改由 appearance.ts 写入
src/theme/global.css    应用内通知弹窗改用主题色
src/lib/errors.ts       登录错误文案
src/services/navigation.ts / backButton.ts   返回逻辑
src/views/ChatPage.vue ChatsPage.vue FriendsPage.vue LoginPage.vue MePage.vue TabsPage.vue
```

## 五、交接须知

1. **先 `npm install`**（新增 `ionicons`），再 `npm run typecheck`、`npm run build`。`ionicons` 的图标名是凭记忆写的、未核对，构建报错先查 `TabsPage.vue` / `ChatPage.vue` / `AppearanceModal.vue` 里的 `import ... from 'ionicons/icons'`。
2. **部署用户名登录函数**：`supabase functions deploy login-by-username`。未部署时用户名登录会提示“尚未部署”，邮箱登录不受影响。该函数依赖 Supabase 自动提供的 `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`。
3. **不要提交任何密钥**：`service-account.json`、`google-services.json`、`tools/push-secret.txt` 已在 `.gitignore`。推送时曾被 GitHub Secret Scanning 拦截（提示 `capacitor.config.json` 含谷歌服务账号凭据，当前文件内容是干净的，说明旧提交里有）；处理方式是合并/改写本地未推送的提交，必要时到 Google Cloud 删除旧密钥并新建。
4. “Material You”是自写的近似算法，**不读取安卓系统壁纸取色**，颜色与官方库不会完全一致；如需官方效果，可改用 `@material/material-color-utilities`（替换 `theme/color.ts` 中的 `makeScheme`）。
5. 外观设置只存本机，不同步账号。

## 六、验证清单（真机）

- [ ] 好友页点“发消息”→ 返回回到好友页；聊天页和“我的”页同理；安卓返回键同样
- [ ] 从通知点进聊天 → 返回到聊天列表
- [ ] 输入长文本：自动换行、最高 5 行后框内滚动；发送后输入框恢复单行
- [ ] 深色 / 浅色 / 跟随系统切换后，双方气泡都清晰；换纯色、图片背景、拖透明度后仍清晰
- [ ] 长按消息：复制、选择文本（选一部分 / 全选）、转发到一个或多个聊天（含当前聊天）；上下滑动列表时不误触发菜单
- [ ] 用用户名登录、用邮箱登录、密码错误提示；函数未部署时的提示
- [ ] 导航栏：切换动画、聊天未读角标、好友申请角标
- [ ] 群聊里对方消息显示发送者名字
- [ ] 图片背景选一张大图（> 5MB）：能压缩保存，不报错
