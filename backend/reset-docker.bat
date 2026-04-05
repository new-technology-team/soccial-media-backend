@echo off
REM Reset Docker containers and volumes with new MariaDB password
echo Stopping and removing containers...
docker compose down -v

echo.
echo Waiting 3 seconds...
timeout /t 3 /nobreak

echo.
echo Starting containers with new password (root)...
docker compose up -d

echo.
echo Done! MariaDB is now using password: root
echo Backend will restart and use the new credentials from .env
pause
