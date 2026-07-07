@echo off
REM Rebate Farming Engine - Windows Kurulum Script
REM Kullanım: Klasöre gir ve setup.bat'e çift tıkla

echo.
echo ================================================
echo Rebate Farming Engine Windows Kurulum Baslaniyor
echo ================================================
echo.

REM 1. Node.js Kontrol
echo [1/3] Node.js Kontrol Ediliyor...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo HATA: Node.js yuklenmis degil!
    echo https://nodejs.org/ adresinden LTS sürümünü indir ve kur
    echo.
    pause
    exit /b 1
)
echo OK - Node.js yuklü
echo.

REM 2. npm install
echo [2/3] Paketler Yukleniyor (Bu biraz surebilir)...
call npm install
if errorlevel 1 (
    echo.
    echo HATA: npm install basarisiz!
    pause
    exit /b 1
)
echo OK - Paketler yuklendi
echo.

REM 3. Build
echo [3/3] Build Yapiliyor...
call npm run build
if errorlevel 1 (
    echo.
    echo HATA: Build basarisiz!
    pause
    exit /b 1
)
echo OK - Build tamamlandi
echo.

REM 4. Başlatma seçeneği
echo ================================================
echo Kurulum tamamlandi!
echo ================================================
echo.
echo Baslatma secenekleri:
echo [1] Docker ile basla (Docker yuklü ve calisan olmalı)
echo [2] npm run start (Manual baslat)
echo [3] npm run dev (Development mode)
echo [0] Cikis
echo.

set /p choice="Seciniz (0-3): "

if "%choice%"=="1" (
    echo.
    echo Docker ile baslatiliyor...
    docker-compose up -d
    echo.
    echo http://localhost:3000 tarayicida aciniz
    pause
) else if "%choice%"=="2" (
    echo.
    call npm run start
) else if "%choice%"=="3" (
    echo.
    call npm run dev
) else (
    echo.
    echo Baslat icin: npm run start
    echo.
)

pause
