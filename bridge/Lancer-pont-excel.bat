@echo off
chcp 65001 >nul
title Pont Excel - Todo
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0pont-excel.ps1" %*
pause
