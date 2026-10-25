@echo off
chcp 65001 >nul
title Pont Excel - Todo
rem Starts the bridge: pont-excel.ps1 must sit next to this file. A copy downloaded under another name
rem (pont-excel (1).ps1, pont-excel.ps1.txt) is taken instead; nothing found: says what to do.
set "PS1=%~dp0pont-excel.ps1"
if exist "%PS1%" goto run
for /f "delims=" %%f in ('dir /b /a-d /o-d "%~dp0pont-excel*.ps1" "%~dp0pont-excel*.ps1.txt" 2^>nul') do (
  copy /y "%~dp0%%f" "%PS1%" >nul
  echo Fichier "%%f" trouve : copie sous le nom pont-excel.ps1.
  goto run
)
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
