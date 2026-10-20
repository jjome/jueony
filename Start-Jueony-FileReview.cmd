@echo off
setlocal
set "JUEONY_FILE_REVIEW=%~dp0build\n001-review132-clean\build\jueony-n001-review182\Start-Jueony.cmd"
if not exist "%JUEONY_FILE_REVIEW%" (
  echo Build the N001 review bundle first. See docs\138-n001-storage-current-closure.md.
  exit /b 1
)
call "%JUEONY_FILE_REVIEW%"
