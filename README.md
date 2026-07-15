# Restaurant Application (MOC Test)

Ini adalah aplikasi manajemen restoran yang terdiri dari Backend API dan Frontend antarmuka pengguna.

## Struktur Folder

- `backend-restaurant/`
  Berisi kode sumber untuk backend API yang dibangun menggunakan framework **Laravel (PHP)**. Di dalam folder ini juga terdapat konfigurasi Docker (`docker-local-compose.yml`) yang mencakup setup untuk App, Web Server Nginx, PostgreSQL, dan Redis.

- `frontend-restaurant/`
  Berisi kode sumber untuk frontend antarmuka pengguna (UI) yang dibangun menggunakan **Next.js / React (TypeScript)**.

---

## Cara Menjalankan Aplikasi (Otomatis)

Untuk mempermudah proses development, Anda dapat menggunakan script otomatis yang sudah disediakan di direktori utama ini. Script ini akan memberikan Anda pilihan interaktif untuk menjalankan aplikasi dengan atau tanpa Docker.

### Pengguna Mac / Linux
Buka terminal di folder utama ini dan jalankan perintah:
```bash
./start.sh
```
*(Catatan: Pastikan script memiliki izin eksekusi. Jika gagal dijalankan, ketik `chmod +x start.sh` terlebih dahulu).*

### Pengguna Windows
Klik ganda pada file `start.bat` di folder utama ini, atau buka Command Prompt / PowerShell dan jalankan:
```cmd
start.bat
```

### Opsi pada Script Interaktif:
1. **Menggunakan Docker (Direkomendasikan)**: 
   - Backend (App, Nginx, PostgreSQL, Redis) akan berjalan secara otomatis di dalam kontainer menggunakan perintah `docker compose up`.
   - Frontend akan berjalan secara lokal menggunakan Node.js (`npm run dev`).
2. **Tanpa Docker (Manual)**:
   - Backend akan dijalankan secara lokal menggunakan perintah bawaan PHP `php artisan serve`. (Pastikan Anda sudah menyiapkan database lokal dan file `.env` dengan kredensial yang sesuai).
   - Frontend akan berjalan secara lokal menggunakan `npm run dev`.

---

## Cara Menjalankan Aplikasi (Manual)

Jika Anda ingin menjalankan setiap sistem secara manual di terminal yang terpisah:

### 1. Menjalankan Backend
Masuk ke direktori `backend-restaurant`:
```bash
cd backend-restaurant
```
**Opsi A: Dengan Docker**
```bash
docker compose -f docker-local-compose.yml up --build
```
**Opsi B: Tanpa Docker**
Pastikan `.env` sudah diatur dan database/Redis lokal menyala.
```bash
composer install
php artisan key:generate
php artisan migrate
php artisan serve
```

### 2. Menjalankan Frontend
Buka tab terminal baru dan masuk ke direktori `frontend-restaurant`:
```bash
cd frontend-restaurant
npm install
npm run dev
```
Aplikasi frontend akan dapat diakses pada browser di `http://localhost:3000` (atau port lain jika 3000 sudah digunakan).
