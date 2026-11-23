# Horizon 推送自检（只读，不修改任何东西）
# 用法：
#   .\check-push.ps1                      # 只检查「表」和「函数」是否已配置
#   .\check-push.ps1 -WebhookSecret xxx   # 额外发一条真实测试推送
#   .\check-push.ps1 -WebhookSecret xxx -ConversationId <会话id> -SenderUserId <好友user id>
param(
  [string]$ProjectUrl,
  [string]$AnonKey,
  [string]$WebhookSecret,
  [string]$ConversationId,
  [string]$SenderUserId
)

$ErrorActionPreference = 'Stop'
$indexPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'index.html'

# 没传参数时，从 index.html 里自动读项目地址与 publishable key
if (-not $ProjectUrl -or -not $AnonKey) {
  if (Test-Path $indexPath) {
    $html = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)
    if (-not $ProjectUrl) {
      $m = [regex]::Match($html, "SUPABASE_URL\s*=\s*'([^']+)'")
      if ($m.Success) { $ProjectUrl = $m.Groups[1].Value }
    }
    if (-not $AnonKey) {
      $m = [regex]::Match($html, "SUPABASE_KEY\s*=\s*'([^']+)'")
      if ($m.Success) { $AnonKey = $m.Groups[1].Value }
    }
  }
}
if (-not $ProjectUrl) { throw '找不到项目地址，请用 -ProjectUrl 传入，例如 https://xxxx.supabase.co' }
$ProjectUrl = $ProjectUrl.TrimEnd('/')

$rows = @()

function Row($item, $ok, $detail) {
  $script:rows += [pscustomobject]@{ 项目 = $item; 结果 = $(if ($ok -eq $true) { '✅ 通过' } elseif ($ok -eq $false) { '❌ 未通过' } else { '⚠️ 注意' }); 说明 = $detail }
}

Write-Host "项目：$ProjectUrl" -ForegroundColor Cyan
if (-not $AnonKey) { Write-Host '警告：没拿到 anon/publishable key，跳过表检查' -ForegroundColor Yellow }

# ---------- 1. push_tokens 表 ----------
if ($AnonKey) {
  try {
    $r = Invoke-WebRequest -Uri "$ProjectUrl/rest/v1/push_tokens?select=id&limit=1" `
      -Headers @{ apikey = $AnonKey; Authorization = "Bearer $AnonKey" } -TimeoutSec 20 -UseBasicParsing
    Row 'push_tokens 表' $true "HTTP $($r.StatusCode)，表已存在（RLS 生效时返回空数组是正常的）"
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $code = [int]$resp.StatusCode
      $body = (New-Object System.IO.StreamReader($resp.GetResponseStream())).ReadToEnd()
      if ($body -match '42501|permission denied') {
        Row 'push_tokens 表' $true '表已建好；anon 角色没有读权限（符合设计，只有登录用户能读写）'
      } elseif ($body -match 'PGRST205|does not exist') {
        Row 'push_tokens 表' $false '表不存在 → 去 SQL Editor 执行 supabase/migrations/202611220001_push_tokens.sql'
      } else {
        Row 'push_tokens 表' $null "HTTP $code：$($body.Substring(0, [Math]::Min(120, $body.Length)))"
      }
    } else { Row 'push_tokens 表' $false "网络错误：$($_.Exception.Message)" }
  }
}

# ---------- 2. Edge Function ----------
$fnOk = $false
try {
  $r = Invoke-WebRequest -Uri "$ProjectUrl/functions/v1/push-message" -Method Post `
    -Headers @{ 'x-push-webhook-secret' = 'wrong-secret-probe'; 'Content-Type' = 'application/json' } `
    -Body '{}' -TimeoutSec 20 -UseBasicParsing
  Row 'Edge Function push-message' $null "HTTP $($r.StatusCode)：$($r.Content)"
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    $code = [int]$resp.StatusCode
    $body = (New-Object System.IO.StreamReader($resp.GetResponseStream())).ReadToEnd()
    if ($code -eq 401 -and $body -match 'Unauthorized webhook') {
      $fnOk = $true
      Row 'Edge Function push-message' $true '已部署，且 x-push-webhook-secret 校验生效'
    } elseif ($code -eq 404) {
      Row 'Edge Function push-message' $false '未部署 → 运行 tools\setup-push.ps1'
    } elseif ($code -eq 401) {
      Row 'Edge Function push-message' $null "已部署但被网关拦截（verify_jwt 没关？）：$body"
    } else {
      Row 'Edge Function push-message' $null "HTTP $code：$($body.Substring(0, [Math]::Min(120, $body.Length)))"
    }
  } else { Row 'Edge Function push-message' $false "网络错误：$($_.Exception.Message)" }
}

# ---------- 3. 真实测试推送 ----------
if ($WebhookSecret) {
  if (-not $ConversationId -or -not $SenderUserId) {
    Row '测试推送' $null '需要同时传 -ConversationId 和 -SenderUserId'
  } else {
    $payload = @{
      type = 'INSERT'; table = 'messages'; schema = 'public'
      record = @{
        id = 'probe-' + (Get-Date -Format 'HHmmss')
        conversation_id = $ConversationId
        sender_id = $SenderUserId
        body = 'Horizon 推送自检'
        created_at = (Get-Date).ToUniversalTime().ToString('o')
      }
    } | ConvertTo-Json -Depth 6
    try {
      $r = Invoke-RestMethod -Uri "$ProjectUrl/functions/v1/push-message" -Method Post `
        -Headers @{ 'x-push-webhook-secret' = $WebhookSecret; 'Content-Type' = 'application/json' } `
        -Body $payload -TimeoutSec 30
      $sent = $r.sent; $attempted = $r.attempted; $reason = $r.reason
      if ($sent -and $sent -gt 0) { Row '测试推送' $true "已发送 $sent/$attempted 台设备，去看手机" }
      elseif ($reason) { Row '测试推送' $null "没有发出去：$reason" }
      else { Row '测试推送' $null ($r | ConvertTo-Json -Compress) }
    } catch {
      $resp = $_.Exception.Response
      if ($resp) {
        $code = [int]$resp.StatusCode
        $body = (New-Object System.IO.StreamReader($resp.GetResponseStream())).ReadToEnd()
        Row '测试推送' $false "HTTP $code：$body"
      } else { Row '测试推送' $false $_.Exception.Message }
    }
  }
}

$rows | Format-Table -AutoSize -Wrap

Write-Host ''
if ($rows.结果 -contains '❌ 未通过') {
  Write-Host '还有没配置好的项，按「说明」列逐条处理。' -ForegroundColor Yellow
} else {
  Write-Host '基础项都通过了。剩下只能在手机上验证（锁屏、后台、划掉进程）。' -ForegroundColor Green
}
