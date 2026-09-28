@echo off
chcp 65001 > nul
title Demo Molding - Thang 6/2026

echo.
echo ============================================================
echo  DEMO MOLDING REALTIME - DU LIEU THANG 6/2026
echo ============================================================
echo.
echo Dang khoi dong server demo (Cong 5005)...

for /f "tokens=5" %%i in ('netstat -aon ^| find ":5005" ^| find "LISTENING"') do (
    taskkill /F /PID %%i > nul 2>&1
)

start "" /B node scripts/demo-server.cjs

timeout /t 2 /nobreak > nul

echo.
echo Dang mo trinh duyet...
start http://localhost:5005

echo.
echo Demo dang chay tai http://localhost:5005
echo Ban co the dong cua so nay de tat server.
pause > nul

for /f "tokens=5" %%i in ('netstat -aon ^| find ":5005" ^| find "LISTENING"') do (
    taskkill /F /PID %%i > nul 2>&1
)

