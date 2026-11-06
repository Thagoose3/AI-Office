@echo off
rem สร้างไอคอน AI Office บน Desktop (ชี้มาที่โฟลเดอร์นี้)
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d 'AI Office.lnk')); $s.TargetPath='%ROOT%\AIOffice.bat'; $s.WorkingDirectory='%ROOT%'; $s.IconLocation='%ROOT%\AIOffice.ico,0'; $s.WindowStyle=7; $s.Description='AI Office'; $s.Save()" > "%ROOT%\shortcut.log" 2>&1
echo %errorlevel% >> "%ROOT%\shortcut.log"
echo AI Office icon created on your Desktop. You can close this window.
timeout /t 3 >NUL
