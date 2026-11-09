@echo off
chcp 65001 >nul
title Relais Claude - Todo
set "PS1=%~dp0relais-claude.ps1"
if not exist "%PS1%" goto missing
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
pause
exit /b 0
:missing
echo.
echo Le fichier relais-claude.ps1 est introuvable dans ce dossier :
echo   %~dp0
echo.
pause
exit /b 1
