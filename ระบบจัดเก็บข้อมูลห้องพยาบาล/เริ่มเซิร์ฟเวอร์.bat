@echo off
chcp 65001 >nul
title ระบบห้องพยาบาล โรงเรียนวิสุทธิกษัตรี
echo ========================================================
echo  ระบบห้องพยาบาล โรงเรียนวิสุทธิกษัตรี จ.สมุทรปราการ
echo  กำลังเริ่มเซิร์ฟเวอร์ที่: http://localhost:8080/
echo ========================================================
start "" "http://localhost:8080/"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8080
pause
