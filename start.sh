#!/bin/bash

echo "=========================================="
echo "    Restaurant Application Launcher       "
echo "=========================================="
echo ""
echo "Pilih cara menjalankan aplikasi:"
echo "1) Menggunakan Docker (Backend via Docker, Frontend Local)"
echo "2) Tanpa Docker (Backend Local, Frontend Local)"
echo ""
read -p "Masukkan pilihan Anda (1/2): " choice

case $choice in
  1)
    echo "Menjalankan Backend dengan Docker..."
    cd backend-restaurant || exit
    if [ ! -f .env ]; then
      cp .env.example .env
      echo "File .env berhasil dibuat dari .env.example"
    fi
    docker compose -f docker-local-compose.yml up --build -d
    echo "Menghasilkan Application Key (jika diperlukan)..."
    sleep 5
    docker compose -f docker-local-compose.yml exec -T app php artisan key:generate
    # Catatan: Migrasi otomatis dijalankan via entrypoint.sh di Docker
    cd ..
    
    echo "Menjalankan Frontend (npm run dev)..."
    cd frontend-restaurant || exit
    npm install
    npm run dev
    ;;
  2)
    echo "Menjalankan Backend secara lokal (php artisan serve)..."
    cd backend-restaurant || exit
    if [ ! -f .env ]; then
      cp .env.example .env
      echo "File .env berhasil dibuat dari .env.example"
    fi
    composer install
    php artisan key:generate
    php artisan migrate
    php artisan serve &
    BACKEND_PID=$!
    cd ..
    
    echo "Menjalankan Frontend (npm run dev)..."
    cd frontend-restaurant || exit
    npm install
    npm run dev
    
    # Ketika npm run dev dihentikan dengan CTRL+C, hentikan juga proses backend-nya
    kill $BACKEND_PID
    ;;
  *)
    echo "Pilihan tidak valid. Skrip dihentikan."
    exit 1
    ;;
esac
