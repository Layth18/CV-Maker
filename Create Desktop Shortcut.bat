@echo off
rem Creates a "CV Studio" shortcut (with the app icon) on your Desktop.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$d = [Environment]::GetFolderPath('Desktop');" ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d 'CV Studio.lnk'));" ^
  "$s.TargetPath = (Join-Path '%~dp0' 'Start CV Studio.bat');" ^
  "$s.WorkingDirectory = '%~dp0';" ^
  "$s.IconLocation = (Join-Path '%~dp0' 'assets\cv-studio.ico') + ',0';" ^
  "$s.WindowStyle = 7;" ^
  "$s.Description = 'Start CV Studio';" ^
  "$s.Save()"
if errorlevel 1 (
  echo Could not create the shortcut.
) else (
  echo Shortcut "CV Studio" created on your Desktop.
)
pause
