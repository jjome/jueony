@echo off
setlocal
set "JUEONY_FILE_REVIEW=%~dp0build\jueony-file-review91\Start-Jueony.cmd"
if not exist "%JUEONY_FILE_REVIEW%" (
  echo Build the file review bundle first. See docs\113-file-format-preservation.md.
  exit /b 1
)
call "%JUEONY_FILE_REVIEW%"
