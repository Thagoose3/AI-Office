@echo off
title AI Office
cd /d "%~dp0"
echo %date% %time% launch >> "launch.log"
rem restart server every time so it always uses the latest version
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":3010 .*LISTENING"') do taskkill /PID %%a /F >NUL 2>&1
start "AI Office Server (close to stop)" /min cmd /c "node server.js > server.log 2>&1"
timeout /t 2 /nobreak >NUL
start "" http://localhost:3010
exit /b 0
