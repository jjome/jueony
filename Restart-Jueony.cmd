@echo off
echo Save your documents and close Jueony windows before restarting.
powershell.exe -NoProfile -File "%~dp0scripts\Start-Jueony.ps1" -RestartServer
if errorlevel 1 pause
