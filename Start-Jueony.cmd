@echo off
powershell.exe -NoProfile -File "%~dp0scripts\Start-Jueony.ps1"
if errorlevel 1 pause
