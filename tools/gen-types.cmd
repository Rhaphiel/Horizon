@echo off
REM 从线上数据库重新生成 TypeScript 类型，覆盖 src\types\database.ts
REM 前提：已经用 tools\supabase.exe login 登录并 link 过项目（你的项目已经 link 了）
cd /d "%~dp0.."
tools\supabase.exe gen types typescript --linked > src\types\database.ts.new
if errorlevel 1 (
  echo 生成失败，已保留旧的 database.ts
  del src\types\database.ts.new 2>nul
  exit /b 1
)
move /y src\types\database.ts.new src\types\database.ts
echo 完成：src\types\database.ts 已更新
