@echo off
if exist "%~dp0build\jueony-preview\JueonyEditor.exe" (
  start "" "%~dp0build\jueony-preview\JueonyEditor.exe"
  exit /b
)
powershell.exe -NoProfile -File "%~dp0scripts\Start-Jueony.ps1"
if errorlevel 1 pause
