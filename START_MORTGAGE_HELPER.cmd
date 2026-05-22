@echo off
setlocal
cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Node.js / npm was not found.
  echo Please install Node.js first, then run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing app dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting Mortgage Decision Helper...
echo.
echo If the browser does not open automatically, go to:
echo http://127.0.0.1:5173
echo.
start "" "http://127.0.0.1:5173"
call npm.cmd run dev -- --port 5173

pause
