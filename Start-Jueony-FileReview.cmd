@echo off
setlocal
set "JUEONY_FILE_REVIEW=%~dp0build\n001-review132-clean\build\jueony-n001-review143\Start-Jueony.cmd"
if not exist "%JUEONY_FILE_REVIEW%" (
  echo Build the N001 review bundle first. See docs\130-n001-column-suffix-storage.md.
  exit /b 1
)
call "%JUEONY_FILE_REVIEW%"
