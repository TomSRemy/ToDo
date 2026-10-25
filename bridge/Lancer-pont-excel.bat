@echo off
chcp 65001 >nul
title Pont Excel - Todo
rem Starts the bridge with the NEWEST copy of pont-excel.ps1 in this folder: a new download is often saved as
rem "pont-excel (1).ps1" or "pont-excel.ps1.txt" next to the old one. That copy becomes pont-excel.ps1.
set "PS1=%~dp0pont-excel.ps1"
set "NEWEST="
for /f "delims=" %%f in ('dir /b /a-d /o-d "%~dp0pont-excel*.ps1*" 2^>nul') do if not defined NEWEST set "NEWEST=%%f"
if not defined NEWEST goto missing
if /i "%NEWEST%"=="pont-excel.ps1" goto run
copy /y "%~dp0%NEWEST%" "%PS1%" >nul
echo Copie la plus recente prise : %NEWEST%
goto run
:missing
echo.
echo Le fichier pont-excel.ps1 est introuvable dans ce dossier :
echo   %~dp0
echo.
echo 1. Dans l'appli : Reglages, Pont Excel, "Telecharger pont-excel.ps1".
echo 2. Si le navigateur l'a bloque : Ctrl+J, puis "Conserver" sur la ligne pont-excel.ps1.
echo 3. Range-le dans ce dossier, a cote de ce fichier, puis relance-moi.
echo.
pause
exit /b 1
:run
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%PS1%" %*
pause
