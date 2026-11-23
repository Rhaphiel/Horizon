# 语音消息设计方案（v0.3 规划）

> 目标：按住说话 → 松开自动上传 → 对方看到一条"宽度随时长变化"的语音气泡 → 点击播放。
> 你的想法是对的方向，这里把它拆成能落地的 6 步，并指出 5 个必须提前处理的坑。

---

## 一、先评价你的方案

你说的三步：

1. 先调用手机录音 → **正确**（`getUserMedia` + `MediaRecorder`）
2. 录下来的音频**先上传云端，再下发给接收者** → **正确，而且是最优解**
3. 气泡贴图长度随时长成正比 → **正确**（这是语音消息的通用视觉语言）

**为什么"先上传再发消息"是对的：**
一条语音消息本质是「音频文件」+「一条指向它的消息记录」。如果先发消息再上传，就会出现"消息已到、文件还没到"的空壳状态，对方点开会报错，还得做补传逻辑。先上传拿到 `path`，再插入消息，整条链路是原子的。

---

## 二、必须补的 5 件事（你的方案里还缺）

| # | 缺什么 | 具体做什么 |
|---|---|---|
| 1 | **录音权限** | Android：`RECORD_AUDIO` + 运行时授权；Capacitor 的 WebView 还要显式接管 `onPermissionRequest`，否则 `getUserMedia` 直接失败 |
| 2 | **音频格式** | Android WebView 录出来通常是 `audio/webm;codecs=opus`，iOS 是 `audio/mp4`。存储时按 `mime` 存扩展名，播放时用 `<audio>` 自动识别 |
| 3 | **上传路径与权限** | Supabase Storage 建桶 `voice`，路径 `voice/{user_id}/{uuid}.webm`；桶策略设成"登录用户可读，只有本人可写"，或统一用**签名 URL** |
| 4 | **时长与波形** | 时长用 `MediaRecorder` 计时（或 `AudioContext` 解码算）；波形取 30–50 个峰值存进消息体（数组很小，几百字节） |
| 5 | **失败与重试** | 上传失败要保留录音本地临时文件，允许"重发"；否则用户录 60 秒白录 |

---

## 三、数据模型（两种做法，推荐 B）

**A. 复用 messages 表**（改动最小）

```sql
alter table messages add column type text default 'text';   -- text | voice
alter table messages add column media_path text;            -- storage 路径
alter table messages add column duration int;               -- 秒
alter table messages add column peaks jsonb;                -- [0.2,0.8,...] 40 个点
```

**B. 独立 voice 表**（更干净，未来加图片/文件也好扩展）

```sql
create table voice_clips (
  message_id uuid primary key references messages(id) on delete cascade,
  path text not null,
  mime text not null,
  duration int not null,
  peaks jsonb
);
```

> 推荐 B：文字消息表保持干净，以后加图片/文件/位置各建一张，互不干扰。

---

## 四、完整流程图

```
[按住] getUserMedia({audio:true}) → MediaRecorder.start()
   │
   ├── 计时（每 100ms 更新"00:07"）
   ├── （可选）AnalyserNode 实时画波形
   │
[松开] MediaRecorder.stop() → 得到 Blob
   │
   ├── 1) 生成峰值数组 peaks[40]（用 AudioContext.decodeAudioData）
   ├── 2) 上传：storage.from('voice').upload(`${uid}/${uuid}.webm`, blob)
   │        └── 失败 → 保留本地 Blob，界面上给"重试"
   ├── 3) 插入消息：insert into messages(type='voice', media_path, duration, peaks)
   │
   ▼
[对方] Realtime 收到新消息
   ├── 气泡宽度 = clamp(120, 60 + 6×秒数, 260)   ← 你说的"正比"
   ├── 画 peaks 波形（40 根竖线，高度 = peak × 24px）
   └── 点击 → 取签名 URL（createSignedUrl(path, 3600)）→ <audio> 播放
```

---

## 五、分四步实施（每步都能单独测试）

### 第 1 步：只做"能录能放"（不联网）

```js
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '' });
const chunks = [];
rec.ondataavailable = e => chunks.push(e.data);
rec.onstop = () => {
  const blob = new Blob(chunks, { type: rec.mimeType });
  const url = URL.createObjectURL(blob);
  const a = new Audio(url); a.play();   // 先能回放
};
rec.start();  // 松开时 rec.stop()
```

**验收**：安卓机上录 3 秒，点播放能听到自己。

### 第 2 步：加权限与原生配置

- `AndroidManifest.xml` 加 `<uses-permission android:name="android.permission.RECORD_AUDIO" />`
- Capacitor 需要接管 WebView 的权限请求（否则 `getUserMedia` 报 NotAllowedError）
- iOS：`Info.plist` 加 `NSMicrophoneUsageDescription`

### 第 3 步：上传 + 落库

- Supabase 建桶 `voice`（私有）
- 上传后把 `path / duration / peaks / mime` 写进消息
- 阅读端用 `createSignedUrl` 拿 1 小时有效的播放地址

### 第 4 步：气泡 UI

- 宽度：`Math.min(260, Math.max(120, 60 + duration * 6))`
- 高度固定 36px，里面按 `peaks` 画 40 根竖线
- 播放时竖线从左到右点亮，最右侧显示秒数

---

## 六、5 个坑（提前知道能省一天）

1. **Capacitor WebView 不一定给麦克风**：`getUserMedia` 在原生壳里经常直接失败，需要处理 `WebChromeClient.onPermissionRequest`（或用社区插件 `capacitor-voice-recorder` 绕过）。这是最容易卡住的一步，先在真机上验证再往下做。
2. **iOS 与 Android 格式不同**：别写死 `.mp3`，按 `blob.type` 决定扩展名。
3. **自动播放限制**：`<audio>.play()` 必须由用户点击触发，不要在收到消息时自动播。
4. **R2/Storage 的读权限**：桶设成 public 就等于"拿到路径就能听"，两人用问题不大；要严一点就全部走签名 URL（1 小时过期）。
5. **体积**：opus 32kbps 下 60 秒约 240 KB，很轻；但 8 MB 上限还是要卡，防止有人传长音频。

---

## 七、和"弹窗提醒"的配合

语音消息到达时，`pushNotify` 里的 `text` 换成 `🎤 语音 0:07` 即可（v0.2 的弹窗已经把"摘要"抽成一行文本，改动量一行）。
