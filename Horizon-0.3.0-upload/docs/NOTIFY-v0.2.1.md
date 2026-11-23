# 系统通知说明（v0.2.1）

> 目标：别人发消息时，手机**锁屏能亮、能弹横幅（heads-up）、桌面图标能有角标数字**。

---

## 一、现在三种场景分别是什么表现

| 场景 | 表现 | 靠什么 |
|---|---|---|
| App 正在前台 | 应用内顶部弹窗（不进系统通知栏，避免打扰） | `showInAppToast()` |
| App 在后台或锁屏，**进程还活着** | ✅ 系统通知：横幅 + 锁屏 + 通知中心 + 角标数字 | `systemNotify()` → LocalNotifications |
| App 被系统/用户**杀掉** | ❌ 收不到 | 需要 FCM 推送（见第五节） |

判断逻辑就一行：

```js
if (document.hidden) systemNotify(m); else showInAppToast(m);
```

---

## 二、为什么能弹系统通知

用的是 Capacitor 官方插件 `@capacitor/local-notifications`，它直接调 Android 的 `NotificationManager`。

三处关键参数：

| 参数 | 值 | 作用 |
|---|---|---|
| `channel.importance` | `5`（HIGH） | **只有 HIGH 才会弹横幅**，低于 4 只有通知栏静默条目 |
| `channel.visibility` | `1`（PUBLIC） | 锁屏上显示完整内容（0 = 全部隐藏） |
| `notification.number` | 未读总数 | 桌面角标数字（支持的启动器） |

另有两个细节：

- **通知 id 用聊天 id 哈希成整数**：同一个聊天反复来消息会**覆盖**同一条通知，而不是堆一屏
- **点通知跳转**：通过 `extra: { cid }` 带上聊天 id，监听 `localNotificationActionPerformed` 后直接 `openConv(cid)`
- **进聊天清通知**：`clearDelivered()` 在 `openConv()` 里调用

---

## 三、必须配的三处（少一处就不弹）

1. **`package.json` 加依赖**
   ```json
   "@capacitor/local-notifications": "^8.0.0"
   ```
2. **`AndroidManifest.xml` 声明权限**（Android 13+ 必须，否则静默失败）
   ```xml
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
   ```
   > 你用的是 GitHub Actions 打包，我已经把这一步写进 `build-apk.yml`，**不用手工改 manifest**。
3. **运行时申请授权**（首次登录时弹一次）
   ```js
   let perm = await LN.checkPermissions();
   if (perm.display !== 'granted') perm = await LN.requestPermissions();
   ```
   用户拒绝后，只能去「设置 → 应用 → Horizon → 通知」里手动打开。

---

## 四、已知限制（务必知道）

| 限制 | 说明 | 缓解 |
|---|---|---|
| **进程被杀就收不到** | Realtime 是 WebSocket，进程没了连接就断了 | 真正解决要上 FCM（第五节） |
| 国产 ROM 会杀后台 | MIUI / EMUI / ColorOS 默认激进 | 设置里加「自启动」「后台运行」「锁定后台」 |
| 角标不是系统级 | 只依赖启动器解析已投递的通知数 | 小米/华为多数支持；原生 Android 只显示小圆点 |
| 渠道被用户关闭 | 用户可单独关掉「新消息」渠道 | 无法绕过 |
| 断线期间的消息 | Realtime 重连的几秒内可能漏推 | 打开列表时 `loadConvs()` 兜底，但不会补发通知 |

---

## 五、想让「App 被杀也能收到」要做什么（FCM 路线）

这是和微信/Telegram 对齐的最后一步，成本明显上升：

1. **Firebase 项目** → 下载 `google-services.json` → 放到 `android/app/`
2. **加插件** `@capacitor/push-notifications`，启动时拿到设备 token
3. **token 存库**：新建表 `push_tokens(user_id, token, platform)`
4. **服务端发推送**：消息 INSERT 后触发
   - Supabase：Database Webhook / Edge Function
   - 或 Cloudflare Worker 定时拉取
   - 调 FCM HTTP v1（需要服务账号 JSON + OAuth token）
5. **iOS** 另需 APNs 证书

⚠️ 国内机型还有一层：**没有 Google 服务（GMS）就收不到 FCM**。要么走厂商推送（小米/华为/OPPO/荣耀各自的 SDK），要么自建长连接（成本最高）。对两个人的 App，现实做法是：**保持后台不被杀**，而不是硬上推送。

---

## 六、验收清单（装上新 APK 后逐条试）

- [ ] 首次登录弹「允许通知」授权框
- [ ] App 切到后台，用另一台手机发消息 → **5 秒内出现横幅**
- [ ] 锁屏状态下发消息 → 锁屏上能看到「谁 + 内容」
- [ ] 桌面图标右上角出现未读数字（看你的启动器）
- [ ] 点通知 → 直接进入对应聊天
- [ ] 进入聊天后，通知栏里那条被清掉
- [ ] 多个聊天轮流来消息 → 通知不堆一屏（同聊天覆盖）
- [ ] 关掉首页「🔔 通知」开关 → 不再弹
