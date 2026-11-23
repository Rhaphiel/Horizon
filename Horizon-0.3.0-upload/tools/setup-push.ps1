# Horizon 推送部署向导（建 Secrets + 部署 Edge Function）
# 用法（推荐用 setup-push.cmd 双击跑）：
#   .\setup-push.ps1 -ServiceAccountPath D:\Horizon\service-account.json
# 可选：
#   .\setup-push.ps1 -ServiceAccountPath ... -AccessToken sbp_xxx   # 不想开浏览器登录时
param(
  [Parameter(Mandatory = $true)][string]$ServiceAccountPath,
  [string]$ProjectRef,
  [string]$AccessToken
)

# 注意：不能设成 Stop，否则原生命令写 stderr（比如未登录提示）会直接终止脚本
$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
$supabase = Join-Path $PSScriptRoot 'supabase.exe'
if (-not (Test-Path $supabase)) { throw "找不到 $supabase" }
if (-not (Test-Path $ServiceAccountPath)) { throw "找不到服务账号 JSON：$ServiceAccountPath" }

# ---- 1. 从 index.html 里取项目 ref ----
if (-not $ProjectRef) {
  $html = [System.IO.File]::ReadAllText((Join-Path $root 'index.html'), [System.Text.Encoding]::UTF8)
  $m = [regex]::Match($html, 'https://([a-z0-9]+)\.supabase\.co')
  if (-not $m.Success) { throw '没能从 index.html 里识别项目地址，请用 -ProjectRef 手动指定' }
  $ProjectRef = $m.Groups[1].Value
}
Write-Host "项目 ref：$ProjectRef" -ForegroundColor Cyan

# ---- 2. 校验服务账号 JSON ----
$sa = Get-Content $ServiceAccountPath -Raw | ConvertFrom-Json
if (-not $sa.client_email -or -not $sa.private_key -or -not $sa.project_id) {
  throw '这份 JSON 不像 Firebase 服务账号私钥（缺 client_email / private_key / project_id）。注意不是 google-services.json。'
}
Write-Host "服务账号：$($sa.client_email)（项目 $($sa.project_id)）" -ForegroundColor DarkGray

# ---- 3. 登录 ----
Write-Host "`n[1/3] 检查登录状态…" -ForegroundColor Cyan
if ($AccessToken) {
  $env:SUPABASE_ACCESS_TOKEN = $AccessToken
  Write-Host '已使用命令行传入的 Access Token'
}

$tokenFile = Join-Path $env:USERPROFILE '.supabase\access-token'
$hasToken = $env:SUPABASE_ACCESS_TOKEN -or (Test-Path $tokenFile)
if (-not $hasToken) {
  Write-Host '尚未登录，准备打开浏览器授权…' -ForegroundColor Yellow
  Write-Host '（如果浏览器没弹出来，去 Dashboard → Account → Access Tokens 生成一个，重跑并加 -AccessToken sbp_xxx）' -ForegroundColor DarkGray
  & $supabase login
  if ($LASTEXITCODE -ne 0) {
    $pat = Read-Host '登录失败。粘贴 Personal Access Token（sbp_ 开头）后回车，直接回车则退出'
    if (-not $pat) { throw '没有 Access Token，退出' }
    $env:SUPABASE_ACCESS_TOKEN = $pat.Trim()
  }
}

# ---- 4. 生成 webhook 密钥 + 写 env 文件 ----
$secretFile = Join-Path $PSScriptRoot 'push-secret.txt'
if (Test-Path $secretFile) {
  $webhookSecret = (Get-Content $secretFile -Raw).Trim()
  Write-Host "复用已有 webhook 密钥（$secretFile）"
} else {
  $chars = (48..57) + (65..90) + (97..122)
  $webhookSecret = -join (1..44 | ForEach-Object { [char]($chars | Get-Random) })
  Set-Content -Path $secretFile -Value $webhookSecret -Encoding UTF8 -NoNewline
  Write-Host "已生成 webhook 密钥并存到 $secretFile"
}

$saCompact = $sa | ConvertTo-Json -Compress -Depth 20
$envFile = Join-Path $env:TEMP 'horizon-secrets.env'
@(
  "PUSH_WEBHOOK_SECRET=$webhookSecret",
  "FCM_SERVICE_ACCOUNT_JSON=$saCompact"
) | Set-Content -Path $envFile -Encoding UTF8

# ---- 5. 写 Secrets（CLI v3 用 --remote）----
Write-Host "`n[2/3] 写入 Supabase Secrets…" -ForegroundColor Cyan
& $supabase secrets set --env-file $envFile --remote=$ProjectRef
if ($LASTEXITCODE -ne 0) {
  Remove-Item $envFile -Force -ErrorAction SilentlyContinue
  throw 'Secrets 写入失败，看上面的报错（常见原因：Access Token 没有该项目权限）'
}
Remove-Item $envFile -Force -ErrorAction SilentlyContinue

# ---- 6. 部署函数（v3 用 --use-api，免 Docker）----
Write-Host "`n[3/3] 部署 Edge Function…" -ForegroundColor Cyan
Push-Location $root
try {
  & $supabase functions deploy push-message --remote=$ProjectRef --use-api
  $deployExit = $LASTEXITCODE
} finally { Pop-Location }
if ($deployExit -ne 0) { throw '函数部署失败，看上面的报错' }

Write-Host @"

============================ 下一步：建 Webhook ============================
Dashboard → Database → Webhooks → Create a new hook

  Name    : push-on-message
  Table   : public.messages
  Events  : Insert
  Type    : Supabase Edge Function
  Function: push-message
  Method  : POST
  Headers : x-push-webhook-secret = $webhookSecret
            Content-Type = application/json

建好后回来验证：
  .\check-push.ps1 -WebhookSecret "$webhookSecret"

（密钥已存在 $secretFile，已加入 .gitignore）
==========================================================================
"@ -ForegroundColor Green
