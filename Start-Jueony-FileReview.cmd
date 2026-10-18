@echo off
setlocal
set "JUEONY_FILE_REVIEW=%~dp0build\jueony-file-review89\Start-Jueony.cmd"
if not exist "%JUEONY_FILE_REVIEW%" (
  echo Build the file review bundle first. See docs\112-file-recovery-implementation.md.
  exit /b 1
)
call "%JUEONY_FILE_REVIEW%"
