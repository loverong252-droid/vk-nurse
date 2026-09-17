@echo off
chcp 65001 >nul
title สร้างไอคอนแอปพลิเคชันห้องพยาบาล บนหน้าจอเดสก์ท็อป
echo =====================================================================
echo  กำลังสร้างทางลัด (Shortcut) "ระบบห้องพยาบาล โรงเรียนวิสุทธิกษัตรี"
echo  ไว้ที่หน้าจอ Desktop ของคุณ...
echo =====================================================================

set "TARGET_URL=http://localhost:8080/"
set "SCRIPT_DIR=%~dp0"
set "ICON_PATH=%SCRIPT_DIR%assets\logo.jpg"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\ระบบห้องพยาบาล โรงเรียนวิสุทธิกษัตรี.lnk"

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut('%SHORTCUT_PATH%'); " ^
  "$s.TargetPath = 'msedge.exe'; " ^
  "$s.Arguments = '--app=%TARGET_URL% --new-window'; " ^
  "$s.Description = 'ระบบจัดเก็บข้อมูลห้องพยาบาล โรงเรียนวิสุทธิกษัตรี'; " ^
  "$s.WorkingDirectory = '%SCRIPT_DIR%'; " ^
  "$s.Save();"

if exist "%SHORTCUT_PATH%" (
  echo.
  echo [สำเร็จ!] สร้างไอคอนทางลัดไว้ที่หน้าจอเดสก์ท็อปเรียบร้อยแล้ว:
  echo "%SHORTCUT_PATH%"
  echo.
  echo คุณสามารถดับเบิลคลิกไอคอนที่หน้า Desktop เพื่อเปิดเป็นแอปได้ทันที!
) else (
  echo.
  echo [ข้อผิดพลาด] ไม่สามารถสร้างทางลัดได้ กรุณาลองรันในสิทธิ์ Administrator
)

echo.
pause
