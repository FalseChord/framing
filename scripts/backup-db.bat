@echo off
setlocal
set BACKUP_DIR=%~dp0..\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
set TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%
copy "%~dp0..\prisma\dev.db" "%BACKUP_DIR%\framing_%TIMESTAMP%.db"
