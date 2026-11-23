@echo off
rem Run the push setup script without touching system execution policy.
setlocal
set SA=%~dp0..\service-account.json
if not "%~1"=="" set SA=%~1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-push.ps1" -ServiceAccountPath "%SA%"
echo.
pause
