@echo off
if exist "%~dp0build\windows-preview\JoouniEditor.exe" (
  start "" "%~dp0build\windows-preview\JoouniEditor.exe"
  exit /b
)
powershell.exe -NoProfile -File "%~dp0scripts\Start-Editor.ps1"
if errorlevel 1 pause
