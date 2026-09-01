@echo off
cd /d "%~dp0"
title Local Control

if not exist "node_modules\next" (
  echo Installing Local Control for the first time...
  call npm install
  if errorlevel 1 (
    echo.
    echo Installation failed. Review the message above.
    pause
    exit /b 1
  )
)

node scripts\check-running.js
if not errorlevel 1 (
  timeout /t 3 /nobreak >nul
  exit /b 0
)

echo Preparing Local Control...
call npm run build
if errorlevel 1 (
  echo.
  echo Local Control could not be prepared. Review the message above.
  pause
  exit /b 1
)

call npm run start
if errorlevel 1 pause
