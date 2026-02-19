@echo off
echo Launching Edge with remote debugging...
echo.
echo IMPORTANT: Edge must be started fresh for debugging to work.
echo Closing any open Edge windows...
taskkill /IM msedge.exe /F 2>nul
timeout /t 2 /nobreak >nul
echo.
echo 1. Edge will open - click the ... menu ^> New InPrivate window
echo 2. In the InPrivate window, go to https://carelink.minimed.eu and log in
echo 3. Keep this window open! Then run: python carelink-scraper-test.py
echo.
start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222
if errorlevel 1 start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222
echo Edge launched. Leave it open and run the scraper in another terminal.
