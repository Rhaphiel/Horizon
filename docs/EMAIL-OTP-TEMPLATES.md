# 让 Horizon 发出「6 位数字验证码」而不是登录链接

你截图里那封邮件标题是 **`Your sign-in link`** —— 这是 Supabase 的默认 **Magic Link** 模板，里面只有链接，没有验证码。

Horizon 需要的是 `{{ .Token }}`（6 位数字）。**必须在 Supabase 后台改模板**，代码无法替你做这件事。

## 一、要改三个模板

路径：**Authentication → Email Templates**

### 1. Magic Link（忘记密码 / 注销 用这个）

把整段内容换成：

```html
<h2 style="margin:0 0 12px">Horizon 验证码</h2>
<p style="margin:0 0 8px">你的验证码是：</p>
<p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:12px 0">{{ .Token }}</p>
<p style="color:#666;font-size:13px">10 分钟内有效。如果不是你本人操作，请忽略这封邮件。</p>
```

### 2. Confirm signup（注册用这个）

```html
<h2 style="margin:0 0 12px">Horizon 注册验证码</h2>
<p style="margin:0 0 8px">你的验证码是：</p>
<p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:12px 0">{{ .Token }}</p>
<p style="color:#666;font-size:13px">10 分钟内有效。</p>
```

### 3. Recovery（如果以后用「找回密码链接」）

```html
<h2 style="margin:0 0 12px">Horizon 重置密码</h2>
<p style="margin:0 0 8px">你的验证码是：</p>
<p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:12px 0">{{ .Token }}</p>
```

> 想同时保留链接也行：把 `{{ .ConfirmationURL }}` 加一行按钮即可，但**至少要有 `{{ .Token }}`**。

## 二、改完之后检查这两项

**Authentication → Providers → Email**

| 项 | 应为 |
|---|---|
| Enable Email provider | ✅ 开 |
| Confirm email | ✅ 开（注册要验证码） |
| **Email OTP** | ✅ 开（否则只有链接） |

**Authentication → Rate Limits**

| 项 | 建议 |
|---|---|
| Email OTP / hour | 20~30（自己用够） |
| 同一邮箱最小间隔 | 60 秒 |

## 三、SMTP 再确认

**Project Settings → Authentication → SMTP Settings**

| 字段 | 值 |
|---|---|
| Sender email | rhaphiel@qq.com |
| Sender name | Horizon |
| Host | smtp.qq.com |
| Port | 465 |
| Username | **rhaphiel@qq.com**（不是 Horizon） |
| Password | QQ 邮箱的**授权码** |

改完点 **Save changes**，再用 **Send test email** 验证能收到信。

## 四、验证顺序

1. 改模板 → 保存
2. 点「忘记密码？」→ 填邮箱
3. 收到的邮件应该是「Horizon 验证码」+ 6 位数字
4. 把数字填进 App → 成功重置

## 五、常见问题

| 现象 | 原因 |
|---|---|
| 邮件还是 `Your sign-in link` | 模板没保存成功，或改的是别的模板 |
| 收到邮件但只有链接没有数字 | 模板里没有 `{{ .Token }}` |
| 一直收不到邮件 | SMTP 没配好（Username 填错 / 用 QQ 密码而不是授权码） |
| 提示 rate limit | 60 秒内重复发送；等一分钟 |
| 进了垃圾箱 | QQ 邮箱发外部地址偶尔会，检查垃圾邮件 |
