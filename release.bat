@echo off
setlocal enabledelayedexpansion

REM Usage:
REM   release.bat              -> uses package.json version
REM   release.bat 0.1.0        -> uses explicit version

set VERSION=%1
if "%VERSION%"=="" (
  for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set VERSION=%%v
)

if "%VERSION%"=="" (
  echo Could not determine version. Pass it as argument: release.bat 0.1.0
  exit /b 1
)

set ZIP=lazy-dungeon-master-%VERSION%.zip
set STAGE=dist-release

if not exist "main.js" (
  echo main.js not found. Run: npm run build
  exit /b 1
)

if not exist "manifest.json" (
  echo manifest.json not found.
  exit /b 1
)

if exist "%STAGE%" rmdir /s /q "%STAGE%"
mkdir "%STAGE%" >nul

copy /y "main.js" "%STAGE%\" >nul
copy /y "manifest.json" "%STAGE%\" >nul
if exist "styles.css" copy /y "styles.css" "%STAGE%\" >nul
if exist "README.md" copy /y "README.md" "%STAGE%\" >nul

if exist "%ZIP%" del /q "%ZIP%"

where tar >nul 2>nul
if errorlevel 1 (
  echo tar.exe not found. On Windows 10/11 it is usually available. Alternative: install 7-Zip and adapt script.
  exit /b 1
)

tar -a -c -f "%ZIP%" -C "%STAGE%" *
if errorlevel 1 (
  echo Failed to create %ZIP%.
  exit /b 1
)

rmdir /s /q "%STAGE%"
echo Created %ZIP%

endlocal
exit /b 0
