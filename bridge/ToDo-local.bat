@echo off
chcp 65001 >nul
rem ToDo en local : le pont Excel sert l'appli depuis ce PC (http://127.0.0.1:8765/app/) et Edge l'ouvre dans sa propre
rem fenetre, sans onglets ni barre d'adresse. Rien a installer, aucun droit administrateur. Rien ne vient d'Internet :
rem seules la sauvegarde GitHub (chiffree) et les donnees publiques de PowerKlock (onglet Marche) sortent du PC.
set "URL=http://127.0.0.1:8765/app/"
call :up
if not errorlevel 1 goto open
rem pont pas encore lance : au premier lancement (fichiers Excel a choisir) sa fenetre reste visible, ensuite reduite
if exist "%APPDATA%\Todo Pont Excel\pont-excel-config.json" (
  start "Pont Excel - Todo" /min "%~dp0Lancer-pont-excel.bat"
) else (
  start "Pont Excel - Todo" "%~dp0Lancer-pont-excel.bat"
)
for /l %%i in (1,1,240) do (
  call :up
  if not errorlevel 1 goto open
  >nul ping -n 2 127.0.0.1
)
echo Le pont Excel ne repond pas : regarde sa fenetre "Pont Excel - Todo".
pause
exit /b 1
:open
start "" msedge --app=%URL%
exit /b 0
:up
rem le pont repond-il sur ce PC ? (connexion directe au port, sans passer par un proxy)
powershell.exe -NoProfile -Command "$c=New-Object Net.Sockets.TcpClient; try{ $c.Connect('127.0.0.1',8765); exit 0 }catch{ exit 1 }finally{ $c.Close() }" >nul 2>&1
exit /b %errorlevel%
