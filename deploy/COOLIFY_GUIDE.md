# 🚀 Panduan Setup di Coolify v4 (Zero Server Load)

Karena Anda menggunakan **Coolify**, proses deployment menjadi jauh lebih mudah, aman, dan **tidak membebani CPU/RAM server** Anda.

---

### Cara Kerja:
1. **GitHub Actions**: Setiap kali Anda push ke branch `main`/`master`, GitHub Actions akan:
   - Menjalankan unit test backend & frontend.
   - Mengompilasi Docker image backend (Laravel) dan frontend (Next.js).
   - Mengunggah (*push*) image ke **GitHub Container Registry (`ghcr.io`)**.
   - Men-trigger **Webhook Coolify**.
2. **Coolify Server**:
   - Menerima sinyal webhook dari GitHub.
   - Menarik image jadi dari `ghcr.io` (hanya download, **tanpa kompilasi/build**).
   - Menjalankan rolling update container dengan Traefik/Caddy SSL otomatis.

---

### Langkah Setup di Coolify Dashboard (Hanya 1 Kali):

#### 1. Buat Project Baru di Coolify
- Buka dashboard Coolify Anda.
- Klik **Projects** > Pilih Project > Klik **+ New Resource**.
- Pilih **Docker Compose**.

#### 2. Konfigurasi Docker Compose
- Pilih sumber: **Git Repository** (arahkah ke repo ini).
- File Compose: isi dengan path `deploy/docker-compose.coolify.yml`.
- Atau jika menggunakan inline editor, copy-paste isi dari file [deploy/docker-compose.coolify.yml](docker-compose.coolify.yml).

#### 3. Hubungkan Domain di Coolify
- Pada service **`nginx`**, masukkan domain Anda di kolom **Domains** (misal: `https://resto.domainanda.com`).
- Coolify secara otomatis akan:
  - Mengarahkan traffic HTTPS ke port 80 Nginx Gateway.
  - Menerbitkan sertifikat SSL gratis (Let's Encrypt).
  - Nginx akan otomatis membagikan:
    - `/api/*` -> Backend Laravel
    - `/*` -> Frontend Next.js

#### 4. Isi Environment Variables di Coolify
Di tab **Environment Variables** resource tersebut, tambahkan:
```env
APP_KEY=base64:YOUR_APP_KEY_HERE
APP_URL=https://resto.domainanda.com
DB_USERNAME=root
DB_PASSWORD=buat_password_database_anda
DB_DATABASE=db_moc
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_APP_URL=https://resto.domainanda.com
```

#### 5. Ambil Webhook URL untuk CI/CD Otomatis
- Di halaman aplikasi Coolify Anda, buka tab **Webhooks**.
- Salin **Deploy Webhook** (contoh: `https://coolify.domainanda.com/api/v1/deploy?uuid=xxxxxx`).
- Masuk ke GitHub Repository Anda:
  - Buka **Settings** > **Secrets and variables** > **Actions**.
  - Klik **New repository secret**.
  - Name: `COOLIFY_WEBHOOK_URL`
  - Value: *(Paste URL Webhook Coolify tadi)*.

Selesai! Setiap kali Anda melakukan `git push` ke `main`, GitHub Actions akan membuild image dan Coolify akan otomatis mengupdate aplikasinya secara instan tanpa membuat server lemot!

