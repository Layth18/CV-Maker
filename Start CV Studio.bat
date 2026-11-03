@echo off
rem Double-click to start CV Studio. Close this window to stop it.
title CV Studio
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js / npm was not found. Install Node.js from https://nodejs.org and try again.
  pause
  exit /b 1
)

rem Already running? Just open the browser.
curl.exe -s -f -o nul -m 2 http://localhost:5173/api/health >nul 2>nul
if not errorlevel 1 (
  echo CV Studio is already running.
  if not "%CV_NO_BROWSER%"=="1" start "" http://localhost:5173
  exit /b 0
)

if not exist "node_modules\" (
  echo Installing dependencies - first run only, this takes a minute...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo npm install failed. See the messages above.
    pause
    exit /b 1
  )
)

rem Open the browser once both the editor and the LaTeX API answer.
if not "%CV_NO_BROWSER%"=="1" (
  start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 120;$i++){try{Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:5173/api/health | Out-Null; Start-Process 'http://localhost:5173'; break}catch{Start-Sleep -Milliseconds 500}}"
)

echo.
echo  CV Studio is starting at http://localhost:5173
echo  Keep this window open while you work. Close it to stop CV Studio.
echo.
call npm run dev

echo.
echo CV Studio stopped.
pause
