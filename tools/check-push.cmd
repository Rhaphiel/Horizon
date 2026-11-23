@echo off
rem Read-only push self check (no changes made).
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-push.ps1" %*
echo.
pause
