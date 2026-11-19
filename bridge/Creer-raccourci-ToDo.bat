@echo off
chcp 65001 >nul
rem Cree le raccourci "ToDo" sur le bureau (et, si on le demande, au demarrage de Windows) vers ToDo-local.bat.
rem Aucun droit administrateur : le raccourci est dans le profil de l'utilisateur.
set "TARGET=%~dp0ToDo-local.bat"
set "ICON=%~dp0..\icons\todo.ico"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject WScript.Shell; foreach($d in @([Environment]::GetFolderPath('Desktop'))){ $s=$w.CreateShortcut((Join-Path $d 'ToDo.lnk')); $s.TargetPath=$env:TARGET; $s.WorkingDirectory=(Split-Path $env:TARGET); $s.WindowStyle=7; $s.IconLocation=(Resolve-Path $env:ICON).Path; $s.Description='ToDo, sur ce PC'; $s.Save() }"
echo Raccourci "ToDo" cree sur le bureau.
set /p ANS=Lancer aussi ToDo au demarrage de Windows ? (O/N) 
if /i "%ANS%"=="O" powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'ToDo.lnk')); $s.TargetPath=$env:TARGET; $s.WorkingDirectory=(Split-Path $env:TARGET); $s.WindowStyle=7; $s.IconLocation=(Resolve-Path $env:ICON).Path; $s.Save()" && echo Ajoute au demarrage.
pause
