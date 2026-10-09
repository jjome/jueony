@echo off
setlocal
set "renameScript=%~dp0scripts\Rename-Project-Folder.ps1"
cd /d "%~dp0.."
powershell.exe -NoProfile -File "%renameScript%"
set "renameResult=%errorlevel%"
pause
exit /b %renameResult%
