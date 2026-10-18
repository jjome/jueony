@echo off
setlocal
set "JUEONY_FILE_REVIEW=%~dp0build\jueony-file-review106\Start-Jueony.cmd"
if not exist "%JUEONY_FILE_REVIEW%" (
  echo Build the file review bundle first. See docs\120-native-prefix-storage.md.
  exit /b 1
)
call "%JUEONY_FILE_REVIEW%"
