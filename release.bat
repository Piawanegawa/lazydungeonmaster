@echo off
setlocal

if not exist manifest.json (
  echo manifest.json not found at repository root.
  exit /b 1
)

if not exist main.js (
  echo main.js not found at repository root. Build the plugin before packaging.
  exit /b 1
)

for /f "usebackq tokens=* delims=" %%v in (`powershell -NoProfile -Command "(Get-Content -Raw 'manifest.json' | ConvertFrom-Json).version"`) do set VERSION=%%v

if not defined VERSION (
  echo Unable to read version from manifest.json.
  exit /b 1
)

set ZIPNAME=lazy-dungeon-master-%VERSION%.zip
set FILES=main.js manifest.json

if exist styles.css set FILES=%FILES% styles.css
if exist README.md set FILES=%FILES% README.md

powershell -NoProfile -Command "\
  Remove-Item -Force '%ZIPNAME%' -ErrorAction SilentlyContinue; \
  Compress-Archive -Path %FILES% -DestinationPath '%ZIPNAME%' -CompressionLevel Optimal\
" || (
  echo Failed to create %ZIPNAME%.
  exit /b 1
)

echo Created %ZIPNAME% with: %FILES%
