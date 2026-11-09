@echo off
chcp 65001 >nul
title Raccourci capture - Todo
set "PS1=%~dp0raccourci-capture.ps1"
if not exist "%PS1%" goto missing
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%PS1%" %*
pause
exit /b 0
:missing
echo.
echo Le fichier raccourci-capture.ps1 est introuvable dans ce dossier :
echo   %~dp0
echo.
pause
exit /b 1
