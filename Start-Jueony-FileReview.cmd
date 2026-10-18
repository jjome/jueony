@echo off
setlocal
set "JUEONY_FILE_REVIEW=%~dp0build\n001-clean-review123\build\jueony-n001-review124\Start-Jueony.cmd"
if not exist "%JUEONY_FILE_REVIEW%" (
  echo Build the N001 review bundle first. See docs\127-n001-legacy-layout-storage.md.
  exit /b 1
)
call "%JUEONY_FILE_REVIEW%"
