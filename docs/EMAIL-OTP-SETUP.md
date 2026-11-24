# 邮箱验证码配置（QQ 邮箱 SMTP）

注册、找回密码、注销账号都要发 6 位验证码，Supabase 默认邮件服务**每天只有 3~4 封且容易进垃圾箱**，所以这里用 QQ 邮箱的 SMTP。

## 一、拿到 QQ 邮箱「授权码」

1. 打开 https://mail.qq.com → 登录
2. 顶部 **设置** → **账号**（或「账户与安全」）
3. 找到 **POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务**
4. 开启 **IMAP/SMTP 服务**（要短信验证）
5. 生成的 **授权码**（16 位字母）复制下来 —— 这不是 QQ 密码，是专用于 SMTP 的

## 二、填到 Supabase

Dashboard → **Project Settings → Authentication → SMTP Settings**：

| 字段 | 值 |
|---|---|
| Sender email | 你的QQ邮箱（如 `3682413386@qq.com`） |
| Sender name | Horizon |
| Host | `smtp.qq.com` |
| Port | `465`（SSL）或 `587`（STARTTLS） |
| Username | 完整邮箱地址 |
| Password | **授权码**（不是QQ密码） |

保存后点 **Send test email** 验证。

## 三、开启「邮箱验证码」

Dashboard → **Authentication → Providers → Email**：

- ✅ Enable Email provider
- ✅ **Confirm email**（注册需要确认）
- ✅ 如果想用 6 位验证码登录/注销：打开 **Email OTP**

> 注意：Supabase 的 OTP 有效期默认 60 分钟，可在 **Authentication → Rate Limits** 里调频次。

## 四、改邮件模板（关键）

默认模板发的是**链接**，我们要的是**验证码**。

Dashboard → **Authentication → Email Templates**，把最常用的两个模板改掉：

### Confirm signup（注册确认）

```html
<h2>Horizon 注册验证码</h2>
<p>你的验证码是：</p>
<h1 style="letter-spacing:4px">{{ .Token }}</h1>
<p>10 分钟内有效。如果不是你本人操作，请忽略这封邮件。</p>
```

### Magic Link（注销 / 登录用）

```html
<h2>Horizon 验证码</h2>
<p>你的验证码是：</p>
<h1 style="letter-spacing:4px">{{ .Token }}</h1>
<p>10 分钟内有效。</p>
```

> `{{ .Token }}` 是 Supabase 提供的 6 位数字；`{{ .ConfirmationURL }}` 是链接。两者可以都要，但手机上复制验证码更顺手。

### Reset Password（找回密码）

```html
<h2>Horizon 重置密码</h2>
<p>验证码：</p>
<h1 style="letter-spacing:4px">{{ .Token }}</h1>
```

## 五、QQ 邮箱的限制

| 项 | 限制 |
|---|---|
| 每天发信量 | 免费账号约 50~100 封/天（够私人使用） |
| 频率 | 同一收件人 1 分钟内不要太频繁，会被限流 |
| 垃圾箱 | QQ → 外部邮箱偶尔进垃圾箱，告诉朋友检查一下 |

如果以后人多，建议换 **Resend**（免费 100 封/天，配置更简单，送达率更好）。

## 六、验证清单

配好后按顺序测：

1. 注册新账号 → 收到 6 位验证码 → 输入成功
2. 退出 → 忘记密码 → 收到验证码 → 改密码成功
3. 我的 → 注销账号 → 收到验证码 → 注销成功
4. 用同一个 ID 注册新账号 → 应该能拿到刚回收的 ID
