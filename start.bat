@echo off
echo ==========================================
echo     Restaurant Application Launcher       
echo ==========================================
echo.
echo Pilih cara menjalankan aplikasi:
echo 1) Menggunakan Docker (Backend via Docker, Frontend Local)
echo 2) Tanpa Docker (Backend Local, Frontend Local)
echo.

set /p choice="Masukkan pilihan Anda (1/2): "

if "%choice%"=="1" goto docker
if "%choice%"=="2" goto nodocker
goto invalid

:docker
echo.
echo Menjalankan Backend dengan Docker...
cd backend-restaurant
if not exist .env (
    copy .env.example .env
    echo File .env berhasil dibuat dari .env.example
)
start cmd /k "docker compose -f docker-local-compose.yml up --build"
echo Menunggu container siap sebelum generate key...
timeout /t 5 /nobreak >nul
docker compose -f docker-local-compose.yml exec -T app php artisan key:generate
docker compose -f docker-local-compose.yml exec -T app php artisan migrate --seed
cd ..

echo.
echo Menjalankan Frontend...
cd frontend-restaurant
if not exist .env (
    copy .env.example .env
    echo File .env frontend berhasil dibuat dari .env.example
)
call npm install
call npm run dev
goto end

:nodocker
echo.
echo Menjalankan Backend secara lokal...
cd backend-restaurant
if not exist .env (
    copy .env.example .env
    echo File .env berhasil dibuat dari .env.example
)
call composer install
call php artisan key:generate
call php artisan migrate
call php artisan db:seed
start cmd /k "php artisan serve"
cd ..

echo.
echo Menjalankan Frontend...
cd frontend-restaurant
if not exist .env (
    copy .env.example .env
    echo File .env frontend berhasil dibuat dari .env.example
)
call npm install
call npm run dev
goto end

:invalid
echo Pilihan tidak valid. Skrip dihentikan.

:end
