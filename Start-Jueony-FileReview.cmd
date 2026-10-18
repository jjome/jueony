@echo off
setlocal
set "JUEONY_FILE_REVIEW=%~dp0build\n001-review132-clean\build\jueony-n001-review151\Start-Jueony.cmd"
if not exist "%JUEONY_FILE_REVIEW%" (
  echo Build the N001 review bundle first. See docs\132-n001-current-table-hosts-storage.md.
  exit /b 1
)
call "%JUEONY_FILE_REVIEW%"
